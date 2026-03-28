/**
 * Logger Utility Module
 * Provides centralized logging with daily rotation using Winston
 * Logs are stored in the ./logs directory with automatic cleanup after 7 days
 */

const winston = require('winston');
const path = require('path');
const config = require('../../config/config');

// Create logs directory path
const logsDir = config.logging.logDir;

/**
 * Custom format for console output with timestamps and colors
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] ${level}: ${message}`;
  })
);

/**
 * Custom format for file output with more detailed information
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`;
    }
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

/**
 * Create a Winston logger instance
 * Logs to both console and files
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: fileFormat,
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, 'bot.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 7, // Keep 7 days of logs
    }),

    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 7, // Keep 7 days of logs
    }),

    // Daily rotating log file
    new (require('winston-daily-rotate-file'))({
      filename: path.join(logsDir, 'daily-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxDays: '7d',
      format: fileFormat,
    }),
  ],
});

/**
 * Add a simple file transport if daily rotate file is not available
 * Fallback for environments where the daily-rotate-file might not be installed
 */
if (logger.transports.length < 4) {
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 7,
    })
  );
}

/**
 * Logs an info level message
 * @param {string} message - The message to log
 */
function info(message) {
  logger.info(message);
}

/**
 * Logs a warning level message
 * @param {string} message - The message to log
 */
function warn(message) {
  logger.warn(message);
}

/**
 * Logs an error level message
 * @param {string} message - The message to log
 * @param {Error} error - Optional error object with stack trace
 */
function error(message, error = null) {
  if (error && error.stack) {
    logger.error(`${message}\n${error.stack}`);
  } else {
    logger.error(message);
  }
}

/**
 * Logs a debug level message (only in development)
 * @param {string} message - The message to log
 */
function debug(message) {
  logger.debug(message);
}

/**
 * Logs an action with timestamp for tracking bot behavior
 * @param {string} action - Description of the action performed
 * @param {object} details - Optional details object to log
 */
function logAction(action, details = null) {
  const timestamp = new Date().toISOString();
  let message = `[ACTION] ${action}`;
  if (details) {
    message += ` | ${JSON.stringify(details)}`;
  }
  logger.info(message);
}

module.exports = {
  logger,
  info,
  warn,
  error,
  debug,
  logAction,
};
