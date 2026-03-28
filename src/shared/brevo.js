/**
 * Brevo Email Service
 * Sends emails via Brevo API
 */

const https = require('https');
const config = require('../../config/config');
const { info, error, warn, logAction, debug } = require('../utils/logger');

/**
 * Send email via Brevo API
 */
async function sendEmail(toEmail, subject, htmlContent, textContent) {
  return new Promise((resolve, reject) => {
    try {
      if (!config.brevo.apiKey) {
        error('Brevo API key not configured');
        return reject(new Error('Brevo API key not configured'));
      }

      const emailData = {
        sender: {
          email: 'haris@dentalbillingaid.com',
          name: 'Haris - Dental Billing Aid'
        },
        to: [{
          email: toEmail
        }],
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent || htmlContent.replace(/<[^>]*>/g, '')
      };

      const postData = JSON.stringify(emailData);

      const options = {
        hostname: 'api.brevo.com',
        path: '/v3/smtp/email',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length,
          'api-key': config.brevo.apiKey
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logAction('Email sent successfully', { to: toEmail, subject });
            resolve(true);
          } else {
            error(`Brevo API error: ${res.statusCode} - ${responseData}`);
            reject(new Error(`Brevo API error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        error(`Email sending failed: ${err.message}`);
        reject(err);
      });

      req.write(postData);
      req.end();
    } catch (err) {
      error(`Error sending email: ${err.message}`);
      reject(err);
    }
  });
}

/**
 * Send plain text email
 */
async function sendPlainEmail(toEmail, subject, plainText) {
  const htmlContent = `<p>${plainText.replace(/\n/g, '<br>')}</p>`;
  return sendEmail(toEmail, subject, htmlContent, plainText);
}

module.exports = {
  sendEmail,
  sendPlainEmail
};
