

require('dotenv').config();

const config = {
  facebook: {
    email: process.env.FACEBOOK_EMAIL,
    password: process.env.FACEBOOK_PASSWORD,
    groupUrl: process.env.FACEBOOK_GROUP_URL,
    headless: process.env.BOT_HEADLESS !== 'false',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  bot: {
    checkIntervalMinutes: parseInt(process.env.BOT_CHECK_INTERVAL_MINUTES || '5', 10),
    maxPostsPerCheck: parseInt(process.env.BOT_MAX_POSTS_PER_CHECK || '10', 10),
    relevantPostThreshold: parseFloat(process.env.BOT_RELEVANT_POST_THRESHOLD || '0.7'),
  },
  delays: {
    minMs: parseInt(process.env.MIN_DELAY_MS || '1500', 10),
    maxMs: parseInt(process.env.MAX_DELAY_MS || '5000', 10),
    postActionDelayMs: parseInt(process.env.POST_ACTION_DELAY_MS || '2000', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '7d',
    logDir: './logs',
  },

  // Excel Output Configuration
  excel: {
    filePath: process.env.EXCEL_FILE_PATH || './data/leads.xlsx',
    autoSave: process.env.EXCEL_AUTO_SAVE === 'true',
  },

  // Google Sheets Configuration (for Workers)
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  },

  // Calendly Configuration
  calendly: {
    url: process.env.CALENDLY_URL,
  },

  // Brevo Email Configuration
  brevo: {
    apiKey: process.env.BREVO_API_KEY,
  },

  // Environment
  env: process.env.NODE_ENV || 'production',
};

/**
 * Validates that all required configuration values are present
 * Throws an error if any critical configuration is missing
 */
function validateConfig() {
  const requiredFields = [
    { path: 'facebook.email', value: config.facebook.email },
    { path: 'facebook.password', value: config.facebook.password },
    { path: 'facebook.groupUrl', value: config.facebook.groupUrl },
    { path: 'openai.apiKey', value: config.openai.apiKey },
    { path: 'telegram.botToken', value: config.telegram.botToken },
    { path: 'telegram.chatId', value: config.telegram.chatId },
  ];

  const missingFields = requiredFields.filter(field => !field.value);

  if (missingFields.length > 0) {
    const fieldNames = missingFields.map(f => f.path).join(', ');
    throw new Error(`Missing required configuration: ${fieldNames}`);
  }
}

// Validate configuration on import
try {
  validateConfig();
  console.log(`[${new Date().toISOString()}] ✓ Configuration loaded successfully (Environment: ${config.env})`);
} catch (error) {
  console.error(`[${new Date().toISOString()}] ✗ Configuration Error: ${error.message}`);
  console.error('Please ensure all required variables are set in .env file');
  process.exit(1);
}

module.exports = config;
