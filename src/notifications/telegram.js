/**
 * Telegram Notifications Module
 * Sends real-time alerts via Telegram when leads are found
 * Includes daily summaries and error notifications
 */

const TelegramBot = require('node-telegram-bot-api');
const config = require('../../config/config');
const { info, error, warn, logAction, debug } = require('../utils/logger');

// Initialize Telegram bot
let bot = null;
let botInitialized = false;
let uptime = null; // Track bot uptime

/**
 * Initializes the Telegram bot connection
 * @returns {Promise<boolean>} True if successful
 */
async function initializeTelegram() {
  try {
    if (botInitialized && bot) {
      debug('Telegram bot already initialized');
      return true;
    }

    logAction('Initializing Telegram bot', { chatId: config.telegram.chatId });

    // Create bot instance
    bot = new TelegramBot(config.telegram.botToken, {
      polling: false, // We don't need polling for sending messages
      timeout: 10000,
    });

    info(`✓ Telegram bot initialized`);
    botInitialized = true;

    return true;
  } catch (err) {
    error(`Failed to initialize Telegram bot: ${err.message}`, err);
    return false;
  }
}

/**
 * Sends a new lead alert via Telegram
 * Formatted message with all lead details
 * 
 * @param {Object} leadData - Lead information
 * @param {string} leadData.dentistName - Dentist name
 * @param {string} leadData.practiceName - Practice name
 * @param {string} leadData.location - Practice location
 * @param {string} leadData.websiteUrl - Practice website
 * @param {string} leadData.commentPosted - Comment that was posted
 * @param {number} todayCount - Total leads found today
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendNewLeadAlert(leadData, todayCount = 1) {
  try {
    if (!botInitialized || !bot) {
      const initialized = await initializeTelegram();
      if (!initialized) {
        return false;
      }
    }

    logAction('Sending new lead alert via Telegram', {
      dentistName: leadData.dentistName,
      practiceName: leadData.practiceName,
    });

    // Format the message
    let message = '🦷 <b>NEW DENTAL LEAD FOUND!</b>\n\n';

    message += `👤 <b>Name:</b> ${leadData.dentistName || 'Unknown'}\n`;
    message += `🏥 <b>Practice:</b> ${leadData.practiceName || 'Unknown'}\n`;
    message += `📍 <b>Location:</b> ${leadData.location || 'Not specified'}\n`;

    if (leadData.websiteUrl) {
      message += `🌐 <b>Website:</b> ${leadData.websiteUrl}\n`;
    }

    message += `\n💬 <b>Our Comment:</b>\n"${leadData.commentPosted || 'N/A'}"\n`;

    const timestamp = new Date().toLocaleString('en-US');
    message += `\n🕐 <b>Found at:</b> ${timestamp}\n`;

    message += `📊 <b>Total leads today:</b> ${todayCount}\n`;

    // Send message
    await bot.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

    info(`✅ Telegram alert sent: ${leadData.dentistName} - ${leadData.practiceName}`);
    return true;
  } catch (err) {
    error(`Failed to send new lead alert: ${err.message}`, err);
    return false;
  }
}

/**
 * Sends a daily summary of bot activity
 * Should be called once per day at 8:00 AM
 * 
 * @param {Object} stats - Statistics object
 * @param {number} stats.todayLeads - Leads found today
 * @param {number} stats.commentsPosted - Comments posted today
 * @param {number} stats.postsSkipped - Posts marked as not relevant
 * @param {number} stats.totalProcessed - Total posts processed
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendDailySummary(stats) {
  try {
    if (!botInitialized || !bot) {
      const initialized = await initializeTelegram();
      if (!initialized) {
        return false;
      }
    }

    logAction('Sending daily summary via Telegram', stats);

    // Calculate uptime
    let uptimeStr = 'Just started';
    if (uptime) {
      const hours = Math.floor((Date.now() - uptime) / 3600000);
      const minutes = Math.floor(((Date.now() - uptime) % 3600000) / 60000);
      uptimeStr = `${hours}h ${minutes}m`;
    }

    // Format the message
    let message = '📈 <b>DAILY SUMMARY</b>\n\n';

    message += `📅 <b>Date:</b> ${new Date().toLocaleDateString('en-US')}\n\n`;

    message += `✅ <b>New leads found:</b> ${stats.todayLeads || 0}\n`;
    message += `💬 <b>Comments posted:</b> ${stats.commentsPosted || 0}\n`;
    message += `⏭️ <b>Posts skipped:</b> ${stats.postsSkipped || 0}\n`;
    message += `📊 <b>Total posts processed:</b> ${stats.totalProcessed || 0}\n`;

    message += `\n⏱️ <b>Bot running since:</b> ${uptimeStr}\n`;
    message += `🤖 <b>Status:</b> 🟢 ACTIVE\n`;

    // Send message
    await bot.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
    });

    info(`✅ Daily summary sent to Telegram`);
    return true;
  } catch (err) {
    error(`Failed to send daily summary: ${err.message}`, err);
    return false;
  }
}

/**
 * Sends an error alert via Telegram
 * Used for bot crashes or critical errors
 * 
 * @param {string} errorMessage - Error message to send
 * @param {Error} errorObj - Optional error object with stack trace
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendErrorAlert(errorMessage, errorObj = null) {
  try {
    if (!botInitialized || !bot) {
      const initialized = await initializeTelegram();
      if (!initialized) {
        return false;
      }
    }

    logAction('Sending error alert via Telegram', { errorMessage });

    // Format the message
    let message = '⚠️ <b>BOT ERROR ALERT</b>\n\n';

    message += `🚨 <b>Error:</b> ${errorMessage}\n`;

    if (errorObj && errorObj.message) {
      message += `📝 <b>Details:</b> ${errorObj.message}\n`;

      if (errorObj.stack) {
        const stackLines = errorObj.stack.split('\n').slice(0, 3);
        message += `\n<code>${stackLines.join('\n')}</code>\n`;
      }
    }

    const timestamp = new Date().toLocaleString('en-US');
    message += `\n🕐 <b>Timestamp:</b> ${timestamp}\n`;

    message += `\n⚙️ <b>Action:</b> Check logs and restart if needed.\n`;

    // Send message with HTML formatting
    await bot.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
    });

    info(`⚠️ Error alert sent to Telegram: ${errorMessage}`);
    return true;
  } catch (err) {
    error(`Failed to send error alert: ${err.message}`, err);
    return false;
  }
}

/**
 * Sends a startup notification
 * Should be called when bot starts
 * 
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendStartupNotification() {
  try {
    if (!botInitialized || !bot) {
      const initialized = await initializeTelegram();
      if (!initialized) {
        return false;
      }
    }

    logAction('Sending startup notification via Telegram');

    // Set uptime to now
    uptime = Date.now();

    const timestamp = new Date().toLocaleString('en-US');

    const message =
      `✅ <b>BOT IS LIVE!</b>\n\n` +
      `🤖 Dental Lead Generation Bot has started\n` +
      `🕐 Started at: ${timestamp}\n` +
      `📍 Monitoring group: ${process.env.FACEBOOK_GROUP_URL || 'Configured group'}\n` +
      `⏱️ Check interval: ${process.env.BOT_CHECK_INTERVAL_MINUTES || '5'} minutes\n\n` +
      `🟢 Bot is now actively monitoring and collecting leads...`;

    await bot.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
    });

    info(`✅ Startup notification sent to Telegram`);
    return true;
  } catch (err) {
    error(`Failed to send startup notification: ${err.message}`, err);
    return false;
  }
}

/**
 * Sends a shutdown notification
 * Should be called when bot is shutting down
 * 
 * @returns {Promise<boolean>} True if sent successfully
 */
async function sendShutdownNotification() {
  try {
    if (!botInitialized || !bot) {
      return true; // Can't send if not initialized, but don't error out
    }

    logAction('Sending shutdown notification via Telegram');

    const timestamp = new Date().toLocaleString('en-US');

    const message =
      `🛑 <b>BOT SHUTTING DOWN</b>\n\n` +
      `Dental Lead Generation Bot is stopping\n` +
      `Stopped at: ${timestamp}\n\n` +
      `No new leads will be collected until bot restarts.\n`;

    await bot.sendMessage(config.telegram.chatId, message, {
      parse_mode: 'HTML',
    });

    info(`Shutdown notification sent to Telegram`);
    return true;
  } catch (err) {
    error(`Failed to send shutdown notification: ${err.message}`, err);
    return false;
  }
}

/**
 * Gets the current Telegram bot instance
 * @returns {TelegramBot} Bot instance
 */
function getBot() {
  return bot;
}

/**
 * Tests the Telegram connection
 * @returns {Promise<boolean>} True if connection works
 */
async function testConnection() {
  try {
    logAction('Testing Telegram connection');

    const initialized = await initializeTelegram();
    if (!initialized) {
      return false;
    }

    // Try to get bot info
    const botInfo = await bot.getMe();
    info(`✓ Telegram connection successful: ${botInfo.username}`);
    return true;
  } catch (err) {
    error(`Telegram connection failed: ${err.message}`, err);
    return false;
  }
}

/**
 * Send a generic message via Telegram
 */
async function sendMessage(text) {
  try {
    if (!botInitialized || !bot) {
      const initialized = await initializeTelegram();
      if (!initialized) {
        return false;
      }
    }

    await bot.sendMessage(config.telegram.chatId, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    return true;
  } catch (err) {
    error(`Failed to send message: ${err.message}`);
    return false;
  }
}

/**
 * Send an alert message via Telegram
 */
async function sendAlert(text) {
  return sendMessage(`🚨 *Alert*: ${text}`);
}

module.exports = {
  initializeTelegram,
  sendNewLeadAlert,
  sendDailySummary,
  sendErrorAlert,
  sendStartupNotification,
  sendShutdownNotification,
  testConnection,
  getBot,
  sendMessage,
  sendAlert,
};
