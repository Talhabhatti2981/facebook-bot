const axios = require('axios');
const logger = require('../../utils/logger');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_BASE_URL = 'https://api.brevo.com/v3';

/**
 * Get email events since last check timestamp
 */
async function getEmailEvents(sinceTimestamp) {
  try {
    const response = await axios.get(`${BREVO_BASE_URL}/smtp/statistics/events`, {
      headers: {
        'api-key': BREVO_API_KEY,
      },
      params: {
        startDate: new Date(sinceTimestamp).toISOString().split('T')[0],
        limit: 100,
      },
    });

    return response.data.events || [];
  } catch (error) {
    logger.error('[Brevo] Failed to get email events:', error.message);
    return [];
  }
}

/**
 * Send email via Brevo
 */
async function sendEmail(to, subject, htmlContent, textContent) {
  try {
    const response = await axios.post(`${BREVO_BASE_URL}/smtp/email`, {
      to: [{ email: to }],
      subject: subject,
      htmlContent: htmlContent,
      textContent: textContent,
      sender: {
        name: 'Haris',
        email: process.env.BREVO_SENDER_EMAIL || 'noreply@dentalbillingaid.com',
      },
    }, {
      headers: {
        'api-key': BREVO_API_KEY,
      },
    });

    logger.info(`[Brevo] Email sent to ${to}`);
    return { success: true, messageId: response.data.messageId };
  } catch (error) {
    logger.error(`[Brevo] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get replies from email events
 */
function filterReplies(events) {
  return events.filter(event => event.event === 'reply' || event.event === 'soft_bounce');
}

/**
 * Get Calendly link clicks from events
 */
function filterCalendlyClicks(events) {
  return events.filter(event => 
    event.event === 'click' && 
    event.link && 
    event.link.includes('calendly')
  );
}

module.exports = {
  getEmailEvents,
  sendEmail,
  filterReplies,
  filterCalendlyClicks,
};
