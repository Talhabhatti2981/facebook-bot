/**
 * Clinic Website Scraper - Worker 1 Step 3
 * Extracts doctor name and email from clinic website
 */

const { chromium } = require('playwright');
const { info, error, warn, logAction, debug } = require('../../utils/logger');
const { randomDelay, shortDelay } = require('../../utils/delays');

/**
 * Extract doctor name and email from clinic website
 */
async function extractContactInfo(websiteUrl) {
  if (!websiteUrl || !websiteUrl.startsWith('http')) {
    debug(`Skipping invalid URL: ${websiteUrl}`);
    return { doctorName: '', email: '' };
  }

  let browser = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    debug(`Scraping website: ${websiteUrl}`);
    await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(err => {
      debug(`Navigation error: ${err.message}`);
    });

    let pageContent = await page.content();
    let doctorName = '';
    let email = '';

    // Try to find About or Contact page
    try {
      const links = await page.$$eval('a', links =>
        links.map(l => ({ href: l.href, text: l.textContent.toLowerCase() }))
      );

      let aboutUrl = null;
      for (const link of links) {
        if (link.text.includes('about') || link.text.includes('doctor') || link.text.includes('contact')) {
          aboutUrl = link.href;
          break;
        }
      }

      if (aboutUrl && aboutUrl.startsWith('http')) {
        await page.goto(aboutUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(err => {
          debug(`About page load error: ${err.message}`);
        });
        await randomDelay(800, 1500);
        pageContent = await page.content();
      }
    } catch (err) {
      debug(`Error finding About/Contact page: ${err.message}`);
    }

    // Extract email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = pageContent.match(emailRegex);
    if (emailMatches) {
      // Filter out common non-contact emails
      email = emailMatches.find(e => 
        !e.includes('noreply') && 
        !e.includes('no-reply') &&
        !e.includes('donotreply') &&
        !e.includes('admin@') &&
        !e.includes('support@') &&
        !e.includes('mail@') &&
        !e.includes('newsletter')
      ) || emailMatches[0] || '';
    }

    // Extract doctor name (look for common patterns)
    const namePatterns = [
      /Dr\.?\s+([A-Z][a-z]+\s[A-Z][a-z]+)/gi,
      /Doctor\s+([A-Z][a-z]+\s[A-Z][a-z]+)/gi,
      /Meet Our Dentist[^<]*?<[^>]*>([A-Z][a-z]+\s[A-Z][a-z]+)/gi,
    ];

    for (const pattern of namePatterns) {
      const match = pattern.exec(pageContent);
      if (match && match[1]) {
        doctorName = match[1];
        break;
      }
    }

    await context.close();

    return {
      doctorName: doctorName.trim(),
      email: email.trim(),
    };
  } catch (err) {
    error(`Error extracting contact info: ${err.message}`);
    return { doctorName: '', email: '' };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  extractContactInfo,
};
