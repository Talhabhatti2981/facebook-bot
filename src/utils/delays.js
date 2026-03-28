/**
 * Delays Utility Module
 * Provides random delay functions to avoid Facebook detection and rate limiting
 * All actions must be spaced out with realistic human-like delays
 */

const config = require('../../config/config');

/**
 * Returns a random delay between min and max milliseconds
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} Random delay value
 */
function getRandomDelay(min = config.delays.minMs, max = config.delays.maxMs) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pauses execution for a random amount of time
 * Used between actions to avoid bot detection
 * @param {number} min - Minimum delay in milliseconds (optional)
 * @param {number} max - Maximum delay in milliseconds (optional)
 * @returns {Promise<void>}
 */
async function randomDelay(min = config.delays.minMs, max = config.delays.maxMs) {
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Pauses execution for a post-action delay
 * Used specifically after important actions like clicking, typing, or scrolling
 * @returns {Promise<void>}
 */
async function postActionDelay() {
  const delay = getRandomDelay(
    config.delays.postActionDelayMs * 0.7,
    config.delays.postActionDelayMs * 1.5
  );
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Applies a longer delay before checking for new posts
 * Simulates more human-like checking behavior
 * @returns {Promise<void>}
 */
async function longDelay() {
  const min = config.delays.maxMs * 2;
  const max = config.delays.maxMs * 4;
  const delay = getRandomDelay(min, max);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Applies a very short delay for rapid actions within a sequence
 * Used between consecutive clicks or form inputs
 * @returns {Promise<void>}
 */
async function shortDelay() {
  const delay = getRandomDelay(800, 1200);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Returns a random user agent string to avoid detection
 * Rotates between common browser user agents
 * @returns {string} Random user agent string
 */
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];

  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = {
  getRandomDelay,
  randomDelay,
  postActionDelay,
  longDelay,
  shortDelay,
  getRandomUserAgent,
};
