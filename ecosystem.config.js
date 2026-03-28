/**
 * PM2 Ecosystem Configuration
 * Configures the dental-lead-bot to run continuously on a server
 * Includes auto-restart on crash, log rotation, and monitoring
 */

module.exports = {
  apps: [
    {
      // App name (used in pm2 commands)
      name: 'dental-lead-bot',
      
      // Main script
      script: './src/index.js',
      
      // How many instances to run (set to 1 for single instance)
      instances: 1,
      
      // Execution mode (fork: single instance, cluster: multiple instances)
      exec_mode: 'fork',
      
      // Auto-restart after crash
      autorestart: true,
      
      // Max memory allowed (2GB - adjust as needed)
      max_memory_restart: '2G',
      
      // Watch directories for changes (disable in production)
      watch: false,
      
      // Ignore files for watch mode
      watch_ignore: ['node_modules', 'logs', 'data'],
      
      // Environment variables for production
      env: {
        NODE_ENV: 'production',
      },
      
      // Environment variables for development
      env_development: {
        NODE_ENV: 'development',
      },
      
      // Log files
      out_file: './logs/dental-lead-bot.log',
      error_file: './logs/dental-lead-bot-error.log',
      
      // Log date format
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Keep the bot running if it crashes multiple times quickly
      min_uptime: '10s',
      max_restarts: 10,
      wait_ready: false,
      listen_timeout: 3000,
      kill_timeout: 5000,
      
      // Graceful stop/restart
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Consider app crashed if it exits with this code (negative numbers mean successful exit)
      exit_code: 1,
      
      // Interpreter
      interpreter: 'node',
      
      // Interpreter args
      interpreter_args: '--max-old-space-size=2048',
    },
    {
      // Worker 1 - Lead Discovery
      name: 'worker-1-discovery',
      script: './src/workers/worker1/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      
      // Cron schedule: 6:00 AM every day
      cron_restart: '0 6 * * *',
      
      env: {
        NODE_ENV: 'production',
      },
      
      out_file: './logs/worker-1.log',
      error_file: './logs/worker-1-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      min_uptime: '10s',
      max_restarts: 5,
      kill_timeout: 5000,
    },
    {
      // Worker 3 - Email Outreach Sequence
      name: 'worker-3-outreach',
      script: './src/workers/worker3/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      
      // Cron schedule: 7:30 AM every day
      cron_restart: '30 7 * * *',
      
      env: {
        NODE_ENV: 'production',
      },
      
      out_file: './logs/worker-3.log',
      error_file: './logs/worker-3-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      min_uptime: '10s',
      max_restarts: 5,
      kill_timeout: 5000,
    },
  ],

  // Deploy configuration (optional, for deployment automation)
  deploy: {
    production: {
      user: 'root',
      host: 'your-server-ip-or-domain',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/dental-lead-bot.git',
      path: '/app/dental-lead-bot',
      'post-deploy': 'npm install && npm run pm2:restart',
    },
  },
};
