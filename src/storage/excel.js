/**
 * Excel Storage Module
 * Manages saving and managing lead data in Excel files
 * Uses XLSX package to create and append to Excel files
 * Prevents duplicate leads and maintains data integrity
 */

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');
const { info, error, warn, logAction, debug } = require('../utils/logger');

// Column headers for the Excel file
const HEADERS = [
  'Date Found',
  'Time',
  'Post ID',
  'Dentist Name',
  'Practice Name',
  'Location',
  'Website URL',
  'Post Text',
  'Comment Posted',
  'Status',
  'Source Group',
];

// Keep track of the workbook in memory
let workbook = null;
let worksheet = null;
let leads = []; // Keep all leads in memory for quick duplicate checking

/**
 * Initializes the Excel file
 * Creates new file with headers if it doesn't exist
 * Loads existing file if it does
 * 
 * @returns {Promise<void>}
 */
async function initExcel() {
  try {
    const filePath = config.excel.filePath;
    const fileDir = path.dirname(filePath);

    logAction('Initializing Excel file', { filePath });

    // Create data directory if it doesn't exist
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
      info(`✓ Created data directory: ${fileDir}`);
    }

    // Check if file exists
    if (fs.existsSync(filePath)) {
      // Load existing file
      info(`📂 Loading existing Excel file: ${filePath}`);
      workbook = XLSX.readFile(filePath);
      worksheet = workbook.Sheets[workbook.SheetNames[0]];

      // Load all existing leads into memory
      const data = XLSX.utils.sheet_to_json(worksheet);
      leads = data.map((row, index) => ({
        ...row,
        rowIndex: index + 2, // Row 1 is headers, so data starts at row 2
      }));

      info(`✓ Loaded existing Excel file with ${leads.length} leads`);
      logAction('Excel file initialized - loaded existing', { leadCount: leads.length });
    } else {
      // Create new file with headers
      info(`📄 Creating new Excel file: ${filePath}`);

      // Create workbook and worksheet
      workbook = XLSX.utils.book_new();
      worksheet = XLSX.utils.aoa_to_sheet([HEADERS]);

      // Set column widths for better readability
      worksheet['!cols'] = [
        { wch: 12 }, // Date Found
        { wch: 10 }, // Time
        { wch: 15 }, // Post ID
        { wch: 20 }, // Dentist Name
        { wch: 20 }, // Practice Name
        { wch: 15 }, // Location
        { wch: 30 }, // Website URL
        { wch: 40 }, // Post Text
        { wch: 25 }, // Comment Posted
        { wch: 12 }, // Status
        { wch: 20 }, // Source Group
      ];

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

      // Save the new file
      XLSX.writeFile(workbook, filePath);
      leads = [];

      info(`✓ Created new Excel file with headers`);
      logAction('Excel file initialized - created new', { filePath });
    }

    info('✅ Excel file ready for data storage');
  } catch (err) {
    error(`Failed to initialize Excel file: ${err.message}`, err);
    throw err;
  }
}

/**
 * Checks if a lead with the given post ID already exists
 * Prevents duplicate leads from being saved
 * 
 * @param {string} postId - The Facebook post ID
 * @returns {boolean} True if duplicate exists, false if new
 */
function checkDuplicate(postId) {
  try {
    const exists = leads.some(lead => lead['Post ID'] === postId);

    if (exists) {
      warn(`Duplicate detected: Post ID ${postId} already in Excel`);
      return true;
    }

    return false;
  } catch (err) {
    error(`Error checking duplicate: ${err.message}`, err);
    return false; // Default to not duplicate if error occurs
  }
}

/**
 * Saves a new lead to the Excel file
 * Never overwrites existing data
 * Always saves immediately to prevent data loss
 * 
 * @param {Object} leadData - Lead information object
 * @param {string} leadData.postId - Facebook post ID
 * @param {string} leadData.dentistName - Extracted dentist name
 * @param {string} leadData.practiceName - Extracted practice name
 * @param {string} leadData.location - Location if mentioned
 * @param {string} leadData.postText - Original post text
 * @param {string} leadData.commentPosted - Generated comment that was posted
 * @param {string} leadData.sourceGroup - Facebook group URL or name
 * @param {string} leadData.websiteUrl - Practice website (optional)
 * @returns {Promise<number>} Row number of saved lead or -1 if failed
 */
async function saveLead(leadData) {
  try {
    // Check for duplicates first
    if (checkDuplicate(leadData.postId)) {
      warn('Skipping duplicate lead');
      return -1;
    }

    logAction('Saving new lead to Excel', {
      postId: leadData.postId,
      dentistName: leadData.dentistName,
      practiceName: leadData.practiceName,
    });

    // Get current timestamp
    const now = new Date();
    const datePart = now.toLocaleDateString('en-US'); // MM/DD/YYYY
    const timePart = now.toLocaleTimeString('en-US'); // HH:MM:SS AM/PM

    // Prepare the row data
    const rowData = [
      datePart, // Date Found
      timePart, // Time
      leadData.postId || 'N/A', // Post ID
      leadData.dentistName || 'Unknown', // Dentist Name
      leadData.practiceName || 'Unknown', // Practice Name
      leadData.location || 'Not specified', // Location
      leadData.websiteUrl || '', // Website URL
      (leadData.postText || '').substring(0, 200), // Post Text (first 200 chars)
      leadData.commentPosted || 'N/A', // Comment Posted
      'New', // Status
      leadData.sourceGroup || 'Facebook Group', // Source Group
    ];

    // Add the row to the worksheet
    const rowIndex = leads.length + 2; // +1 for headers, +1 for next row
    XLSX.utils.sheet_add_aoa(worksheet, [rowData], { origin: rowIndex });

    // Update in-memory leads
    const newLead = {};
    HEADERS.forEach((header, index) => {
      newLead[header] = rowData[index];
    });
    newLead.rowIndex = rowIndex;
    leads.push(newLead);

    // Save the file immediately
    await saveExcelFile();

    logAction('Lead saved successfully', {
      rowNumber: rowIndex,
      dentistName: leadData.dentistName,
      practiceName: leadData.practiceName,
    });

    info(`✅ Lead saved to Excel (Row ${rowIndex}): ${leadData.dentistName} - ${leadData.practiceName}`);

    return rowIndex;
  } catch (err) {
    error(`Failed to save lead to Excel: ${err.message}`, err);
    return -1;
  }
}

/**
 * Saves the workbook to disk
 * Called after every new lead to prevent data loss
 * 
 * @returns {Promise<void>}
 */
async function saveExcelFile() {
  try {
    const filePath = config.excel.filePath;

    if (!workbook || !worksheet) {
      throw new Error('Excel workbook not initialized');
    }

    // Write to file
    XLSX.writeFile(workbook, filePath);

    debug(`📁 Excel file saved: ${filePath}`);
  } catch (err) {
    error(`Failed to save Excel file: ${err.message}`, err);
    throw err;
  }
}

/**
 * Gets statistics about the leads in Excel
 * Useful for daily summaries and reporting
 * 
 * @returns {Object} Statistics object
 */
function getLeadStats() {
  try {
    const now = new Date();
    const today = now.toLocaleDateString('en-US');

    const todayLeads = leads.filter(lead => {
      const leadDate = lead['Date Found'];
      return leadDate === today;
    });

    const stats = {
      totalLeads: leads.length,
      todayLeads: todayLeads.length,
      newLeads: leads.filter(lead => lead['Status'] === 'New').length,
      contactedLeads: leads.filter(lead => lead['Status'] === 'Contacted').length,
    };

    return stats;
  } catch (err) {
    error(`Error getting lead stats: ${err.message}`, err);
    return {
      totalLeads: 0,
      todayLeads: 0,
      newLeads: 0,
      contactedLeads: 0,
    };
  }
}

/**
 * Updates the status of a lead
 * @param {string} postId - Post ID to update
 * @param {string} newStatus - New status value
 * @returns {Promise<boolean>} True if updated successfully
 */
async function updateLeadStatus(postId, newStatus) {
  try {
    const leadIndex = leads.findIndex(lead => lead['Post ID'] === postId);

    if (leadIndex === -1) {
      warn(`Lead not found: ${postId}`);
      return false;
    }

    leads[leadIndex]['Status'] = newStatus;
    await saveExcelFile();

    logAction('Lead status updated', { postId, newStatus });
    info(`✓ Updated status for ${postId} to "${newStatus}"`);

    return true;
  } catch (err) {
    error(`Error updating lead status: ${err.message}`, err);
    return false;
  }
}

/**
 * Gets today's leads for quick reference
 * @returns {Array} Array of leads created today
 */
function getTodayLeads() {
  try {
    const now = new Date();
    const today = now.toLocaleDateString('en-US');

    return leads.filter(lead => lead['Date Found'] === today);
  } catch (err) {
    error(`Error getting today's leads: ${err.message}`, err);
    return [];
  }
}

module.exports = {
  initExcel,
  saveLead,
  checkDuplicate,
  saveExcelFile,
  getLeadStats,
  updateLeadStatus,
  getTodayLeads,
};
