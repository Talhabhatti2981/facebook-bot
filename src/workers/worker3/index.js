/**
 * Worker 3 - Email Outreach Sequence
 * Runs daily at 7:30 AM
 * Sends personalized emails to leads based on their sequence day
 */

const googleSheets = require('../../shared/googleSheets');
const brevo = require('../../shared/brevo');
const emailGenerator = require('./emailGenerator');
const { info, error, warn, logAction } = require('../../utils/logger');
const { randomDelay } = require('../../utils/delays');
const config = require('../../../config/config');
const telegram = require('../../notifications/telegram');

let emailsSent = 0;
let emailsFailed = 0;

/**
 * Main Worker 3 execution
 */
async function runWorker3() {
  try {
    logAction('🚀 Worker 3 - Email Outreach Sequence starting');
    info('═══════════════════════════════════════');
    info('Worker 3 - Email Outreach Sequence');
    info('Time: ' + new Date().toLocaleString());
    info('═══════════════════════════════════════');

    // Initialize Google Sheets
    const authSuccess = await googleSheets.initializeAuth();
    if (!authSuccess) {
      throw new Error('Failed to initialize Google Sheets');
    }

    emailsSent = 0;
    emailsFailed = 0;

    // Get all leads
    info('\n📋 Pulling due leads from Google Sheet...');
    const leads = await googleSheets.getAllLeads();
    
    if (!leads || leads.length === 0) {
      info('No leads found in sheet');
      return;
    }

    // Filter leads that need emails today
    const today = new Date().toISOString().split('T')[0];
    const dueLeads = leads.filter(lead => {
      const nextActionDate = lead['Next Action Date'];
      const status = lead['Status'];
      
      // Skip if already replied, booked, won, or lost
      if (['Replied', 'Booked', 'Won', 'Lost'].includes(status)) {
        return false;
      }

      // Check if today is the action date
      return nextActionDate === today;
    });

    info(`Found ${dueLeads.length} leads due for email today`);

    if (dueLeads.length === 0) {
      info('No leads due for email today');
      return;
    }

    // Group by sequence day
    const bySequenceDay = {};
    dueLeads.forEach(lead => {
      const day = lead['Current Sequence Day'] || 1;
      if (!bySequenceDay[day]) {
        bySequenceDay[day] = [];
      }
      bySequenceDay[day].push(lead);
    });

    // Send emails for each sequence day
    for (const [sequenceDay, leadsForDay] of Object.entries(bySequenceDay)) {
      info(`\n📧 Sending Day ${sequenceDay} emails (${leadsForDay.length} leads)...`);

      for (const lead of leadsForDay) {
        try {
          await sendEmailForSequenceDay(lead, parseInt(sequenceDay));
          await randomDelay(1000, 2000);
        } catch (err) {
          error(`Error sending email to ${lead['Clinic Name']}: ${err.message}`);
          emailsFailed++;
        }
      }
    }

    info('\n✅ Worker 3 - Email Outreach complete');
    info(`Emails sent: ${emailsSent}, Failed: ${emailsFailed}`);
    
    await sendTelegramReport(emailsSent, emailsFailed);
  } catch (err) {
    error(`Fatal error in Worker 3: ${err.message}`);
    await telegram.sendAlert(`❌ Worker 3 Error: ${err.message}`).catch(e => {
      error(`Failed to send error alert: ${e.message}`);
    });
  }
}

/**
 * Send email for a specific sequence day
 */
async function sendEmailForSequenceDay(lead, sequenceDay) {
  try {
    const clinicName = lead['Clinic Name'];
    const email = lead['Direct Email'];

    if (!email) {
      warn(`No email found for ${clinicName}, skipping`);
      return;
    }

    info(`  📧 Sending Day ${sequenceDay} email to ${clinicName}...`);

    let emailContent = '';
    let nextDay = 4;
    let nextActionDate = null;
    const today = new Date();

    switch (sequenceDay) {
      case 1:
        emailContent = await emailGenerator.generateDay1Email(lead);
        nextDay = 4;
        break;
      case 4:
        emailContent = await emailGenerator.generateDay4Email(lead);
        nextDay = 9;
        break;
      case 9:
        emailContent = await emailGenerator.generateDay9Email(lead);
        nextDay = 14;
        break;
      case 14:
        emailContent = await emailGenerator.generateDay14Email(lead);
        nextDay = 75;
        break;
      case 75:
        emailContent = await emailGenerator.generateDay75Email(lead);
        nextDay = 14;
        break;
    }

    if (!emailContent) {
      throw new Error('Failed to generate email');
    }

    // Replace Calendly link placeholder
    emailContent = emailContent.replace('[CALENDLY_LINK]', config.calendly.url || 'https://calendly.com/your-link');

    // Send via Brevo
    const subject = `Updated: Dental Billing Solutions for ${lead['Clinic Name'] || 'Your Practice'}`;
    await brevo.sendPlainEmail(email, subject, emailContent);

    // Calculate next action date
    switch (sequenceDay) {
      case 1:
        nextActionDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
        break;
      case 4:
        nextActionDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days
        break;
      case 9:
        nextActionDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days
        break;
      case 14:
        nextActionDate = new Date(today.getTime() + 61 * 24 * 60 * 60 * 1000); // +61 days
        break;
      case 75:
        nextActionDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days
        break;
    }

    const nextActionDateStr = nextActionDate.toISOString().split('T')[0];

    // Update Google Sheet
    let newStatus = 'Contacted';
    if (sequenceDay === 14) {
      newStatus = 'Sequence Complete';
    } else if (sequenceDay === 75) {
      newStatus = 'Re-engaged';
    }

    await googleSheets.updateLeadStatus(clinicName, {
      status: newStatus,
      sequenceDay: nextDay,
      nextActionDate: nextActionDateStr,
      notes: `Day ${sequenceDay} email sent`
    });

    info(`  ✅ Email sent to ${email}`);
    emailsSent++;
  } catch (err) {
    error(`Error in sendEmailForSequenceDay: ${err.message}`);
    throw err;
  }
}

/**
 * Send completion report to Telegram
 */
async function sendTelegramReport(sent, failed) {
  try {
    let message = `📧 *Worker 3 Report*\n`;
    message += `Emails sent: ${sent}\n`;
    if (failed > 0) {
      message += `Failed: ${failed}\n`;
    }
    message += `Sequence day updates applied.`;

    await telegram.sendMessage(message);
  } catch (err) {
    error(`Failed to send Telegram report: ${err.message}`);
  }
}

/**
 * Initialize and run Worker 3
 */
async function initialize() {
  try {
    info('Initializing Worker 3 - Email Outreach Sequence...');
    await runWorker3();
  } catch (err) {
    error(`Worker 3 initialization failed: ${err.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  initialize().then(() => {
    info('Worker 3 completed, exiting...');
    setTimeout(() => process.exit(0), 2000);
  }).catch(err => {
    error(`Worker 3 failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  runWorker3,
  initialize,
};
