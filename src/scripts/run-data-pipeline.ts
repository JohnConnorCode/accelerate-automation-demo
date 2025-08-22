#!/usr/bin/env node

import { accelerateDataPipeline } from '../lib/accelerate-data-pipeline';
import { config } from 'dotenv';
import chalk from 'chalk';

config();

/**
 * Simple script to run the Accelerate data pipeline
 * Crawls, cleans, and stores data for the platform
 */

async function main() {

  try {
    // Define sources to crawl
    const sources = ['github', 'devto', 'hackernews'];

    // Run the pipeline
    const startTime = Date.now();
    const stats = await accelerateDataPipeline.run(sources);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Display results

    // Calculate efficiency
    const efficiency = ((stats.cleaned / stats.crawled) * 100).toFixed(1);

  } catch (error) {

    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runDataPipeline };