/**
 * Google Sheets Integration
 * Shared module for all workers to read/write to central Google Sheet
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const config = require('../../config/config');
const { info, error, warn, logAction, debug } = require('../utils/logger');

let sheets = null;
let auth = null;

/**
 * Initialize Google Sheets authentication
 */
async function initializeAuth() {
  try {
    // Use service account credentials from .env
    const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
    
    if (!credentials.type || !credentials.project_id) {
      throw new Error('Invalid or missing GOOGLE_SHEETS_CREDENTIALS in .env');
    }

    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    info('✅ Google Sheets authenticated successfully');
    return true;
  } catch (err) {
    error(`❌ Google Sheets auth failed: ${err.message}`);
    return false;
  }
}

/**
 * Get all leads from Google Sheet
 */
async function getAllLeads() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSheets.spreadsheetId,
      range: 'Leads!A:M',
    });

    const rows = response.data.values || [];
    if (rows.length === 0) {
      debug('No leads found in sheet');
      return [];
    }

    // Skip header row and convert to objects
    const headers = rows[0];
    const leads = rows.slice(1).map(row => {
      const lead = {};
      headers.forEach((header, index) => {
        lead[header] = row[index] || '';
      });
      return lead;
    });

    return leads;
  } catch (err) {
    error(`Failed to fetch leads from sheet: ${err.message}`);
    return [];
  }
}

/**
 * Check if clinic already exists by name
 */
async function clinicExists(clinicName) {
  try {
    const leads = await getAllLeads();
    return leads.some(lead => lead['Clinic Name']?.toLowerCase() === clinicName.toLowerCase());
  } catch (err) {
    error(`Error checking clinic existence: ${err.message}`);
    return false;
  }
}

/**
 * Add new lead to Google Sheet
 */
async function addLead(leadData) {
  try {
    // Check for duplicate
    const exists = await clinicExists(leadData.clinicName);
    if (exists) {
      debug(`Clinic ${leadData.clinicName} already exists, skipping`);
      return false;
    }

    const timestamp = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const row = [
      leadData.clinicName,
      leadData.doctorName || '',
      leadData.email || '',
      leadData.phone || '',
      leadData.address || '',
      leadData.city || '',
      leadData.state || '',
      leadData.leadSource || 'Indeed',
      'Hot',
      'New',
      1,
      tomorrow,
      '',
      timestamp,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSheets.spreadsheetId,
      range: 'Leads!A:N',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    logAction(`✅ Lead added: ${leadData.clinicName}`, leadData);
    return true;
  } catch (err) {
    error(`Failed to add lead to sheet: ${err.message}`);
    return false;
  }
}

/**
 * Update lead status in Google Sheet
 */
async function updateLeadStatus(clinicName, updates) {
  try {
    const leads = await getAllLeads();
    const rowIndex = leads.findIndex(l => l['Clinic Name']?.toLowerCase() === clinicName.toLowerCase());

    if (rowIndex === -1) {
      warn(`Lead ${clinicName} not found for update`);
      return false;
    }

    const rowNum = rowIndex + 2; // +1 for header, +1 for 1-based indexing
    const updateData = [];

    // Build update with only provided fields
    if (updates.status) {
      updateData.push({ range: `Leads!I${rowNum}`, values: [[updates.status]] });
    }
    if (updates.sequenceDay) {
      updateData.push({ range: `Leads!K${rowNum}`, values: [[updates.sequenceDay]] });
    }
    if (updates.nextActionDate) {
      updateData.push({ range: `Leads!L${rowNum}`, values: [[updates.nextActionDate]] });
    }
    if (updates.notes) {
      updateData.push({ range: `Leads!M${rowNum}`, values: [[updates.notes]] });
    }

    updateData.push({ range: `Leads!N${rowNum}`, values: [[new Date().toISOString()]] });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: config.googleSheets.spreadsheetId,
      requestBody: {
        data: updateData,
        valueInputOption: 'USER_ENTERED',
      },
    });

    return true;
  } catch (err) {
    error(`Failed to update lead: ${err.message}`);
    return false;
  }
}

module.exports = {
  initializeAuth,
  getAllLeads,
  clinicExists,
  addLead,
  updateLeadStatus,
};
