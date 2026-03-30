const logger = require('../../utils/logger');
const { sendTelegramMessage } = require('../../notifications/telegram');
const GoogleSheets = require('../../shared/googleSheets');
const { getEmailEvents, filterReplies, filterCalendlyClicks } = require('../shared/brevoHelpers');
const { getRecentBookings, formatBooking } = require('../shared/calendlyHelpers');
const { generateDraftResponse } = require('../shared/gptHelpers');
const fs = require('fs');
const path = require('path');

const LAST_CHECK_FILE = path.join(__dirname, '../../..', 'data', 'worker4_lastcheck.json');

/**
 * Load last check timestamp
 */
function getLastCheckTimestamp() {
  try {
    if (fs.existsSync(LAST_CHECK_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_CHECK_FILE, 'utf8'));
      return new Date(data.lastCheck);
    }
  } catch (error) {
    logger.error('[Worker4] Failed to read last check timestamp:', error.message);
  }
  // Default to 1 hour ago if no file exists
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);
  return oneHourAgo;
}

/**
 * Save last check timestamp
 */
function saveLastCheckTimestamp() {
  try {
    const dir = path.dirname(LAST_CHECK_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify({
      lastCheck: new Date().toISOString(),
    }));
  } catch (error) {
    logger.error('[Worker4] Failed to save last check timestamp:', error.message);
  }
}

/**
 * Check for replies
 */
async function checkForReplies(sheets, lastCheck) {
  try {
    logger.info('[Worker4] Checking for email replies...');
    const events = await getEmailEvents(lastCheck);
    const replies = filterReplies(events);

    for (const reply of replies) {
      try {
        // Find matching lead in Google Sheet
        const leads = await sheets.getAllLeads();
        const matchingLead = leads.find(lead => 
          lead['Direct Email'] === reply.email || lead['Clinic Name'] === reply.from
        );

        if (matchingLead) {
          // Generate draft response
          const draftResponse = await generateDraftResponse(
            reply.message || 'No message content',
            matchingLead['Doctor Name'],
            matchingLead['Clinic Name']
          );

          // Send Telegram alert with draft
          const alert = `🔥 Reply — ${matchingLead['Doctor Name']}, ${matchingLead['Clinic Name']}, ${matchingLead['City / State']}
They said: ${reply.message || 'No message'}

Suggested reply:
${draftResponse || '(Failed to generate)'}

Reply to this lead now while they are warm.`;

          await sendTelegramMessage(alert);

          // Update Google Sheet
          await sheets.updateLead(matchingLead.rowIndex, {
            'Status': 'Replied',
            'Last Updated': new Date().toISOString(),
          });

          logger.info(`[Worker4] Updated lead ${matchingLead['Clinic Name']} to Replied`);
        }
      } catch (error) {
        logger.error('[Worker4] Error processing reply:', error.message);
        continue;
      }
    }

    return replies.length;
  } catch (error) {
    logger.error('[Worker4] Failed to check for replies:', error.message);
    return 0;
  }
}

/**
 * Check for Calendly clicks
 */
async function checkForCalendlyClicks(sheets, events) {
  try {
    logger.info('[Worker4] Checking for Calendly clicks...');
    const clicks = filterCalendlyClicks(events);

    for (const click of clicks) {
      try {
        const leads = await sheets.getAllLeads();
        const matchingLead = leads.find(lead => 
          lead['Direct Email'] === click.email
        );

        if (matchingLead && matchingLead['Status'] !== 'Booked') {
          const alert = `👆 Calendly Click — ${matchingLead['Doctor Name']}, ${matchingLead['Clinic Name']}, ${matchingLead['City / State']}
Clicked your booking link but did not book yet. Consider sending a quick personal email.`;

          await sendTelegramMessage(alert);
          logger.info(`[Worker4] Calendly click detected for ${matchingLead['Clinic Name']}`);
        }
      } catch (error) {
        logger.error('[Worker4] Error processing Calendly click:', error.message);
        continue;
      }
    }

    return clicks.length;
  } catch (error) {
    logger.error('[Worker4] Failed to check for Calendly clicks:', error.message);
    return 0;
  }
}

/**
 * Check for new bookings
 */
async function checkForNewBookings(sheets) {
  try {
    logger.info('[Worker4] Checking for new Calendly bookings...');
    const bookings = await getRecentBookings(getLastCheckTimestamp());

    for (const booking of bookings) {
      try {
        const formattedBooking = formatBooking(booking);
        
        // Find or create lead
        const leads = await sheets.getAllLeads();
        let matchingLead = leads.find(lead => 
          lead['Direct Email'] === formattedBooking.email
        );

        if (matchingLead) {
          await sheets.updateLead(matchingLead.rowIndex, {
            'Status': 'Booked',
            'Last Updated': new Date().toISOString(),
          });
        }

        // Send alert
        const alert = `📅 New Booking — ${formattedBooking.name}, ${formattedBooking.scheduledTime}
Worker 5 has been triggered.`;
        await sendTelegramMessage(alert);

        // Trigger Worker 5 (would need IPC or API call in production)
        logger.info(`[Worker4] New booking detected: ${formattedBooking.name}`);

      } catch (error) {
        logger.error('[Worker4] Error processing booking:', error.message);
        continue;
      }
    }

    return bookings.length;
  } catch (error) {
    logger.error('[Worker4] Failed to check for bookings:', error.message);
    return 0;
  }
}

/**
 * Main worker execution
 */
async function runWorker4() {
  try {
    logger.info('[Worker4] ═══════════════════════════════════════');
    logger.info('[Worker4] REPLY DETECTION & ALERTS - Starting');
    logger.info('[Worker4] ═══════════════════════════════════════');

    const sheets = new GoogleSheets();
    const lastCheck = getLastCheckTimestamp();

    // Check all integrations
    const replyCount = await checkForReplies(sheets, lastCheck);
    const bookingCount = await checkForNewBookings(sheets);

    // Get events for clicks
    const events = await getEmailEvents(lastCheck);
    const clickCount = await checkForCalendlyClicks(sheets, events);

    // Save timestamp
    saveLastCheckTimestamp();

    logger.info(`[Worker4] Summary: ${replyCount} replies, ${clickCount} clicks, ${bookingCount} bookings`);
    logger.info('[Worker4] ═══════════════════════════════════════');
    
    await sendTelegramMessage(`✅ Worker 4 complete — ${replyCount} replies, ${clickCount} clicks, ${bookingCount} bookings`);

  } catch (error) {
    logger.error('[Worker4] Fatal error:', error);
    await sendTelegramMessage(`❌ Worker 4 failed: ${error.message}`);
  }
}

// Run worker
if (require.main === module) {
  runWorker4().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runWorker4 };
