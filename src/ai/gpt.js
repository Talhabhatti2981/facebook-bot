/**
 * OpenAI GPT-4o Mini Integration Module
 * Handles AI-powered post analysis, comment generation, and lead extraction
 * Uses OpenAI GPT-4o Mini model for fast and cost-effective inference
 */

const { OpenAI } = require('openai');
const config = require('../../config/config');
const { info, error, warn, logAction, debug } = require('../utils/logger');
const { shortDelay } = require('../utils/delays');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Common configuration for all OpenAI API calls
 */
const gptConfig = {
  model: config.openai.model || 'gpt-4o-mini',
  max_tokens: 500,
  temperature: 0.7,
};

/**
 * Analyzes a post to determine if it's relevant to dental billing services
 * Checks if the author is looking for billing help, complaining about billing, or is a practice owner
 * 
 * @param {string} postText - The Facebook post text to analyze
 * @returns {Promise<boolean>} True if post is relevant to dental billing
 */
async function isPostRelevant(postText) {
  try {
    if (!postText || postText.trim().length === 0) {
      debug('Skipping empty post text');
      return false;
    }

    logAction('Analyzing post relevance with GPT-4o Mini', { textLength: postText.length });

    const systemPrompt = `You are an assistant for a dental billing company. Read this Facebook post and decide if the person is looking for dental billing services, complaining about billing issues, or is a dental practice owner. 

Return ONLY valid JSON with this exact format:
{
  "relevant": true or false,
  "reason": "brief explanation"
}

Consider posts relevant if they mention: dentist, dental practice, billing issues, insurance claims, practice management, dental office, or similar.`;

    const response = await openai.chat.completions.create({
      model: gptConfig.model,
      max_tokens: gptConfig.max_tokens,
      temperature: gptConfig.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this post:\n\n${postText.substring(0, 1000)}`, // Limit to 1000 chars to avoid token overflow
        },
      ],
    });

    // Parse the response
    const responseText = response.choices[0].message.content.trim();
    info(`[OPENAI API] isPostRelevant() response: ${responseText}`);

    const result = JSON.parse(responseText);

    logAction('Post relevance analysis complete', {
      relevant: result.relevant,
      reason: result.reason,
    });

    // Add delay to respect API rate limits
    await shortDelay();

    return result.relevant || false;
  } catch (err) {
    error(`Error analyzing post relevance: ${err.message}`, err);

    // Log specific OpenAI errors
    if (err.response) {
      error(`OpenAI API Error - Status: ${err.response.status}`, err);
    }

    warn('Assuming post is not relevant due to API error');
    await shortDelay(); // Still add delay
    return false;
  }
}

/**
 * Generates a natural, human-like comment for a relevant post
 * Simulates a friendly dental billing company representative
 * 
 * @param {string} postText - The Facebook post text to comment on
 * @returns {Promise<string>} Generated comment or null if generation fails
 */
async function generateComment(postText) {
  try {
    if (!postText || postText.trim().length === 0) {
      warn('Cannot generate comment for empty post text');
      return null;
    }

    logAction('Generating comment with GPT-4o Mini', { textLength: postText.length });

    const systemPrompt = `You are a friendly and helpful representative of a dental billing company. Write a short, natural, genuine comment (max 2-3 sentences) responding to this Facebook post. 

Be helpful, don't sound like a bot, and offer to help if relevant. Keep it conversational and friendly.

Return ONLY the comment text, nothing else. No JSON, no system message, just the comment.`;

    const response = await openai.chat.completions.create({
      model: gptConfig.model,
      max_tokens: 150, // Comments should be short
      temperature: gptConfig.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Write a comment for this post:\n\n${postText.substring(0, 1000)}`,
        },
      ],
    });

    const comment = response.choices[0].message.content.trim();

    logAction('Comment generated successfully', {
      commentLength: comment.length,
      preview: comment.substring(0, 100),
    });

    info(`[OPENAI API] Generated comment: "${comment}"`);

    // Add delay to respect API rate limits
    await shortDelay();

    return comment;
  } catch (err) {
    error(`Error generating comment: ${err.message}`, err);
    warn('Could not generate comment - will skip this post');
    await shortDelay();
    return null;
  }
}

/**
 * Extracts lead information from a post using AI
 * Identifies: dentist name, practice name, and location
 * 
 * @param {string} postText - The Facebook post text
 * @param {string} profileName - The Facebook profile name of the post author
 * @returns {Promise<Object>} Lead info: { dentistName, practiceName, location }
 */
async function extractLeadInfo(postText, profileName) {
  try {
    if (!postText || postText.trim().length === 0) {
      warn('Cannot extract lead info from empty post text');
      return { dentistName: null, practiceName: null, location: null };
    }

    logAction('Extracting lead information with GPT-4o Mini', { profileName });

    const systemPrompt = `You are analyzing a Facebook post from a dental professional. Extract the following information if mentioned:
- dentistName: The person's name (use profile name if not in post)
- practiceName: The dental practice/office name
- location: City, state, or general location

Return ONLY valid JSON with this exact format:
{
  "dentistName": "name or null",
  "practiceName": "practice name or null",
  "location": "location or null"
}

If information is not found, use null values.`;

    const response = await openai.chat.completions.create({
      model: gptConfig.model,
      max_tokens: gptConfig.max_tokens,
      temperature: 0.3, // Lower temperature for factual extraction
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Profile name: ${profileName}\n\nPost text:\n${postText.substring(0, 1000)}`,
        },
      ],
    });

    const responseText = response.choices[0].message.content.trim();
    const leadInfo = JSON.parse(responseText);

    logAction('Lead information extracted', {
      dentistName: leadInfo.dentistName,
      practiceName: leadInfo.practiceName,
      location: leadInfo.location,
    });

    info(`[OPENAI API] Extracted lead: ${JSON.stringify(leadInfo)}`);

    // Add delay to respect API rate limits
    await shortDelay();

    return leadInfo;
  } catch (err) {
    error(`Error extracting lead info: ${err.message}`, err);
    warn('Could not extract lead info - returning null values');
    await shortDelay();
    return { dentistName: null, practiceName: null, location: null };
  }
}

/**
 * Generic function to call OpenAI API with retry logic
 * Used internally for more complex scenarios
 * 
 * @param {string} systemPrompt - System prompt for the AI
 * @param {string} userMessage - User message/content
 * @param {number} maxTokens - Maximum tokens to generate
 * @returns {Promise<string>} API response text
 */
async function callOpenAI(systemPrompt, userMessage, maxTokens = 500) {
  let lastError = null;

  // Try twice with retry logic
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      logAction(`OpenAI API call (Attempt ${attempt})`, { messageLength: userMessage.length });

      const response = await openai.chat.completions.create({
        model: gptConfig.model,
        max_tokens: maxTokens,
        temperature: gptConfig.temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      const result = response.choices[0].message.content.trim();
      logAction('OpenAI API call successful');
      await shortDelay();

      return result;
    } catch (err) {
      lastError = err;
      error(`OpenAI API error (Attempt ${attempt}): ${err.message}`, err);

      if (attempt < 2) {
        warn(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // If we get here, both attempts failed
  throw new Error(`OpenAI API failed after 2 attempts: ${lastError.message}`);
}

/**
 * Tests the OpenAI API connection
 * @returns {Promise<boolean>} True if connection successful
 */
async function testConnection() {
  try {
    logAction('Testing OpenAI API connection');

    const response = await openai.chat.completions.create({
      model: gptConfig.model,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: 'Say "API connection successful" in exactly those words.',
        },
      ],
    });

    const result = response.choices[0].message.content;
    info(`✓ OpenAI API connection successful: ${result}`);
    return true;
  } catch (err) {
    error(`OpenAI API connection failed: ${err.message}`, err);
    return false;
  }
}

module.exports = {
  isPostRelevant,
  generateComment,
  extractLeadInfo,
  callOpenAI,
  testConnection,
};
