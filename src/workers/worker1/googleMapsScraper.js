/**
 * Google Maps Contact Extractor - Worker 1 Step 2
 * Finds clinic details from Google Maps
 */

const { chromium } = require('playwright');
const { info, error, warn, logAction, debug } = require('../../utils/logger');
const { randomDelay, shortDelay } = require('../../utils/delays');

/**
 * Extract clinic details from Google Maps
 */
async function extractClinicDetails(clinicName, city, state) {
  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    const searchQuery = `${clinicName} ${city} ${state} dental clinic`;
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

    debug(`Searching Google Maps for: ${searchQuery}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    await randomDelay(1000, 2000);

    // Try to get the first result
    let details = {
      website: '',
      phone: '',
      address: '',
      found: false,
    };

    try {
      // Wait for results to load
      await page.waitForSelector('[data-item-id]', { timeout: 5000 });

      // Click first result
      const firstResult = await page.$('[data-item-id]');
      if (firstResult) {
        await firstResult.click();
        await randomDelay(800, 1500);
      }

      // Extract phone
      const phoneLink = await page.$('a[href^="tel:"]');
      if (phoneLink) {
        details.phone = await phoneLink.textContent();
      }

      // Extract website
      const websiteLink = await page.$('a[href^="http"].YwIhnf');
      if (websiteLink) {
        details.website = await websiteLink.getAttribute('href');
      }

      // Extract address
      const addressEl = await page.$('[data-is-address="true"]');
      if (addressEl) {
        details.address = await addressEl.textContent();
      }

      if (details.phone || details.website || details.address) {
        details.found = true;
      }
    } catch (err) {
      debug(`Could not extract details from maps panel: ${err.message}`);
    }

    await context.close();
    return details;
  } catch (err) {
    error(`Error extracting clinic details from Google Maps: ${err.message}`);
    return {
      website: '',
      phone: '',
      address: '',
      found: false,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  extractClinicDetails,
};
