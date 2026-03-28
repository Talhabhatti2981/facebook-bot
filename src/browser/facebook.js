/**
 * Facebook Browser Module
 * Handles all Facebook automation including login, group navigation, and post scraping
 * Uses Playwright for browser automation with anti-detection measures
 * 
 * Phase 2 Updates:
 * - Integrated GPT-4o Mini AI for post relevance analysis
 * - Auto-generation of natural comments for relevant posts
 * - Lead information extraction from posts
 * - Rate limiting for comments (max 10/hour)
 */

const { chromium } = require('playwright');
const config = require('../../config/config');
const { randomDelay, postActionDelay, shortDelay, getRandomUserAgent, getRandomDelay } = require('../utils/delays');
const { info, error, warn, logAction, debug } = require('../utils/logger');
const gpt = require('../ai/gpt');
const { postComment, getCommentStats } = require('./commenter');

let browser = null;
let context = null;
let page = null;

/**
 * Initializes and launches the Playwright browser with anti-detection settings
 * @returns {Promise<Object>} Browser instance
 */
async function launchBrowser() {
  try {
    logAction('Launching Playwright browser', { headless: config.facebook.headless });

    browser = await chromium.launch({
      headless: config.facebook.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-web-resources',
        '--disable-default-apps',
        '--disable-sync',
      ],
    });

    // Try to get process info if available
    let pidInfo = 'N/A';
    try {
      if (browser.process) {
        pidInfo = browser.process.pid || 'N/A';
      }
    } catch (e) {
      // Ignore if process info is not available
    }
    info(`✓ Browser launched successfully (PID: ${pidInfo})`);
    return browser;
  } catch (err) {
    error(`Failed to launch browser: ${err.message}`, err);
    throw err;
  }
}

/**
 * Creates a new browser context with anti-detection headers and settings
 * @returns {Promise<Object>} Browser context instance
 */
async function createContext() {
  try {
    if (!browser) {
      await launchBrowser();
    }

    const userAgent = getRandomUserAgent();
    logAction('Creating browser context', { userAgent });

    context = await browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      ignoreHTTPSErrors: true,
      bypassCSP: true,
    });

    // Add extra headers to avoid bot detection
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    info('✓ Browser context created successfully');
    return context;
  } catch (err) {
    error(`Failed to create browser context: ${err.message}`, err);
    throw err;
  }
}

/**
 * Creates a new page and sets up necessary listeners
 * @returns {Promise<Object>} Page instance
 */
async function createPage() {
  try {
    if (!context) {
      await createContext();
    }

    page = await context.newPage();
    
    logAction('Creating new page');

    // Set default timeout for page operations
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    // Log all console messages from the page
    page.on('console', msg => {
      debug(`[PAGE CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    // Log all errors on the page
    page.on('pageerror', err => {
      warn(`[PAGE ERROR] ${err.message}`);
    });

    info('✓ Page created successfully');
    return page;
  } catch (err) {
    error(`Failed to create page: ${err.message}`, err);
    throw err;
  }
}

/**
 * Logs into Facebook using credentials from .env
 * @returns {Promise<boolean>} True if login successful
 */
async function loginToFacebook() {
  try {
    if (!page) {
      await createPage();
    }

    logAction('Starting Facebook login', { email: config.facebook.email });

    // Navigate to Facebook login page
    info('→ Navigating to Facebook');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });
    await randomDelay(2000, 4000); // Extra wait for form to load

    // Wait longer for the form to fully render
    info('→ Waiting for login form to fully load...');
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
      info('Network idle timeout, continuing...');
    });
    await randomDelay(2000, 3000);

    // Fill email field - Try multiple selectors
    info('→ Entering email address');
    let emailFilled = false;
    
    // Try the main email input selector
    try {
      await page.fill('input[name="email"]', config.facebook.email, { timeout: 5000 });
      emailFilled = true;
      info('✓ Email filled successfully');
    } catch (e) {
      info('Email selector failed, trying alternative...');
      try {
        await page.fill('input[data-testid="royal_email"]', config.facebook.email, { timeout: 5000 });
        emailFilled = true;
        info('✓ Email filled with alternative selector');
      } catch (e2) {
        error('Could not find email input field');
      }
    }
    
    await randomDelay(1000, 2000);

    // Fill password field
    info('→ Entering password');
    let passwordFilled = false;
    
    try {
      await page.fill('input[name="pass"]', config.facebook.password, { timeout: 5000 });
      passwordFilled = true;
      info('✓ Password filled successfully');
    } catch (e) {
      info('Password selector failed, trying alternative...');
      try {
        await page.fill('input[data-testid="royal_pass"]', config.facebook.password, { timeout: 5000 });
        passwordFilled = true;
        info('✓ Password filled with alternative selector');
      } catch (e2) {
        error('Could not find password input field');
      }
    }
    
    await randomDelay(1000, 2000);

    // Click login button - Try multiple selectors
    info('→ Clicking login button');
    let loginClicked = false;
    
    try {
      // First try pressing Enter (form submission)
      await page.press('input[name="pass"]', 'Enter', { timeout: 5000 });
      loginClicked = true;
      info('✓ Form submitted with Enter key');
    } catch (e) {
      info('Enter key failed, trying button click...');
      try {
        await page.click('button[name="login"]', { timeout: 5000 });
        loginClicked = true;
        info('✓ Login button clicked');
      } catch (e2) {
        info('Button selector failed, trying alternative...');
        try {
          const loginBtn = page.locator('button:has-text("Log In")').first();
          await loginBtn.click({ timeout: 5000 });
          loginClicked = true;
          info('✓ Login button clicked with alternative selector');
        } catch (e3) {
          try {
            // Last resort: try clicking any button with text containing "Log"
            await page.locator('button:has-text("Log")').first().click({ timeout: 3000 });
            loginClicked = true;
            info('✓ Login button clicked with fallback selector');
          } catch (e4) {
            error('Could not find login button');
          }
        }
      }
    }

    // Wait for navigation after login
    await randomDelay(3000, 5000);
    
    try {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (e) {
      info('Navigation timeout, but continuing...');
    }
    
    await randomDelay(2000, 3000);

    // Check if login was successful
    const currentUrl = page.url();
    const isLoggedIn = currentUrl.includes('facebook.com') && !currentUrl.includes('login');
    
    if (isLoggedIn || emailFilled || passwordFilled || loginClicked) {
      logAction('Facebook login attempted', { url: currentUrl, emailFilled, passwordFilled, loginClicked });
      info('✓ Login process completed');
      return true;
    } else {
      error(`Login may have failed. Current URL: ${currentUrl}`);
      return false;
    }
  } catch (err) {
    error(`Facebook login failed: ${err.message}`, err);
    throw err;
  }
}

/**
 * Navigates to the Facebook group specified in the config
 * @returns {Promise<boolean>} True if navigation successful
 */
async function navigateToGroup() {
  try {
    if (!page) {
      await createPage();
    }

    logAction('Navigating to Facebook group', { url: config.facebook.groupUrl });

    info('→ Navigating to group URL');
    await page.goto(config.facebook.groupUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay();

    // Wait for group content to load
    await page.waitForSelector('[role="feed"]', { timeout: 15000 }).catch(() => {
      info('Feed selector not found, but continuing...');
    });
    await postActionDelay();

    logAction('Successfully navigated to group', { url: page.url() });
    info('✓ Successfully navigated to Facebook group');
    return true;
  } catch (err) {
    error(`Failed to navigate to group: ${err.message}`, err);
    throw err;
  }
}

/**
 * Scrolls through the Facebook group feed and collects new posts
 * @param {number} numberOfScrolls - Number of times to scroll down
 * @returns {Promise<Array>} Array of post objects with id, text, author, and timestamp
 */
async function scrollAndCollectPosts(numberOfScrolls = 5) {
  try {
    if (!page) {
      await createPage();
    }

    logAction('Starting to scroll and collect posts', { numberOfScrolls });

    const posts = [];
    const seenPostIds = new Set();

    // Scroll down multiple times to load more posts
    for (let i = 0; i < numberOfScrolls; i++) {
      info(`→ Scroll ${i + 1}/${numberOfScrolls}`);

      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await randomDelay();

      // Wait for posts to load
      await page.waitForSelector('[role="feed"] article', { timeout: 5000 }).catch(() => {
        info('Articles not found, continuing...');
      });
      await postActionDelay();

      // Extract posts from the current view
      const currentPosts = await page.evaluate(() => {
        const articles = document.querySelectorAll('[role="feed"] article');
        const extractedPosts = [];

        articles.forEach((article, index) => {
          try {
            // Extract post ID from the article or its parent
            let postId = article.id || article.getAttribute('data-id') || `post-${Date.now()}-${index}`;
            
            // Extract post text
            const textElement = article.querySelector('[data-testid="post_message"]') || 
                               article.querySelector('[data-ad-preview="message"]') ||
                               article.querySelector('[role="article"] > div');
            const postText = textElement ? textElement.innerText : '';

            // Extract author name
            const authorElement = article.querySelector('a[href*="/profile"] strong') ||
                                 article.querySelector('[data-testid="profile_name"]');
            const authorName = authorElement ? authorElement.innerText : 'Unknown';

            // Extract timestamp
            const timeElement = article.querySelector('a[href*="/posts/"]') ||
                               article.querySelector('time');
            const timestamp = timeElement ? timeElement.getAttribute('title') || timeElement.innerText : '';

            if (postText && postText.trim().length > 0) {
              extractedPosts.push({
                id: postId,
                text: postText.trim(),
                author: authorName,
                timestamp: timestamp,
                collectedAt: new Date().toISOString(),
              });
            }
          } catch (e) {
            // Skip posts that fail to parse
            warn(`Failed to parse post ${index}`);
          }
        });

        return extractedPosts;
      });

      // Add new posts to collection (avoid duplicates)
      currentPosts.forEach(post => {
        if (!seenPostIds.has(post.id)) {
          posts.push(post);
          seenPostIds.add(post.id);
        }
      });

      info(`→ Collected ${posts.size || posts.length} total posts so far`);
    }

    logAction('Finished scrolling and collecting posts', { totalPosts: posts.length });
    info(`✓ Collected ${posts.length} unique posts from group feed`);
    return posts;
  } catch (err) {
    error(`Failed to scroll and collect posts: ${err.message}`, err);
    return [];
  }
}

/**
 * Analyzes posts for relevance to dental billing and generates comments
 * Uses GPT-4o Mini to determine if posts are relevant
 * For relevant posts, generates natural comments and prepares them for posting
 * 
 * @param {Array} posts - Array of post objects with id, text, author, timestamp
 * @returns {Promise<Array>} Array of posts with analysis data and generated comments
 */
async function analyzePostsWithAI(posts) {
  try {
    if (!posts || posts.length === 0) {
      warn('No posts to analyze');
      return [];
    }

    logAction('Starting AI analysis of posts', { totalPosts: posts.length });
    info(`📊 Analyzing ${posts.length} posts for relevance...`);

    const analyzedPosts = [];
    let relevantCount = 0;

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];

      try {
        info(`\n📝 Post ${i + 1}/${posts.length}`);
        info(`Author: ${post.author}`);
        info(`Text: ${post.text.substring(0, 100)}...`);

        // Analyze if post is relevant to dental billing
        const isRelevant = await gpt.isPostRelevant(post.text);

        if (isRelevant) {
          relevantCount++;
          info(`✅ RELEVANT - Generating comment...`);

          // Generate a comment for relevant posts
          const comment = await gpt.generateComment(post.text);

          if (comment) {
            // Extract lead information from the post
            const leadInfo = await gpt.extractLeadInfo(post.text, post.author);

            // Add analysis data to post
            const analyzedPost = {
              ...post,
              isRelevant: true,
              generatedComment: comment,
              leadInfo: leadInfo,
              readyToComment: true, // Flag to indicate this post is ready to be commented on
            };

            analyzedPosts.push(analyzedPost);

            logAction('Post analyzed and comment generated', {
              author: post.author,
              commentPreview: comment.substring(0, 50),
              dentistName: leadInfo.dentistName,
            });

            info(`Generated comment: "${comment}"`);
          } else {
            warn('Failed to generate comment, but post is still relevant');
            analyzedPosts.push({
              ...post,
              isRelevant: true,
              generatedComment: null,
              readyToComment: false,
            });
          }
        } else {
          info(`⏭️ NOT RELEVANT - Skipping`);
          // Still add to analyzed posts but mark as not relevant
          analyzedPosts.push({
            ...post,
            isRelevant: false,
            generatedComment: null,
            readyToComment: false,
          });
        }

        // Add delay between GPT API calls (anti-rate-limiting)
        await randomDelay(1000, 1500);
      } catch (err) {
        error(`Error analyzing post from ${post.author}: ${err.message}`, err);
        analyzedPosts.push({
          ...post,
          isRelevant: false,
          generatedComment: null,
          readyToComment: false,
          error: err.message,
        });
      }
    }

    logAction('AI analysis complete', {
      totalPosts: posts.length,
      relevantPosts: relevantCount,
      commentStats: getCommentStats(),
    });

    info(`\n✅ Analysis complete: ${relevantCount}/${posts.length} posts are relevant`);
    info(`📨 Ready to comment on ${analyzedPosts.filter(p => p.readyToComment).length} posts`);

    return analyzedPosts;
  } catch (err) {
    error(`Error during AI analysis: ${err.message}`, err);
    return posts.map(post => ({
      ...post,
      isRelevant: false,
      generatedComment: null,
      readyToComment: false,
      error: 'Analysis failed',
    }));
  }
}

/**
 * Posts comments on all analyzed posts that are ready for commenting
 * Respects rate limits (max 10 comments per hour)
 * 
 * @param {Array} analyzedPosts - Array of posts with generated comments
 * @returns {Promise<Object>} Summary of commenting actions
 */
async function postCommentsOnPosts(analyzedPosts) {
  try {
    const readyToComment = analyzedPosts.filter(p => p.readyToComment);

    if (readyToComment.length === 0) {
      info('No posts ready to comment on');
      return { attempted: 0, successful: 0, failed: 0 };
    }

    logAction('Starting to post comments', { postsToComment: readyToComment.length });
    info(`💬 Posting comments on ${readyToComment.length} posts...`);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < readyToComment.length; i++) {
      const post = readyToComment[i];

      try {
        info(`\n💬 Commenting ${i + 1}/${readyToComment.length}`);
        info(`Post by: ${post.author}`);

        const posted = await postComment(page, post.id, post.generatedComment);

        if (posted) {
          successful++;
          info(`✅ Comment posted successfully on ${post.author}'s post`);
        } else {
          failed++;
          warn(`⚠️ Failed to post comment on ${post.author}'s post`);
        }
      } catch (err) {
        error(`Error posting comment: ${err.message}`, err);
        failed++;
      }

      // Random delay between posts
      if (i < readyToComment.length - 1) {
        await randomDelay(2000, 4000);
      }
    }

    logAction('Comment posting complete', {
      total: readyToComment.length,
      successful,
      failed,
    });

    const stats = getCommentStats();
    info(`\n📊 Commenting Summary:`);
    info(`   ✅ Successful: ${successful}`);
    info(`   ❌ Failed: ${failed}`);
    info(`   📈 Comments this hour: ${stats.posted}/${stats.limit}`);
    info(`   ⏱️ Reset in: ${Math.ceil(stats.resetIn / 1000)}s`);

    return {
      attempted: readyToComment.length,
      successful,
      failed,
    };
  } catch (err) {
    error(`Error during comment posting: ${err.message}`, err);
    return { attempted: 0, successful: 0, failed: 0 };
  }
}

/**
 * Closes the browser and cleans up resources
 * @returns {Promise<void>}
 */
async function closeBrowser() {
  try {
    logAction('Closing browser');

    if (page) {
      await page.close();
      page = null;
    }

    if (context) {
      await context.close();
      context = null;
    }

    if (browser) {
      await browser.close();
      browser = null;
    }

    info('✓ Browser closed successfully');
  } catch (err) {
    error(`Error closing browser: ${err.message}`, err);
  }
}

/**
 * Main function to perform a complete Facebook group monitoring cycle
 * Now includes AI analysis and auto-commenting in Phase 2
 * 
 * Workflow:
 * 1. Launch browser and login
 * 2. Navigate to group
 * 3. Collect posts from feed
 * 4. Use GPT-4o Mini to analyze each post for relevance
 * 5. Generate natural comments for relevant posts
 * 6. Post comments while respecting rate limits
 * 
 * @returns {Promise<Object>} Monitoring results with posts and stats
 */
async function monitorFacebookGroup() {
  try {
    logAction('Starting Facebook group monitoring cycle');

    // Launch browser if not already running
    if (!page) {
      await launchBrowser();
      await createContext();
      await createPage();
      await loginToFacebook();
      await navigateToGroup();
    }

    // Step 1: Collect posts from the group
    info('📥 STEP 1: Collecting posts from Facebook group...');
    const posts = await scrollAndCollectPosts(config.bot.maxPostsPerCheck);

    if (posts.length === 0) {
      warn('No posts found in this monitoring cycle');
      return {
        success: true,
        postsCollected: 0,
        postsAnalyzed: 0,
        relevantPosts: 0,
        commentsPosted: 0,
      };
    }

    info(`✅ Collected ${posts.length} posts\n`);

    // Step 2: Analyze posts with AI
    info('🤖 STEP 2: Analyzing posts with GPT-4o Mini...');
    const analyzedPosts = await analyzePostsWithAI(posts);

    const relevantPosts = analyzedPosts.filter(p => p.isRelevant);
    const readyToComment = analyzedPosts.filter(p => p.readyToComment);

    info(`✅ Analysis complete: ${relevantPosts.length} relevant posts found\n`);

    // Step 3: Post comments on relevant posts
    info('💬 STEP 3: Posting comments on relevant posts...');
    const commentResults = await postCommentsOnPosts(analyzedPosts);

    logAction('Facebook group monitoring cycle completed', {
      postsCollected: posts.length,
      postsAnalyzed: analyzedPosts.length,
      relevantPosts: relevantPosts.length,
      commentsPosted: commentResults.successful,
      commentsFailed: commentResults.failed,
    });

    return {
      success: true,
      postsCollected: posts.length,
      postsAnalyzed: analyzedPosts.length,
      relevantPosts: relevantPosts.length,
      commentsPosted: commentResults.successful,
      commentsFailed: commentResults.failed,
      posts: analyzedPosts,
    };
  } catch (err) {
    error(`Facebook group monitoring failed: ${err.message}`, err);
    return {
      success: false,
      error: err.message,
      postsCollected: 0,
      postsAnalyzed: 0,
      relevantPosts: 0,
      commentsPosted: 0,
    };
  }
}

/**
 * Tests the Facebook connection and login
 * @returns {Promise<boolean>} True if connection is working
 */
async function testConnection() {
  try {
    logAction('Testing Facebook connection');

    await launchBrowser();
    await createContext();
    await createPage();
    const loginSuccess = await loginToFacebook();
    await closeBrowser();

    if (loginSuccess) {
      info('✓ Facebook connection test passed');
      return true;
    } else {
      warn('⚠ Facebook connection test failed');
      return false;
    }
  } catch (err) {
    error(`Connection test failed: ${err.message}`, err);
    return false;
  }
}

module.exports = {
  launchBrowser,
  createContext,
  createPage,
  loginToFacebook,
  navigateToGroup,
  scrollAndCollectPosts,
  analyzePostsWithAI,
  postCommentsOnPosts,
  closeBrowser,
  monitorFacebookGroup,
  testConnection,
  getBrowser: () => browser,
  getPage: () => page,
  getContext: () => context,
};
