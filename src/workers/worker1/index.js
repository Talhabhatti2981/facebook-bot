/**
 * Worker 1 - Lead Discovery
 * Runs daily at 6:00 AM
 * Scrapes Indeed, Google Maps, and clinic websites for new leads
 */

const { scrapeIndeedJobs } = require('./indeedScraper');
const { extractClinicDetails } = require('./googleMapsScraper');
const { extractContactInfo } = require('./websiteScraper');
const googleSheets = require('../../shared/googleSheets');
const { info, error, warn, logAction } = require('../../utils/logger');
const { randomDelay } = require('../../utils/delays');
const telegram = require('../../notifications/telegram');
const config = require('../../../config/config');

let leadsAdded = 0;

/**
 * Main Worker 1 execution
 */
async function runWorker1() {
  try {
    logAction('🚀 Worker 1 - Lead Discovery starting');
    info('═══════════════════════════════════════');
    info('Worker 1 - Lead Discovery');
    info('Time: ' + new Date().toLocaleString());
    info('═══════════════════════════════════════');

    // Initialize Google Sheets
    const authSuccess = await googleSheets.initializeAuth();
    if (!authSuccess) {
      throw new Error('Failed to initialize Google Sheets');
    }

    leadsAdded = 0;

    // Step 1: Scrape Indeed
    info('\n📍 Step 1: Scraping Indeed for jobs...');
    const indeedJobs = await scrapeIndeedJobs();
    info(`Found ${indeedJobs.length} job postings on Indeed`);

    if (indeedJobs.length === 0) {
      info('No Indeed jobs found today');
      await sendTelegramReport(0);
      return;
    }

    // Step 2-4: Process each job
    for (let i = 0; i < indeedJobs.length; i++) {
      const job = indeedJobs[i];
      logAction(`Processing lead ${i + 1}/${indeedJobs.length}: ${job.clinicName}`);

      try {
        // Check if clinic already exists
        const exists = await googleSheets.clinicExists(job.clinicName);
        if (exists) {
          info(`⏭️  Clinic ${job.clinicName} already exists, skipping`);
          await randomDelay(2000, 4000);
          continue;
        }

        // Step 2: Extract from Google Maps
        info(`  🗺️  Searching Google Maps for ${job.clinicName}...`);
        const mapsDetails = await extractClinicDetails(job.clinicName, job.city, job.state);
        await randomDelay(2000, 4000);

        // Step 3: Extract from website
        let doctorName = '';
        let email = '';

        if (mapsDetails.website) {
          info(`  🌐 Scraping website: ${mapsDetails.website}`);
          const contactInfo = await extractContactInfo(mapsDetails.website);
          doctorName = contactInfo.doctorName;
          email = contactInfo.email;
          await randomDelay(2000, 4000);
        }

        // Step 4: Add to Google Sheet
        const leadData = {
          clinicName: job.clinicName,
          doctorName: doctorName || '',
          email: email || '',
          phone: mapsDetails.phone || '',
          address: mapsDetails.address || '',
          city: job.city,
          state: job.state,
          website: mapsDetails.website || '',
          jobUrl: job.jobUrl,
          leadSource: 'Indeed',
        };

        const added = await googleSheets.addLead(leadData);
        if (added) {
          leadsAdded++;
          info(`✅ Lead added: ${job.clinicName}`);
        }

        await randomDelay(2000, 4000);
      } catch (err) {
        error(`Error processing ${job.clinicName}: ${err.message}`);
        continue; // Continue with next clinic
      }
    }

    info('\n✅ Worker 1 - Lead Discovery complete');
    info(`Total leads added: ${leadsAdded}`);
    
    await sendTelegramReport(leadsAdded);
  } catch (err) {
    error(`Fatal error in Worker 1: ${err.message}`);
    await telegram.sendAlert(`❌ Worker 1 Error: ${err.message}`).catch(e => {
      error(`Failed to send error alert: ${e.message}`);
    });
  }
}

/**
 * Send completion report to Telegram
 */
async function sendTelegramReport(count) {
  try {
    let message;
    if (count === 0) {
      message = 'Discovery complete ✅ — No new leads found today';
    } else {
      message = `Discovery complete ✅ — ${count} new leads added today. ${count} from Indeed (Hot)`;
    }

    await telegram.sendMessage(`\n🔍 *Worker 1 Report*\n${message}`);
  } catch (err) {
    error(`Failed to send Telegram report: ${err.message}`);
  }
}

/**
 * Initialize and run Worker 1
 */
async function initialize() {
  try {
    info('Initializing Worker 1 - Lead Discovery...');
    await runWorker1();
  } catch (err) {
    error(`Worker 1 initialization failed: ${err.message}`);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  initialize().then(() => {
    info('Worker 1 completed, exiting...');
    setTimeout(() => process.exit(0), 2000);
  }).catch(err => {
    error(`Worker 1 failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  runWorker1,
  initialize,
};
