const logger = require('../../utils/logger');
const { sendTelegramMessage } = require('../../notifications/telegram');
const GoogleSheets = require('../../shared/googleSheets');
const { sendEmail } = require('../shared/brevoHelpers');
const { 
  generateConfirmationEmail, 
  generateReminderEmail, 
  generatePostCallFollowUp, 
  generateClinicBrief 
} = require('../shared/gptHelpers');
const fs = require('fs');
const path = require('path');

const ACTIVE_BOOKINGS_FILE = path.join(__dirname, '../../..', 'data', 'worker5_bookings.json');
const CALENDLY_LINK = process.env.CALENDLY_LINK;

/**
 * Load active bookings
 */
function getActiveBookings() {
  try {
    if (fs.existsSync(ACTIVE_BOOKINGS_FILE)) {
      return JSON.parse(fs.readFileSync(ACTIVE_BOOKINGS_FILE, 'utf8'));
    }
  } catch (error) {
    logger.error('[Worker5] Failed to load bookings:', error.message);
  }
  return {};
}

/**
 * Save active bookings
 */
function saveActiveBookings(bookings) {
  try {
    const dir = path.dirname(ACTIVE_BOOKINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ACTIVE_BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
  } catch (error) {
    logger.error('[Worker5] Failed to save bookings:', error.message);
  }
}

/**
 * Process new booking
 */
async function processNewBooking(booking, sheets) {
  try {
    logger.info(`[Worker5] Processing booking: ${booking.name}`);

    // Step 1: Send confirmation email
    const confirmationEmail = await generateConfirmationEmail(
      booking.name,
      new Date(booking.scheduledTime).toLocaleString()
    );

    if (confirmationEmail) {
      const emailWithLink = confirmationEmail.replace('[CALENDLY LINK]', CALENDLY_LINK);
      await sendEmail(
        booking.email,
        'Booking Confirmation - Haris at Dental Billing Aid',
        emailWithLink,
        emailWithLink
      );
    }

    // Step 2: Generate clinic research brief
    let clinicBrief = 'No research data available';
    const leads = await sheets.getAllLeads();
    const matchingLead = leads.find(lead => lead['Direct Email'] === booking.email);

    if (matchingLead) {
      clinicBrief = await generateClinicBrief(
        matchingLead['Clinic Name'],
        matchingLead['City / State'],
        matchingLead['Notes'] || ''
      );
    }

    // Send pre-call brief to Haris
    const briefMessage = `📋 Pre-Call Brief — ${booking.name}, ${new Date(booking.scheduledTime).toLocaleString()}
${matchingLead ? matchingLead['Clinic Name'] + ', ' + matchingLead['City / State'] : 'Clinic name not found'}

${clinicBrief}

Suggested talking point: Ask about their current billing process and pain points`;

    await sendTelegramMessage(briefMessage);

    // Schedule 24-hour reminder
    const bookingId = `${booking.email}_${new Date(booking.scheduledTime).getTime()}`;
    const bookings = getActiveBookings();
    bookings[bookingId] = {
      ...booking,
      createdAt: new Date().toISOString(),
      reminderSentAt: null,
      postCallDraftSentAt: null,
    };
    saveActiveBookings(bookings);

    logger.info(`[Worker5] Booking processed and scheduled: ${bookingId}`);
    await sendTelegramMessage(`✅ Booking confirmed for ${booking.name}. Reminders scheduled.`);

  } catch (error) {
    logger.error('[Worker5] Error processing booking:', error.message);
  }
}

/**
 * Check and send 24-hour reminders
 */
async function checkAndSendReminders() {
  try {
    const bookings = getActiveBookings();
    const now = new Date();

    for (const [bookingId, booking] of Object.entries(bookings)) {
      try {
        const callTime = new Date(booking.scheduledTime);
        const timeDiff = callTime - now;
        const hoursUntilCall = timeDiff / (1000 * 60 * 60);

        // Send reminder if 24 hours before and not yet sent
        if (hoursUntilCall <= 24 && hoursUntilCall > 23 && !booking.reminderSentAt) {
          const reminderEmail = await generateReminderEmail(
            booking.name,
            callTime.toLocaleTimeString()
          );

          if (reminderEmail) {
            const emailWithLink = reminderEmail.replace('[CALENDLY LINK]', CALENDLY_LINK);
            await sendEmail(
              booking.email,
              'Reminder: Your Discovery Call Tomorrow',
              emailWithLink,
              emailWithLink
            );

            booking.reminderSentAt = new Date().toISOString();
            saveActiveBookings(bookings);
            logger.info(`[Worker5] 24-hour reminder sent for ${booking.name}`);
          }
        }

        // Check for no-show 30 minutes after call time
        if (timeDiff < -30 * 60 * 1000 && timeDiff > -35 * 60 * 1000) {
          const noShowAlert = `📵 Did ${booking.name} attend the call at ${callTime.toLocaleTimeString()}?
Reply YES or NO`;
          await sendTelegramMessage(noShowAlert);
          booking.noShowCheckSentAt = new Date().toISOString();
          saveActiveBookings(bookings);
        }

      } catch (error) {
        logger.error('[Worker5] Error processing reminder for booking:', error.message);
        continue;
      }
    }
  } catch (error) {
    logger.error('[Worker5] Error checking reminders:', error.message);
  }
}

/**
 * Check and send post-call follow ups
 */
async function checkAndSendPostCallFollowUps(sheets) {
  try {
    const bookings = getActiveBookings();
    const now = new Date();

    for (const [bookingId, booking] of Object.entries(bookings)) {
      try {
        const callTime = new Date(booking.scheduledTime);
        const callCompletedTime = new Date(booking.callCompletedAt || booking.scheduledTime);
        const timeSinceCall = now - callCompletedTime;
        const hoursSinceCall = timeSinceCall / (1000 * 60 * 60);

        // Send 24 hours after call confirmation
        if (hoursSinceCall >= 24 && !booking.postCallDraftSentAt && booking.callCompletedAt) {
          const leads = await sheets.getAllLeads();
          const matchingLead = leads.find(lead => lead['Direct Email'] === booking.email);

          if (matchingLead) {
            const postCallEmail = await generatePostCallFollowUp(
              matchingLead['Doctor Name'],
              matchingLead['Clinic Name']
            );

            if (postCallEmail) {
              const emailWithLink = postCallEmail.replace('[CALENDLY LINK]', CALENDLY_LINK);
              
              const draftAlert = `📧 Post-Call Follow Up Draft — ${matchingLead['Doctor Name']}

${emailWithLink}

Reply SEND to send this or EDIT followed by your changes`;

              await sendTelegramMessage(draftAlert);
              booking.postCallDraftSentAt = new Date().toISOString();
              saveActiveBookings(bookings);
              logger.info(`[Worker5] Post-call follow up draft sent for ${booking.name}`);
            }
          }
        }

      } catch (error) {
        logger.error('[Worker5] Error processing post-call follow up:', error.message);
        continue;
      }
    }
  } catch (error) {
    logger.error('[Worker5] Error checking post-call follow ups:', error.message);
  }
}

/**
 * Main worker execution (scheduled checks)
 */
async function runWorker5Checks() {
  try {
    logger.info('[Worker5] ═══════════════════════════════════════');
    logger.info('[Worker5] BOOKING MANAGEMENT - Checking reminders');
    logger.info('[Worker5] ═══════════════════════════════════════');

    const sheets = new GoogleSheets();
    
    await checkAndSendReminders();
    await checkAndSendPostCallFollowUps(sheets);

    logger.info('[Worker5] ═══════════════════════════════════════');
  } catch (error) {
    logger.error('[Worker5] Fatal error in checks:', error);
  }
}

// Run periodic checks
if (require.main === module) {
  // Run checks every 5 minutes
  setInterval(() => {
    runWorker5Checks().catch(err => logger.error('[Worker5]', err));
  }, 5 * 60 * 1000);

  runWorker5Checks().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { processNewBooking, runWorker5Checks };
