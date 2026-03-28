# Dental Lead Generation Bot 🦷🤖

A sophisticated Facebook group monitoring bot that automatically identifies dental billing leads, saves them to Excel, and sends real-time Telegram notifications. Runs 24/7 on Oracle Cloud Free Tier or any VPS.

## Features

✅ **Facebook Group Monitoring**
- Automatically monitors specified Facebook groups for new posts
- Login with credentials from `.env` file
- Anti-detection: Random delays, user agent rotation, headless mode
- Scrolls through feed and collects all posts

✅ **AI-Powered Lead Qualification** (Phase 2)
- Uses OpenAI GPT-4o Mini to analyze post content
- Automatically identifies posts from dentists needing billing help
- Confidence threshold filtering to avoid false positives

✅ **Auto-Commenting** (Phase 2)
- Automatically comments on relevant posts with engagement
- Human-like behavior with random delays

✅ **Lead Storage & Management**
- Saves qualified leads to Excel file (`leads.xlsx`)
- Tracks lead name, contact info, post content, and timestamp
- Auto-saves and updates the file

✅ **Real-Time Notifications**
- Sends Telegram notifications when new leads are found
- Includes lead details and direct post link
- High-priority alert system

✅ **24/7 Uptime**
- PM2 process manager for continuous operation
- Auto-restart on crash
- Comprehensive logging system with daily rotation

✅ **Anti-Ban Protection**
- Random delays between all actions (1.5s - 5s)
- User agent rotation
- Headless browser mode
- Realistic human-like behavior

## Tech Stack

- **Node.js** v18+ - Runtime
- **Playwright** - Browser automation
- **OpenAI API** - AI-powered post analysis
- **XLSX** - Excel file generation
- **Telegram Bot API** - Notifications
- **Winston** - Logging system
- **PM2** - Process manager
- **Oracle Cloud/VPS** - Hosting

## Folder Structure

```
dental-lead-bot/
├── src/
│   ├── browser/
│   │   ├── facebook.js       # Facebook login & monitoring
│   │   ├── commenter.js      # Auto-comment logic (Phase 2)
│   │   └── scraper.js        # Lead info scraping (Phase 2)
│   ├── ai/
│   │   └── gpt.js            # GPT-4o Mini integration (Phase 2)
│   ├── notifications/
│   │   └── telegram.js       # Telegram alerts (Phase 2)
│   ├── storage/
│   │   └── excel.js          # Excel file operations (Phase 2)
│   ├── utils/
│   │   ├── delays.js         # Random delay helpers
│   │   └── logger.js         # Logging system
│   └── index.js              # Main entry point (Phase 2)
├── config/
│   └── config.js             # Configuration loader
├── data/
│   └── leads.xlsx            # Auto-generated Excel file
├── logs/
│   └── bot.log               # Bot logs (auto-rotated)
├── ecosystem.config.js       # PM2 configuration
├── .env                      # Secret keys (DO NOT COMMIT)
├── .gitignore
├── package.json
└── README.md
```

## Installation

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager
- Facebook account for the bot
- OpenAI API key (https://platform.openai.com)
- Telegram Bot Token (https://t.me/BotFather)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/dental-lead-bot.git
cd dental-lead-bot

# Install dependencies
npm install

# Install PM2 globally (for 24/7 uptime)
npm install -g pm2
```

### Step 2: Configure Environment

```bash
# Copy the .env template and fill in your credentials
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Environment Variables:**

```env
# Facebook Credentials
FACEBOOK_EMAIL=your_email@gmail.com
FACEBOOK_PASSWORD=your_password
FACEBOOK_GROUP_URL=https://www.facebook.com/groups/your_group_id/

# OpenAI Configuration
OPENAI_API_KEY=sk-your_key_here
OPENAI_MODEL=gpt-4o-mini

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Bot Settings
BOT_CHECK_INTERVAL_MINUTES=5
BOT_HEADLESS=true
BOT_RELEVANT_POST_THRESHOLD=0.7
```

### Step 3: Test the Setup

```bash
# Test Facebook connection
npm start

# The bot will:
# 1. Launch Playwright browser
# 2. Login to Facebook
# 3. Navigate to the group
# 4. Collect sample posts
# 5. Generate logs
```

### Step 4: Deploy with PM2

```bash
# Start the bot with PM2 (24/7 uptime)
npm run pm2:start

# Check status
pm2 status

# View logs in real-time
npm run pm2:logs

# Stop the bot
npm run pm2:stop

# Restart the bot
npm run pm2:restart

# Delete from PM2
npm run pm2:delete
```

## Configuration Details

### Bot Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `BOT_CHECK_INTERVAL_MINUTES` | 5 | How often to check for new posts |
| `BOT_MAX_POSTS_PER_CHECK` | 10 | Maximum posts to process per check |
| `BOT_RELEVANT_POST_THRESHOLD` | 0.7 | AI confidence threshold (0-1) |
| `BOT_HEADLESS` | true | Run browser in headless mode |

### Delay Settings (Anti-Ban Protection)

| Setting | Default | Purpose |
|---------|---------|---------|
| `MIN_DELAY_MS` | 1500 | Minimum delay between actions |
| `MAX_DELAY_MS` | 5000 | Maximum delay between actions |
| `POST_ACTION_DELAY_MS` | 2000 | Delay after clicks/scrolls |

### Logging

Logs are stored in `./logs/` directory with automatic daily rotation. Files are kept for 7 days.

```bash
# View current logs
tail -f logs/bot.log

# View error logs only
tail -f logs/error.log
```

## Usage

### Development Mode (with file watching)

```bash
npm run dev
```

### Production Mode

```bash
npm run pm2:start
pm2 logs dental-lead-bot
```

### Run Once and Exit

```bash
npm start
```

## Phase 1 (Current) - Completed ✅

- ✅ Folder structure
- ✅ Package.json with dependencies
- ✅ Configuration system with .env
- ✅ Delay utilities for anti-ban
- ✅ Winston logger with daily rotation
- ✅ Facebook browser automation
- ✅ PM2 configuration

## Phase 2 (Next)

- [ ] GPT-4o Mini integration for lead qualification
- [ ] Auto-comment functionality
- [ ] Lead scraper (extract contact info)
- [ ] Excel file management
- [ ] Telegram notifications
- [ ] Main index.js orchestrator

## Phase 3 (Future)

- [ ] Web dashboard for monitoring
- [ ] Advanced analytics
- [ ] Multiple group support
- [ ] Database integration (MongoDB)
- [ ] REST API

## Deployment on Oracle Cloud Free Tier

### Prerequisites
- Oracle Cloud account (free)
- Ubuntu 22.04 VM (free)
- SSH access to your VM

### Setup Steps

```bash
# 1. SSH into your VM
ssh -i your_key.key ubuntu@your_public_ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone your bot
git clone https://github.com/yourusername/dental-lead-bot.git
cd dental-lead-bot

# 4. Install dependencies
npm install
npm install -g pm2

# 5. Configure .env with your credentials
nano .env

# 6. Start with PM2
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

Your bot will now run 24/7 even if you disconnect!

## Troubleshooting

### Facebook Login Fails
- Check if credentials are correct in .env
- Facebook might require 2FA - disable temporarily or use app password
- Try setting `BOT_HEADLESS=false` to see what's happening

### Telegram Notifications Not Working
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Verify `TELEGRAM_CHAT_ID` is correct
- Send a message to your bot: `@your_bot_name`
- Get your chat ID: https://t.me/userinfobot

### Browser Crashes
- Increase memory limit: `max_memory_restart: '4G'` in ecosystem.config.js
- Close other applications on the server
- Check available system memory: `free -h`

### Posts Not Being Found
- Verify `FACEBOOK_GROUP_URL` is a public or private group you're a member of
- Check group privacy settings
- Increase `BOT_MAX_POSTS_PER_CHECK` to scroll more

### High CPU/Memory Usage
- Reduce `BOT_CHECK_INTERVAL_MINUTES` (less frequent checks)
- Lower `BOT_MAX_POSTS_PER_CHECK` (process fewer posts)
- Enable `BOT_HEADLESS=true`

## Security Best Practices

⚠️ **Important Security Notes:**

1. **Never commit .env file** - Add to .gitignore (already done)
2. **Use strong Facebook password** - Consider app-specific passwords
3. **Rotate API keys regularly** - Especially OpenAI and Telegram
4. **Run on trusted VPS** - Don't run on shared hosting
5. **Monitor logs for suspicious activity**
6. **Use VPN if running locally** - Avoid IP bans

## Performance Tips

- Set `BOT_HEADLESS=true` for better performance
- Reduce delay times ONLY after testing (minimum 1000ms recommended)
- Run on server with at least 2GB RAM
- Monitor with: `pm2 monit`
- Use SSD for faster I/O

## API Costs

**Estimated Monthly Costs:**

- **Facebook & Telegram**: FREE
- **OpenAI API** (with GPT-4o Mini): ~$0.15-$1/day depending on posts
- **Oracle Cloud VPS**: FREE (free tier)
- **Total**: $0-$30/month

## Support & Updates

- 📖 Check logs: `pm2 logs dental-lead-bot`
- 🐛 Report bugs: Create GitHub issues
- 💬 Discussions: GitHub discussions
- 📧 Contact: your_email@example.com

## License

MIT License - Feel free to use commercially

## Disclaimer

⚠️ **Important Legal Notes:**

1. Use only for lawful purposes and with permission
2. Respect Facebook Terms of Service
3. Don't spam or harass users
4. Comply with GDPR/CCPA if applicable
5. The author is not responsible for misuse
6. Always get user consent before contacting them

---

**Happy lead hunting! 🎯**

For Phase 2 setup instructions, see the next section in this repo.
