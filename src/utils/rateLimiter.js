/**
 * Rate Limiter Utility
 * Tracks and enforces rate limits for API calls and bot actions
 * Example: Max 10 comments per hour
 */

const { info, warn } = require('./logger');

/**
 * Rate limiter class for tracking and limiting actions
 */
class RateLimiter {
  /**
   * @param {number} maxActions - Maximum number of actions allowed
   * @param {number} windowMs - Time window in milliseconds
   * @param {string} name - Name of this rate limiter (for logging)
   */
  constructor(maxActions, windowMs, name = 'RateLimiter') {
    this.maxActions = maxActions;
    this.windowMs = windowMs;
    this.name = name;
    this.timestamps = [];
  }

  /**
   * Check if an action is allowed and record it
   * @returns {Object} { allowed: boolean, remainingActions: number, resetIn: timeInMs }
   */
  isAllowed() {
    const now = Date.now();

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(timestamp => now - timestamp < this.windowMs);

    // Check if we have room for another action
    const allowed = this.timestamps.length < this.maxActions;

    if (allowed) {
      this.timestamps.push(now);
      const remaining = this.maxActions - this.timestamps.length;
      info(`[${this.name}] Action allowed. Remaining: ${remaining}/${this.maxActions}`);
      return {
        allowed: true,
        remainingActions: remaining,
        resetIn: this.getResetTime(),
      };
    } else {
      const oldestTimestamp = this.timestamps[0];
      const resetTime = oldestTimestamp + this.windowMs - now;
      warn(
        `[${this.name}] Rate limit reached (${this.maxActions}/${this.maxActions}). Reset in ${Math.ceil(resetTime / 1000)}s`
      );
      return {
        allowed: false,
        remainingActions: 0,
        resetIn: resetTime,
      };
    }
  }

  /**
   * Get the time until the rate limit resets (ms)
   * @returns {number} Time in milliseconds until reset
   */
  getResetTime() {
    if (this.timestamps.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestTimestamp = this.timestamps[0];
    const resetTime = oldestTimestamp + this.windowMs - now;

    return Math.max(0, resetTime);
  }

  /**
   * Get remaining actions before hitting the limit
   * @returns {number} Number of actions remaining
   */
  getRemainingActions() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(timestamp => now - timestamp < this.windowMs);
    return Math.max(0, this.maxActions - this.timestamps.length);
  }

  /**
   * Get the current action count in the time window
   * @returns {number} Current action count
   */
  getActionCount() {
    const now = Date.now();
    return this.timestamps.filter(timestamp => now - timestamp < this.windowMs).length;
  }

  /**
   * Reset the limiter
   */
  reset() {
    this.timestamps = [];
    info(`[${this.name}] Rate limiter reset`);
  }
}

/**
 * Create a rate limiter for comments (max 10 per hour)
 * @returns {RateLimiter} Rate limiter instance
 */
function createCommentLimiter() {
  return new RateLimiter(10, 60 * 60 * 1000, 'CommentRateLimiter'); // 10 actions per hour
}

/**
 * Create a rate limiter for GPT API calls (max 30 per minute)
 * @returns {RateLimiter} Rate limiter instance
 */
function createGPTRateLimiter() {
  return new RateLimiter(30, 60 * 1000, 'GPTRateLimiter'); // 30 API calls per minute
}

/**
 * Create a generic rate limiter
 * @param {number} maxActions - Max actions
 * @param {number} windowMs - Time window in ms
 * @param {string} name - Limiter name
 * @returns {RateLimiter} Rate limiter instance
 */
function createRateLimiter(maxActions, windowMs, name) {
  return new RateLimiter(maxActions, windowMs, name);
}

module.exports = {
  RateLimiter,
  createCommentLimiter,
  createGPTRateLimiter,
  createRateLimiter,
};
