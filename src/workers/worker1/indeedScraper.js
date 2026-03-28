/**
 * Indeed Job Scraper - Worker 1 Step 1
 * Scrapes Indeed for dental job postings
 */

const { chromium } = require('playwright');
const { info, error, warn, logAction, debug } = require('../../utils/logger');
const { randomDelay, shortDelay } = require('../../utils/delays');

const SEARCH_TERMS = [
  'dental biller',
  'dental billing coordinator',
  'insurance verification dental',
  'insurance coordinator dental',
  'front desk dental',
];

const MAX_AGE_DAYS = 5;

/**
 * Scrape Indeed for job postings
 */
async function scrapeIndeedJobs() {
  let browser = null;
  const jobs = [];

  try {
    logAction('Starting Indeed job scraper', { terms: SEARCH_TERMS.length });
    
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    for (const term of SEARCH_TERMS) {
      try {
        await scrapeSearchTerm(page, term, jobs);
        await randomDelay(2000, 4000); // Delay between searches
      } catch (err) {
        error(`Error scraping term "${term}": ${err.message}`);
        continue; // Continue with next term
      }
    }

    await context.close();
    info(`✅ Indeed scraping complete: ${jobs.length} jobs found`);
    return jobs;
  } catch (err) {
    error(`Fatal error in Indeed scraper: ${err.message}`);
    return jobs;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape a single search term
 */
async function scrapeSearchTerm(page, searchTerm, resultsArray) {
  try {
    logAction(`Searching Indeed for: "${searchTerm}"`);

    const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(searchTerm)}&l=United%20States&sort=date`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    await page.waitForSelector('[data-testid="jobsearch-ResultsList"]', { timeout: 5000 });

    // Extract job listings
    const jobElements = await page.$$eval('[data-testid="job_result_card"]', elements => 
      elements.map(el => {
        const titleEl = el.querySelector('[data-testid="jobCardTitle"]');
        const companyEl = el.querySelector('[data-testid="companyName"]');
        const locationEl = el.querySelector('[data-testid="jobCardLocation"]');
        const dateEl = el.querySelector('.date');
        const linkEl = el.querySelector('a[data-testid="jobCardTitle"]');

        return {
          title: titleEl?.innerText || '',
          company: companyEl?.innerText || '',
          location: locationEl?.innerText || '',
          datePosted: dateEl?.innerText || '',
          url: linkEl?.href || '',
          salary: el.querySelector('[data-testid="jobCardSalaryh"]')?.innerText || '',
        };
      })
    );

    // Filter by age and valid data
    for (const job of jobElements) {
      if (!job.company || !job.location) continue;

      const ageMatch = job.datePosted.match(/(\d+)/);
      const daysOld = ageMatch ? parseInt(ageMatch[1]) : MAX_AGE_DAYS + 1;

      if (daysOld <= MAX_AGE_DAYS) {
        const [city, state] = parseLocation(job.location);
        
        resultsArray.push({
          jobTitle: job.title,
          clinicName: job.company,
          city,
          state,
          jobUrl: job.url,
          datePosted: job.datePosted,
          salary: job.salary,
          source: 'Indeed',
          temperature: 'Hot',
        });
      }
    }

    debug(`Found ${jobElements.length} listings for "${searchTerm}"`);
  } catch (err) {
    error(`Error scraping search term "${searchTerm}": ${err.message}`);
  }
}

/**
 * Parse location string into city and state
 */
function parseLocation(locationStr) {
  const parts = locationStr.split(',').map(p => p.trim());
  let city = '';
  let state = '';

  if (parts.length >= 2) {
    state = parts[parts.length - 1];
    city = parts[0];
  } else if (parts.length === 1) {
    state = parts[0];
  }

  return [city, state];
}

module.exports = {
  scrapeIndeedJobs,
};
