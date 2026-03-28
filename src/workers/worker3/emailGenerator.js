/**
 * Email Generator using GPT-4o Mini
 * Generates personalized cold emails for leads
 */

const { OpenAI } = require('openai');
const config = require('../../../config/config');
const { info, error, logAction, debug } = require('../../utils/logger');
const { shortDelay } = require('../../utils/delays');

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Generate Day 1 email (initial outreach)
 */
async function generateDay1Email(lead) {
  try {
    const { clinicName, doctorName, city, state, leadSource } = lead;

    let prompt = '';

    if (leadSource === 'Indeed') {
      prompt = `Write a short personalized cold email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName} in ${city}, ${state}. They are currently hiring a dental billing coordinator on Indeed. The angle is: before committing to a $40,000 salary plus benefits, would it be worth a 10 minute conversation to see if outsourced billing covers everything for a fraction of that cost. Keep it under 100 words. Plain text only. No subject line. Sound human not salesy.`;
    } else {
      prompt = `Write a short personalized cold email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName} in ${city}, ${state}. Introduce Dental Billing Aid which handles dental billing, insurance verification and appointment scheduling for dental practices. Offer a free 2 week trial. Keep it under 100 words. Plain text only. No subject line. Sound human not salesy.`;
    }

    const message = await openai.messages.create({
      model: config.openai.model,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    await shortDelay();

    const emailText = message.content[0].type === 'text' ? message.content[0].text : '';
    logAction('Generated Day 1 email', { doctor: doctorName, clinic: clinicName });
    return emailText.trim();
  } catch (err) {
    error(`Error generating Day 1 email: ${err.message}`);
    return '';
  }
}

/**
 * Generate Day 4 email (follow-up)
 */
async function generateDay4Email(lead) {
  try {
    const { clinicName, doctorName, city, state } = lead;

    const prompt = `Write a very short follow up email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName}. This is a follow up to a previous email about outsourced dental billing. One line check in asking if they had a chance to see the previous note. Add one sentence about how practices typically reduce claim denials by 30% with outsourced billing. Include Calendly link placeholder [CALENDLY_LINK]. Keep it under 60 words. Plain text only. Sound human.`;

    const message = await openai.messages.create({
      model: config.openai.model,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    await shortDelay();

    const emailText = message.content[0].type === 'text' ? message.content[0].text : '';
    logAction('Generated Day 4 email', { doctor: doctorName });
    return emailText.trim();
  } catch (err) {
    error(`Error generating Day 4 email: ${err.message}`);
    return '';
  }
}

/**
 * Generate Day 9 email (free trial offer)
 */
async function generateDay9Email(lead) {
  try {
    const { clinicName, doctorName, city, state } = lead;

    const prompt = `Write a short email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName}. Offer a completely free 2 week trial of insurance verification or billing services, no commitment needed. Include Calendly link placeholder [CALENDLY_LINK]. Keep it under 80 words. Plain text only. Sound human not salesy.`;

    const message = await openai.messages.create({
      model: config.openai.model,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    await shortDelay();

    const emailText = message.content[0].type === 'text' ? message.content[0].text : '';
    logAction('Generated Day 9 email', { doctor: doctorName });
    return emailText.trim();
  } catch (err) {
    error(`Error generating Day 9 email: ${err.message}`);
    return '';
  }
}

/**
 * Generate Day 14 email (easy out)
 */
async function generateDay14Email(lead) {
  try {
    const { clinicName, doctorName } = lead;

    const prompt = `Write a final short email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName}. Give them an easy out — say that if billing is not a priority right now that is completely fine, just let him know and he won't follow up again. Keep it under 50 words. Plain text only. Sound human.`;

    const message = await openai.messages.create({
      model: config.openai.model,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    await shortDelay();

    const emailText = message.content[0].type === 'text' ? message.content[0].text : '';
    logAction('Generated Day 14 email', { doctor: doctorName });
    return emailText.trim();
  } catch (err) {
    error(`Error generating Day 14 email: ${err.message}`);
    return '';
  }
}

/**
 * Generate Day 75 email (re-engagement)
 */
async function generateDay75Email(lead) {
  try {
    const { clinicName, doctorName, city, state } = lead;

    const prompt = `Write a short re-engagement email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName}. It has been a couple of months since last contact. Check in to see if their billing situation has changed. Mention Dental Billing Aid handles billing, insurance verification and scheduling. Include Calendly link placeholder [CALENDLY_LINK]. Keep it under 80 words. Plain text only. Sound human.`;

    const message = await openai.messages.create({
      model: config.openai.model,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    await shortDelay();

    const emailText = message.content[0].type === 'text' ? message.content[0].text : '';
    logAction('Generated Day 75 email', { doctor: doctorName });
    return emailText.trim();
  } catch (err) {
    error(`Error generating Day 75 email: ${err.message}`);
    return '';
  }
}

module.exports = {
  generateDay1Email,
  generateDay4Email,
  generateDay9Email,
  generateDay14Email,
  generateDay75Email
};
