#!/usr/bin/env node

/**
 * Generate vercel.json with dynamic cron schedule
 * Run before deployment to set custom schedule
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get cron schedule from environment or use default
const cronSchedule = process.env.CRON_SCHEDULE || '0 0 * * *'; // Default: daily at midnight

const vercelConfig = {
  version: 2,
  name: "accelerate-content-automation",
  builds: [
    { src: "api/health.ts", use: "@vercel/node" },
    { src: "api/status.ts", use: "@vercel/node" },
    { src: "api/run.ts", use: "@vercel/node" },
    { src: "api/webhook.ts", use: "@vercel/node" }
  ],
  routes: [
    { src: "/api/health", dest: "/api/health.ts" },
    { src: "/api/status", dest: "/api/status.ts" },
    { src: "/api/run", dest: "/api/run.ts" },
    { src: "/api/webhook", dest: "/api/webhook.ts" }
  ],
  env: {
    "NODE_ENV": "production"
  },
  crons: [
    {
      path: "/api/run",
      schedule: cronSchedule
    }
  ]
};

// Write the configuration
const configPath = path.join(__dirname, '..', 'vercel.json');
fs.writeFileSync(configPath, JSON.stringify(vercelConfig, null, 2));

console.log(`✅ Generated vercel.json with cron schedule: ${cronSchedule}`);
console.log(`   This means the fetcher will run: ${describeCron(cronSchedule)}`);

function describeCron(cron) {
  const patterns = {
    '0 * * * *': 'every hour',
    '0 */2 * * *': 'every 2 hours',
    '0 */3 * * *': 'every 3 hours',
    '0 */4 * * *': 'every 4 hours',
    '0 */6 * * *': 'every 6 hours',
    '0 */12 * * *': 'every 12 hours',
    '0 0 * * *': 'daily at midnight',
    '0 12 * * *': 'daily at noon',
    '0 0 * * 1': 'weekly on Monday',
    '0 0 * * 0': 'weekly on Sunday',
    '0 0 1 * *': 'monthly on the 1st',
    '0 0 15 * *': 'monthly on the 15th'
  };
  
  return patterns[cron] || cron;
}