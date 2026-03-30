const { OpenAI } = require('openai');
const logger = require('../../utils/logger');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate drafted response for reply
 */
async function generateDraftResponse(replyText, doctorName, clinicName) {
  try {
    const prompt = `You are Haris, owner of Dental Billing Aid. A potential dental client just replied to your cold email. Their reply is: "${replyText}". Write a short, warm, professional response that moves toward booking a 15 minute discovery call. Include the Calendly link placeholder [CALENDLY LINK]. Keep it under 100 words. Plain text only.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('[GPT] Failed to generate draft response:', error.message);
    return null;
  }
}

/**
 * Generate clinic research brief
 */
async function generateClinicBrief(clinicName, cityState, notes) {
  try {
    const prompt = `Research brief for clinic: ${clinicName} in ${cityState}. Available info: ${notes || 'None'}. Write one paragraph summary including: estimated size of practice, location, and any common pain points for dental offices managing billing and insurance. Keep it professional and concise.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('[GPT] Failed to generate clinic brief:', error.message);
    return null;
  }
}

/**
 * Generate confirmation email
 */
async function generateConfirmationEmail(prospectName, dateTime) {
  try {
    const prompt = `Write a short warm booking confirmation email from Haris at Dental Billing Aid to ${prospectName}. Confirm their discovery call is scheduled for ${dateTime}. Tell them it will be 15 minutes and they will be looking at whether Dental Billing Aid is a good fit for their practice, no pressure either way. Keep it under 80 words. Plain text only.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 120,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('[GPT] Failed to generate confirmation email:', error.message);
    return null;
  }
}

/**
 * Generate 24hr reminder email
 */
async function generateReminderEmail(prospectName, callTime) {
  try {
    const prompt = `Write a short reminder email from Haris at Dental Billing Aid to ${prospectName}. Remind them of their discovery call tomorrow at ${callTime}. Include a reschedule link placeholder [CALENDLY LINK] in case they need to change the time. Keep it under 50 words. Plain text only.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 80,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('[GPT] Failed to generate reminder email:', error.message);
    return null;
  }
}

/**
 * Generate post-call follow up email
 */
async function generatePostCallFollowUp(doctorName, clinicName) {
  try {
    const prompt = `Write a short post discovery call follow up email from Haris at Dental Billing Aid to Dr. ${doctorName} at ${clinicName}. Thank them for their time. Summarize that Dental Billing Aid handles billing, insurance verification and scheduling. Include a next steps line about moving forward or answering any questions. Include Calendly link placeholder [CALENDLY LINK]. Keep it under 100 words. Plain text only.`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0].message.content;
  } catch (error) {
    logger.error('[GPT] Failed to generate post-call follow up:', error.message);
    return null;
  }
}

module.exports = {
  generateDraftResponse,
  generateClinicBrief,
  generateConfirmationEmail,
  generateReminderEmail,
  generatePostCallFollowUp,
};
