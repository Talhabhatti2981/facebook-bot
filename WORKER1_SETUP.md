# Worker 1 - Lead Discovery Setup Guide

## Overview

Worker 1 runs every day at 6:00 AM to discover new dental clinic leads from Indeed. It:

1. **Scrapes Indeed.com** for dental job postings (max 5 days old)
2. **Extracts clinic details** from Google Maps (phone, address, website)
3. **Scrapes clinic websites** for doctor name and email
4. **Adds leads to Google Sheet** with automatic deduplication
5. **Sends Telegram report** with daily results

## Prerequisites

- Google Sheets API enabled
- Service account credentials (JSON file)
- Google Sheets spreadsheet created
- Telegram bot token configured
- Node.js dependencies installed

## Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Sheets API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click "Enable"
4. Create a Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill in the details and click "Create and Continue"
   - Skip the next steps and click "Done"
5. Create a key:
   - Click on the service account you just created
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose "JSON"
   - A JSON file will download
6. Copy the contents of this JSON file

## Step 2: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Rename the first sheet to "Leads"
4. Add these column headers in the first row:

```
A: Clinic Name
B: Doctor Name
C: Direct Email
D: Clinic Phone
E: City / State
F: Lead Source
G: Lead Temperature
H: Status
I: Current Sequence Day
J: Next Action Date
K: Notes
L: Last Updated
```

5. Share the sheet with the service account email address (found in the JSON file)
6. Copy the spreadsheet ID from the URL (it's the long string between `/d/` and `/edit`)

## Step 3: Configure .env

Add these variables to your `.env` file:

```env
# Google Sheets Configuration
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"..."}
```

For the credentials, paste the entire JSON content from the service account key file (as a single-line JSON string).

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Test Worker 1 Manually

Test the worker before scheduling it:

```bash
node src/workers/worker1/index.js
```

You should see:
- ✅ Google Sheets authenticated
- 📍 Indeed jobs found
- 🗺️  Google Maps extraction
- 🌐 Website scraping
- ✅ Leads added to sheet
- 📱 Telegram report sent

## Step 6: Deploy with PM2

Start the bot with all workers:

```bash
npm run pm2:start
```

Check logs:

```bash
npm run pm2:logs
```

Worker 1 will automatically run at 6:00 AM daily.

## How It Works

### Step 1: Indeed Scraping
- Searches for 5 keywords: "dental biller", "dental billing coordinator", etc.
- Collects job postings posted within 5 days
- Extracts: clinic name, city, state, job URL, job title

### Step 2: Google Maps Lookup
- Searches Google Maps for each clinic: "[Clinic Name] [City] [State]"
- Extracts: website, phone number, full address
- Uses random delays (2-4 seconds) between requests

### Step 3: Website Scraping
- Opens the clinic website
- Looks for About or Contact page
- Extracts doctor name and email using regex patterns
- If no email found, just saves the domain

### Step 4: Google Sheet Save
- Checks if clinic already exists (deduplication)
- If new, adds a row with:
  - Clinic Name, Doctor Name, Email, Phone, Address
  - Lead Source: "Indeed"
  - Lead Temperature: "Hot"
  - Status: "New"
  - Current Sequence Day: 1
  - Next Action Date: Tomorrow (for Worker 3)
  - Last Updated: Current timestamp

### Step 5: Telegram Report
If leads found:
```
Discovery complete ✅ — [X] new leads added today. [X] from Indeed (Hot)
```

If no leads:
```
Discovery complete ✅ — No new leads found today
```

## Troubleshooting

### "Google Sheets authenticated failed"
- Check that GOOGLE_SHEETS_CREDENTIALS is valid JSON
- Check that the service account email has access to the sheet
- Verify the spreadsheet exists and is not in trash

### "No Indeed jobs found"
- Indeed sometimes blocks scrapers - normal behavior
- Try waiting 24 hours before the next run
- Check the logs for specific error messages

### "Website scraping failed"
- Not all websites can be scraped (some have JavaScript protection)
- The worker logs the error but continues - this is normal
- Email extraction relies on simple patterns and may miss some emails

### No Telegram message sent
- Check TELEGRAM_BOT_TOKEN is correct
- Check TELEGRAM_CHAT_ID is correct
- Verify you've started a conversation with the bot

## Configuration Options

You can adjust timing in `ecosystem.config.js`:

```javascript
// Change from 6:00 AM to 8:00 AM
cron_restart: '0 8 * * *'

// Change from daily to twice daily (6 AM and 6 PM)
cron_restart: '0 6,18 * * *'
```

## Google Sheet Status Values

- **Status**: New, Contacted, Replied, Booked, Won, Lost, Sequence Complete, Re-engaged
- **Temperature**: Hot, Warm, Cold
- **Sequence Day**: 1, 4, 9, 14, 75
- **Lead Source**: Indeed, FB Group, Dental Nachos, Manual

## Next Steps

Once Worker 1 is running successfully:
- Build Worker 3 for email outreach
- Build Worker 4 for reply detection
- Build Worker 5 for booking management
