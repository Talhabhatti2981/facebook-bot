/**
 * Dental Lead Generation Bot - Main Entry Point
 * Complete orchestration of Phases 1, 2, and 3
 * 
 * Phase 1: Facebook monitoring and post collection ✅
 * Phase 2: AI analysis, comment generation, and lead qualification ✅
 * Phase 3: Excel storage and Telegram notifications ✅
 * 
 * Complete workflow:
 * 1. Monitor Facebook group for new posts
 * 2. Analyze posts with GPT-4o Mini for relevance
 * 3. Generate and post natural comments
 * 4. Scrape profile and find practice website
 * 5. Save leads to Excel file (with duplicate checking)
 * 6. Send Telegram notifications for each new lead
 * 7. Daily summaries at 8:00 AM
 * 8. Error alerts for any issues
 */

require('dotenv').config();
const http = require('http');
const config = require('../config/config');
const { info, error, warn, logAction } = require('./utils/logger');
const { monitorFacebookGroup, testConnection: testFacebookConnection, closeBrowser } = require('./browser/facebook');
const { randomDelay } = require('./utils/delays');
const gpt = require('./ai/gpt');
const excel = require('./storage/excel');
const { scrapeProfile, findPracticeWebsite, extractContactInfo } = require('./browser/scraper');
const telegram = require('./notifications/telegram');

// ===== Pure Node.js HTTP Server for Bot =====
const PORT = 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Bot is live!');
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not Found');
  }
});

// Listen on port 3000, bind to 0.0.0.0 for external access
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✓ Bot server is running on port ${PORT}`);
  console.log(`✓ Server is accessible externally at 0.0.0.0:${PORT}`);
});

// Global tracking
let cycleCount = 0;
let totalLeadsThisCycle = 0;
let totalCommentsThisCycle = 0;
let totalPostsSkippedThisCycle = 0;
let dailyLeadCountMap = {}; // Track which days we've sent daily summaries for
let botStartTime = Date.now();

/**
 * Main initialization function
 */
async function initializeBot() {
  try {
    logAction('🤖 Dental Lead Generation Bot Starting', { version: '3.0.0', phase: 'Phase 1+2+3' });
    info('═══════════════════════════════════════');
    info('Dental Lead Generation Bot');
    info('Version: 3.0.0 - COMPLETE (All Phases)');
    info('═══════════════════════════════════════');
    info('Features: Facebook Monitoring | AI Analysis');
    info('          Auto-Commenting | Lead Extraction');
    info('          Excel Storage | Telegram Alerts');
    info('═══════════════════════════════════════');
    info('');

    // Log configuration
    info(`📍 Environment: ${config.env}`);
    info(`👤 Facebook Account: ${config.facebook.email}`);
    info(`📱 Telegram Chat: ${config.telegram.chatId}`);
    info(`🤖 AI Model: ${config.openai.model}`);
    info(`⏱️ Check Interval: ${config.bot.checkIntervalMinutes} minutes`);
    info('');

    // Test Facebook connection
    info('🔗 Testing Facebook connection...');
    const facebookTest = await testFacebookConnection();
    if (!facebookTest) {
      error('❌ Facebook connection test failed. Please check your credentials in .env');
      process.exit(1);
    }
    info('✅ Facebook connection successful!');

    // Test OpenAI connection
    info('🔗 Testing OpenAI API connection...');
    const openaiTest = await gpt.testConnection();
    if (!openaiTest) {
      warn('⚠️ OpenAI connection failed - AI analysis will be skipped. Check your API key and billing.');
    } else {
      info('✅ OpenAI connection successful!');
    }

    // Test Telegram connection
    info('🔗 Testing Telegram connection...');
    const telegramTest = await telegram.testConnection();
    if (!telegramTest) {
      warn('⚠️ Telegram connection failed - notifications will be skipped. This may be a network issue.');
    } else {
      info('✅ Telegram connection successful!');
    }

    // Initialize Excel file
    info('📊 Initializing Excel file...');
    await excel.initExcel();
    info('✅ Excel file ready!');

    info('');
    info('✅ All systems initialized successfully!');

    // Send startup notification (skip if Telegram failed)
    if (telegramTest) {
      info('\n📱 Sending startup notification to Telegram...');
      await telegram.sendStartupNotification();
    } else {
      info('\n⏭️ Skipping Telegram notification (Telegram connection unavailable)');
    }

    info('');
    info('🚀 Bot is now LIVE and monitoring...');
    info('');

    // Start monitoring loop
    await startMonitoringLoop();
  } catch (err) {
    error(`❌ Bot initialization failed: ${err.message}`, err);

    // Try to send error alert
    try {
      await telegram.sendErrorAlert(`Bot initialization failed: ${err.message}`, err);
      await telegram.sendShutdownNotification();
    } catch (e) {
      error(`Failed to send shutdown notification: ${e.message}`);
    }

    process.exit(1);
  }
}

/**
 * Processes a single analyzed post
 * Scrapes profile, finds website, saves to Excel, and sends Telegram alert
 * 
 * @param {Object} post - Analyzed post object from Phase 2
 * @param {Array} currentCyclePosts - All posts in current cycle for context
 * @returns {Promise<boolean>} True if lead was processed successfully
 */
async function processLeadComplete(post, currentCyclePosts = []) {
  try {
    info(`\n📋 PROCESSING LEAD: ${post.author}`);

    logAction('Processing complete lead workflow', {
      postId: post.id,
      author: post.author,
      dentistName: post.leadInfo?.dentistName,
    });

    // Check for duplicate before processing further
    if (excel.checkDuplicate(post.id)) {
      info(`⏭️ Skipping duplicate lead: ${post.author}`);
      totalPostsSkippedThisCycle++;
      return false;
    }

    let websiteUrl = post.leadInfo?.website || null;

    // Try to find practice website if not in lead info
    if (!websiteUrl && post.leadInfo?.practiceName) {
      info(`🔍 Searching for practice website...`);
      await randomDelay(800, 1500);
      websiteUrl = await findPracticeWebsite(
        post.leadInfo.practiceName,
        post.leadInfo.location
      );

      if (websiteUrl) {
        info(`✓ Found website: ${websiteUrl}`);
      } else {
        info(`No website found, continuing...`);
      }
    }

    // Prepare lead data for Excel
    const leadData = {
      postId: post.id,
      dentistName: post.leadInfo?.dentistName || post.author,
      practiceName: post.leadInfo?.practiceName || 'Unknown',
      location: post.leadInfo?.location || 'Not specified',
      websiteUrl: websiteUrl || '',
      postText: post.text,
      commentPosted: post.generatedComment || 'N/A',
      sourceGroup: config.facebook.groupUrl,
    };

    // Save to Excel
    info(`💾 Saving lead to Excel...`);
    const rowNumber = await excel.saveLead(leadData);

    if (rowNumber === -1) {
      error('Failed to save lead to Excel');
      return false;
    }

    // Get today's lead count for Telegram
    const todayLeads = excel.getTodayLeads().length;

    // Send Telegram notification
    info(`📱 Sending Telegram notification...`);
    await randomDelay(500, 1000);
    const telegramSent = await telegram.sendNewLeadAlert(leadData, todayLeads);

    if (!telegramSent) {
      warn('Telegram notification failed, but lead was saved');
    }

    totalLeadsThisCycle++;

    logAction('Lead processing completed', {
      dentistName: leadData.dentistName,
      excelRow: rowNumber,
      telegramSent,
    });

    return true;
  } catch (err) {
    error(`Error processing lead: ${err.message}`, err);
    return false;
  }
}

/**
 * Main monitoring cycle
 * Runs every 30 minutes (or configured interval)
 * Coordinates all bot actions
 */
async function runMonitoringCycle() {
  try {
    cycleCount++;
    totalLeadsThisCycle = 0;
    totalCommentsThisCycle = 0;
    totalPostsSkippedThisCycle = 0;

    const timestamp = new Date().toISOString();
    info('═══════════════════════════════════════');
    info(`📊 MONITORING CYCLE #${cycleCount} - ${timestamp}`);
    info('═══════════════════════════════════════');

    logAction('Starting monitoring cycle', { cycleNumber: cycleCount });

    // Step 1: Monitor Facebook group
    info('\n📥 STEP 1: Monitoring Facebook group...');
    const monitorResult = await monitorFacebookGroup();

    if (!monitorResult.success) {
      error(`Monitoring failed: ${monitorResult.error}`);
      return {
        success: false,
        error: monitorResult.error,
        leadsFound: 0,
        leadsProcessed: 0,
      };
    }

    if (monitorResult.postsCollected === 0) {
      info('✅ No new posts in this cycle');
      return {
        success: true,
        leadsFound: 0,
        leadsProcessed: 0,
      };
    }

    info(`✅ Collected ${monitorResult.postsCollected} posts\n`);

    // Step 2-3: Posts were already analyzed and commented in monitorFacebookGroup
    // (That's Phase 2 functionality)
    totalCommentsThisCycle = monitorResult.commentsPosted;

    // Step 4: Process relevant posts for leads (Phase 3)
    info(`\n💼 STEP 2: Processing leads (Phase 3)...`);

    if (monitorResult.posts && monitorResult.posts.length > 0) {
      const relevantPosts = monitorResult.posts.filter(p => p.isRelevant && p.readyToComment);

      if (relevantPosts.length > 0) {
        info(`Processing ${relevantPosts.length} relevant posts...`);

        for (let i = 0; i < relevantPosts.length; i++) {
          const post = relevantPosts[i];

          try {
            const processed = await processLeadComplete(post, monitorResult.posts);

            if (processed) {
              info(`✅ Lead processed successfully: ${post.author}`);
            } else {
              info(`⏭️ Lead skipped: ${post.author}`);
            }

            // Random delay between processing leads
            await randomDelay(1500, 3000);
          } catch (err) {
            error(`Error processing lead ${i + 1}: ${err.message}`, err);
          }
        }
      } else {
        info('No relevant posts to process as leads');
      }
    }

    // Step 5: Compile and display cycle summary
    info('\n');
    info('═══════════════════════════════════════');
    info('📊 CYCLE SUMMARY');
    info('═══════════════════════════════════════');
    info(`✅ Posts collected: ${monitorResult.postsCollected}`);
    info(`🤖 Posts analyzed: ${monitorResult.postsAnalyzed}`);
    info(`✅ Relevant posts: ${monitorResult.relevantPosts}`);
    info(`💬 Comments posted: ${totalCommentsThisCycle}`);
    info(`💼 Leads processed: ${totalLeadsThisCycle}`);
    info(`⏭️ Posts skipped: ${totalPostsSkippedThisCycle}`);
    info('═══════════════════════════════════════');
    info('');

    logAction('Monitoring cycle completed', {
      cycleNumber: cycleCount,
      postsCollected: monitorResult.postsCollected,
      leadsProcessed: totalLeadsThisCycle,
      commentsPosted: totalCommentsThisCycle,
    });

    return {
      success: true,
      leadsFound: monitorResult.relevantPosts,
      leadsProcessed: totalLeadsThisCycle,
      commentsPosted: totalCommentsThisCycle,
    };
  } catch (err) {
    error(`Error in monitoring cycle: ${err.message}`, err);

    // Send error alert to Telegram
    try {
      await telegram.sendErrorAlert(`Monitoring cycle #${cycleCount} failed`, err);
    } catch (telegramErr) {
      error(`Failed to send error alert: ${telegramErr.message}`);
    }

    return {
      success: false,
      error: err.message,
      leadsFound: 0,
      leadsProcessed: 0,
    };
  }
}

/**
 * Sends daily summary at 8:00 AM
 * Runs once per day
 */
async function sendDailySummaryIfNeeded() {
  try {
    const now = new Date();
    const today = now.toLocaleDateString('en-US');
    const hour = now.getHours();

    // Only send at 8:00 AM
    if (hour !== 8) {
      return;
    }

    // Check if we've already sent today
    if (dailyLeadCountMap[today]) {
      return; // Already sent
    }

    info('\n📈 Sending daily summary...');

    const stats = excel.getLeadStats();
    const todayLeads = excel.getTodayLeads();

    const summaryStats = {
      todayLeads: todayLeads.length,
      commentsPosted: totalCommentsThisCycle,
      postsSkipped: totalPostsSkippedThisCycle,
      totalProcessed: stats.totalLeads,
    };

    const sent = await telegram.sendDailySummary(summaryStats);

    if (sent) {
      dailyLeadCountMap[today] = true;
      info(`✅ Daily summary sent`);
    }
  } catch (err) {
    error(`Error sending daily summary: ${err.message}`, err);
  }
}

/**
 * Main monitoring loop
 * Runs continuously with configurable intervals
 */
async function startMonitoringLoop() {
  while (true) {
    try {
      // Run monitoring cycle
      const cycleResult = await runMonitoringCycle();

      // Check if we should send daily summary
      await sendDailySummaryIfNeeded();

      // Wait before next check
      const nextCheckIn = Math.ceil(checkIntervalMs / 1000);
      info(`\n⏳ Next monitoring cycle in ${nextCheckIn} seconds (${config.bot.checkIntervalMinutes} minutes)`);
      info('');

      // Add some randomness to avoid predictable patterns
      await randomDelay(checkIntervalMs - 5000, checkIntervalMs + 5000);
    } catch (err) {
      error(`Error in monitoring loop: ${err.message}`, err);

      try {
        await telegram.sendErrorAlert(`Bot monitoring loop error: ${err.message}`, err);
      } catch (e) {
        error(`Failed to send error alert: ${e.message}`);
      }

      // Wait before retrying
      warn(`Retrying in 1 minute...`);
      await randomDelay(60000, 65000);
    }
  }
}

async function gracefulShutdown(signal) {
  info(`\n🛑 ${signal} received. Shutting down gracefully...`);
  logAction('Bot shutting down', { signal });

  try {
    // Send shutdown notification
    info('📱 Sending shutdown notification...');
    await telegram.sendShutdownNotification();

    // Close browser
    await closeBrowser();
    info('✓ Browser closed');

    info('✓ Bot shutdown complete');
    process.exit(0);
  } catch (err) {
    error(`Error during shutdown: ${err.message}`, err);
    process.exit(1);
  }
}

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', async (err) => {
  error('Uncaught Exception:', err);

  try {
    await telegram.sendErrorAlert(`Uncaught Exception: ${err.message}`, err);
  } catch (e) {
    error(`Failed to send error alert: ${e.message}`);
  }

  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', async (reason, promise) => {
  error(`Unhandled Rejection at ${promise}:`, reason);

  try {
    await telegram.sendErrorAlert(`Unhandled Rejection: ${String(reason)}`, reason);
  } catch (e) {
    error(`Failed to send error alert: ${e.message}`);
  }

  gracefulShutdown('UNHANDLED_REJECTION');
});

/**
 * Handle shutdown signals
 */
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start the bot
initializeBot().catch(err => {
  error(`Fatal error: ${err.message}`, err);
  process.exit(1);
});
