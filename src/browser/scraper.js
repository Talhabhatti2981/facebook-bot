/**
 * Facebook Profile & Website Scraper Module
 * Extracts information from Facebook profiles and finds practice websites
 * Uses Playwright for browser automation and Google search fallback
 */

const { chromium } = require('playwright');
const config = require('../../config/config');
const { randomDelay, shortDelay, getRandomUserAgent } = require('../utils/delays');
const { info, error, warn, logAction, debug } = require('../utils/logger');

/**
 * Scrapes a Facebook profile for contact information
 * Extracts: name, website, location, about section
 * 
 * @param {string} profileUrl - Facebook profile URL
 * @returns {Promise<Object>} Profile info: { name, website, location, about }
 */
async function scrapeProfile(profileUrl) {
  let browser = null;
  let page = null;

  try {
    if (!profileUrl || !profileUrl.includes('facebook.com')) {
      warn(`Invalid profile URL: ${profileUrl}`);
      return { name: null, website: null, location: null, about: null };
    }

    logAction('Starting profile scrape', { profileUrl });

    // Launch browser
    browser = await chromium.launch({
      headless: config.facebook.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    // Create context with user agent
    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();
    page.setDefaultTimeout(15000);

    info(`→ Navigating to profile: ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await randomDelay(1500, 2500);

    // Extract profile information
    const profileData = await page.evaluate(() => {
      const data = {
        name: null,
        website: null,
        location: null,
        about: null,
      };

      try {
        // Extract name
        const nameElement = document.querySelector('[data-testid="profile_name"]') ||
                           document.querySelector('h1') ||
                           document.querySelector('[role="img"][aria-label]');
        if (nameElement) {
          data.name = nameElement.innerText || nameElement.getAttribute('aria-label');
        }

        // Extract from about section
        const aboutElements = document.querySelectorAll('[data-testid="intro_card_field"]');
        aboutElements.forEach(el => {
          const text = el.innerText || '';

          // Look for website
          if (text.includes('website') || text.includes('www')) {
            const link = el.querySelector('a');
            if (link) {
              data.website = link.href || link.innerText;
            }
          }

          // Look for location
          if (text.includes('Lives in') || text.includes('From')) {
            const location = el.querySelector('a');
            if (location) {
              data.location = location.innerText;
            }
          }
        });

        // Try alternative location selectors
        if (!data.location) {
          const locationLink = document.querySelector('a[href*="living_places"]') ||
                              document.querySelector('a[href*="hometowns"]');
          if (locationLink) {
            data.location = locationLink.innerText;
          }
        }

        // Extract about info from "About" section
        const aboutSection = document.querySelector('[data-testid="timeline_about"]') ||
                            document.querySelector('[data-testid="bios_sections"]');
        if (aboutSection) {
          data.about = aboutSection.innerText.substring(0, 200);
        }
      } catch (e) {
        // Silently continue if extraction fails
      }

      return data;
    });

    logAction('Profile scrape completed', {
      name: profileData.name,
      website: profileData.website,
      location: profileData.location,
    });

    info(`✓ Scraped profile: ${profileData.name}`);

    // Cleanup
    await page.close();
    await context.close();
    await browser.close();

    return profileData;
  } catch (err) {
    error(`Error scraping profile: ${err.message}`, err);
    warn(`Failed to scrape profile, returning empty data`);

    return { name: null, website: null, location: null, about: null };
  } finally {
    // Ensure browser is closed
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        debug(`Error closing browser: ${e.message}`);
      }
    }
  }
}

/**
 * Finds a dental practice website using Google search
 * Searches for "{practice name} dental {location} website"
 * 
 * @param {string} practiceName - Dental practice name
 * @param {string} location - Practice location
 * @returns {Promise<string>} Website URL or null if not found
 */
async function findPracticeWebsite(practiceName, location) {
  let browser = null;
  let page = null;

  try {
    if (!practiceName) {
      warn('Practice name is required to find website');
      return null;
    }

    logAction('Finding practice website', { practiceName, location });

    // Build search query
    const searchQuery = location
      ? `${practiceName} dental ${location} website`
      : `${practiceName} dental practice website`;

    info(`🔍 Searching for: "${searchQuery}"`);

    // Launch browser
    browser = await chromium.launch({
      headless: config.facebook.headless,
      args: ['--disable-blink-features=AutomationControlled'],
    });

    const context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();
    page.setDefaultTimeout(15000);

    // Navigate to Google
    info('→ Opening Google...');
    await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
    await randomDelay(800, 1200);

    // Search for the practice
    const searchBox = await page.locator('input[name="q"]').first();
    await searchBox.focus();
    await randomDelay(200, 400);

    // Type search query
    for (const char of searchQuery) {
      await page.keyboard.type(char);
      await new Promise(resolve => setTimeout(resolve, getRandomDelay(30, 80)));
    }

    await randomDelay(500, 800);

    // Press Enter to search
    await page.keyboard.press('Enter');
    await randomDelay(2000, 3000); // Wait for results

    // Extract first result URL
    const firstResultUrl = await page.evaluate(() => {
      const link = document.querySelector('a[href*="http"]');
      if (link && link.href && !link.href.includes('google.com')) {
        return link.href;
      }

      // Try alternative selector
      const results = document.querySelectorAll('div.g a');
      for (const result of results) {
        const href = result.getAttribute('href');
        if (href && href.startsWith('http') && !href.includes('google.com')) {
          return href;
        }
      }

      return null;
    });

    if (firstResultUrl) {
      logAction('Practice website found', {
        practiceName,
        website: firstResultUrl,
      });
      info(`✓ Found website: ${firstResultUrl}`);
    } else {
      warn(`No website found for ${practiceName}`);
    }

    // Cleanup
    await page.close();
    await context.close();
    await browser.close();

    return firstResultUrl || null;
  } catch (err) {
    error(`Error finding practice website: ${err.message}`, err);
    warn(`Failed to find website for ${practiceName}, returning null`);

    return null;
  } finally {
    // Ensure browser is closed
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        debug(`Error closing browser: ${e.message}`);
      }
    }
  }
}

/**
 * Extracts contact links from a Facebook post author's profile
 * Looks for email, phone, or website in the about section
 * 
 * @param {string} profileUrl - Facebook profile URL
 * @returns {Promise<Object>} Contact info: { email, phone, website }
 */
async function extractContactInfo(profileUrl) {
  try {
    logAction('Extracting contact info from profile', { profileUrl });

    // First scrape the profile
    const profileData = await scrapeProfile(profileUrl);

    const contactInfo = {
      email: null,
      phone: null,
      website: profileData.website,
    };

    // Try to extract email and phone from about section
    if (profileData.about) {
      // Simple regex for email
      const emailMatch = profileData.about.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (emailMatch) {
        contactInfo.email = emailMatch[0];
      }

      // Simple regex for phone
      const phoneMatch = profileData.about.match(/(\(\d{3}\)|\d{3})[- ]?\d{3}[- ]?\d{4}/);
      if (phoneMatch) {
        contactInfo.phone = phoneMatch[0];
      }
    }

    logAction('Contact info extracted', contactInfo);

    return contactInfo;
  } catch (err) {
    error(`Error extracting contact info: ${err.message}`, err);
    return { email: null, phone: null, website: null };
  }
}

module.exports = {
  scrapeProfile,
  findPracticeWebsite,
  extractContactInfo,
};
