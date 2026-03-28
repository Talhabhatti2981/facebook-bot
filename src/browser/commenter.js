/**
 * Facebook Auto-Commenter Module
 * Handles posting comments on Facebook group posts
 * Uses Playwright for browser automation with human-like behavior
 */

const { randomDelay, getRandomDelay } = require('../utils/delays');
const { info, error, warn, logAction } = require('../utils/logger');
const { createCommentLimiter } = require('../utils/rateLimiter');

// Initialize rate limiter for comments (max 10 per hour)
const commentLimiter = createCommentLimiter();

/**
 * Types text with human-like speed and randomness
 * Simulates a real person typing by adding random delays between characters
 * 
 * @param {Page} page - Playwright page instance
 * @param {string} selector - CSS selector of the input field
 * @param {string} text - Text to type
 * @returns {Promise<void>}
 */
async function typeWithHumanSpeed(page, selector, text) {
  try {
    // Wait for the input field to be ready
    await page.waitForSelector(selector, { timeout: 5000 });

    // Focus on the input field
    await page.locator(selector).focus();
    await randomDelay(200, 500);

    // Type character by character with random delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Type the character
      await page.keyboard.type(char);

      // Add random delay between characters (30-150ms)
      const charDelay = getRandomDelay(30, 150);
      await new Promise(resolve => setTimeout(resolve, charDelay));

      // Occasionally add longer pauses (simulating thinking)
      if (Math.random() < 0.05) {
        await randomDelay(200, 800);
      }
    }

    logAction('Text typed with human-like speed', { textLength: text.length });
  } catch (err) {
    error(`Error typing with human speed: ${err.message}`, err);
    throw err;
  }
}

/**
 * Finds a post on the page by its ID or by searching for text
 * 
 * @param {Page} page - Playwright page instance
 * @param {string} postId - The post ID to find
 * @returns {Promise<Object>} Post element or null if not found
 */
async function findPostOnPage(page, postId) {
  try {
    logAction('Searching for post on page', { postId });

    // Try to find post by ID
    const postSelector = `[data-id="${postId}"], article[id="${postId}"], [data-fid="${postId}"], article:has-text("${postId}")`;

    const postElement = await page.locator(postSelector).first();

    if (postElement) {
      info(`✓ Found post with ID: ${postId}`);
      return postElement;
    }

    warn(`⚠ Post with ID ${postId} not found on page`);
    return null;
  } catch (err) {
    error(`Error finding post: ${err.message}`, err);
    return null;
  }
}

/**
 * Clicks the comment button on a Facebook post
 * 
 * @param {Page} page - Playwright page instance
 * @param {Object} postElement - The post element
 * @returns {Promise<boolean>} True if comment button was clicked
 */
async function clickCommentButton(page, postElement) {
  try {
    logAction('Clicking comment button');

    // Common selectors for Facebook comment buttons
    const commentButtonSelectors = [
      'button:has-text("Comment")',
      'button[aria-label*="Comment"]',
      'button[title*="Comment"]',
      '[data-testid="comment_button"]',
      'button:has-text("comment")',
    ];

    for (const selector of commentButtonSelectors) {
      try {
        const button = postElement.locator(selector).first();
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible) {
          await button.click();
          info('✓ Comment button clicked');
          await randomDelay(500, 1500);
          return true;
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }

    // Fallback: try clicking any button near the post that contains comment-related text
    const buttons = await postElement.locator('button').all();
    for (const btn of buttons) {
      const text = await btn.innerText().catch(() => '');
      if (text.toLowerCase().includes('comment')) {
        await btn.click();
        info('✓ Comment button clicked (fallback)');
        await randomDelay(500, 1500);
        return true;
      }
    }

    warn('⚠ Could not find comment button');
    return false;
  } catch (err) {
    error(`Error clicking comment button: ${err.message}`, err);
    return false;
  }
}

/**
 * Finds and focuses the comment input field
 * 
 * @param {Page} page - Playwright page instance
 * @param {Object} postElement - The post element
 * @returns {Promise<string>} CSS selector for the comment field or null
 */
async function findCommentInputField(page, postElement) {
  try {
    logAction('Searching for comment input field');

    // Common selectors for Facebook comment input
    const inputSelectors = [
      'textarea[placeholder*="Write"]',
      'textarea[placeholder*="comment"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea.UFIInputTextarea',
      'textarea[aria-label*="comment"]',
      'input[placeholder*="Write"]',
    ];

    for (const selector of inputSelectors) {
      try {
        const input = page.locator(selector).first();
        const isVisible = await input.isVisible().catch(() => false);

        if (isVisible) {
          info(`✓ Found comment input field: ${selector}`);
          return selector;
        }
      } catch (e) {
        continue;
      }
    }

    // If no input found, try to find and wait for it
    try {
      await page.waitForSelector('textarea', { timeout: 5000 });
      const textarea = page.locator('textarea').first();
      const isVisible = await textarea.isVisible();
      if (isVisible) {
        info('✓ Found textarea via wait');
        return 'textarea';
      }
    } catch (e) {
      warn('⚠ Could not find comment input field');
    }

    return null;
  } catch (err) {
    error(`Error finding comment input: ${err.message}`, err);
    return null;
  }
}

/**
 * Submits a comment on a Facebook post
 * 
 * @param {Page} page - Playwright page instance
 * @returns {Promise<boolean>} True if comment was submitted
 */
async function submitComment(page) {
  try {
    logAction('Submitting comment');

    // Common selectors for submit button
    const submitSelectors = [
      'button:has-text("Post")',
      'button:has-text("Comment")',
      'button[aria-label*="Post"]',
      'button[aria-label*="Send"]',
      '[data-testid="post_submit_button"]',
      'button:has-text("Send")',
      'button.uiButton',
    ];

    for (const selector of submitSelectors) {
      try {
        const button = page.locator(selector).last(); // Use last() to avoid action buttons
        const isVisible = await button.isVisible().catch(() => false);

        if (isVisible) {
          // Scroll into view if needed
          await button.scrollIntoViewIfNeeded();
          await randomDelay(300, 800);

          await button.click();
          info('✓ Comment submitted successfully');
          await randomDelay(1000, 2000);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    // Fallback: try pressing Enter key
    warn('⚠ Could not find submit button, trying Enter key');
    await page.keyboard.press('Enter');
    await randomDelay(1000, 2000);
    return true;
  } catch (err) {
    error(`Error submitting comment: ${err.message}`, err);
    return false;
  }
}

/**
 * Main function to post a comment on a Facebook post
 * Includes rate limiting, pre/post delays, and error handling
 * 
 * @param {Page} page - Playwright page instance  
 * @param {string} postId - The Facebook post ID
 * @param {string} commentText - The comment text to post
 * @returns {Promise<boolean>} True if comment was posted successfully
 */
async function postComment(page, postId, commentText) {
  try {
    // Check rate limit
    const rateLimitCheck = commentLimiter.isAllowed();
    if (!rateLimitCheck.allowed) {
      warn(
        `Rate limit reached. Reset in ${Math.ceil(rateLimitCheck.resetIn / 1000)}s. Skipping this comment.`
      );
      logAction('Comment blocked by rate limiter', {
        postId,
        resetIn: rateLimitCheck.resetIn,
      });
      return false;
    }

    logAction('Starting comment posting process', {
      postId,
      commentLength: commentText.length,
    });

    // Pre-comment delay (2-6 seconds)
    const preDelay = getRandomDelay(2000, 6000);
    info(`⏳ Pre-comment delay: ${preDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, preDelay));

    // Find the post
    const postElement = await findPostOnPage(page, postId);
    if (!postElement) {
      error('Could not find post on page');
      return false;
    }

    // Click comment button
    const commentClicked = await clickCommentButton(page, postElement);
    if (!commentClicked) {
      error('Could not click comment button');
      return false;
    }

    // Find comment input field
    const inputSelector = await findCommentInputField(page, postElement);
    if (!inputSelector) {
      error('Could not find comment input field');
      return false;
    }

    // Type the comment with human-like speed
    await typeWithHumanSpeed(page, inputSelector, commentText);
    await randomDelay(500, 1500);

    // Submit the comment
    const submitted = await submitComment(page);
    if (!submitted) {
      error('Could not submit comment');
      return false;
    }

    // Post-comment delay (2-6 seconds)
    const postDelay = getRandomDelay(2000, 6000);
    info(`⏳ Post-comment delay: ${postDelay}ms`);
    await new Promise(resolve => setTimeout(resolve, postDelay));

    logAction('Comment posted successfully', {
      postId,
      commentLength: commentText.length,
      remainingThisHour: rateLimitCheck.remainingActions,
    });

    info(
      `✅ Comment posted successfully! (${rateLimitCheck.remainingActions} comments remaining this hour)`
    );
    return true;
  } catch (err) {
    error(`Error posting comment: ${err.message}`, err);
    return false;
  }
}

/**
 * Gets the current comment count and remaining capacity for this hour
 * @returns {Object} { posted: number, remaining: number, resetIn: timeInMs }
 */
function getCommentStats() {
  const remaining = commentLimiter.getRemainingActions();
  const posted = commentLimiter.getActionCount();

  return {
    posted,
    remaining,
    limit: 10,
    resetIn: commentLimiter.getResetTime(),
  };
}

/**
 * Resets the comment rate limiter (use with caution)
 */
function resetCommentLimiter() {
  warn('⚠️ Resetting comment rate limiter!');
  commentLimiter.reset();
}

module.exports = {
  postComment,
  typeWithHumanSpeed,
  findPostOnPage,
  clickCommentButton,
  findCommentInputField,
  submitComment,
  getCommentStats,
  resetCommentLimiter,
};
