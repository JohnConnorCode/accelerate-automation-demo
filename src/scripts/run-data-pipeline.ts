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
  console.log(chalk.blue.bold('\n🚀 Accelerate Data Pipeline\n'));
  console.log(chalk.gray('Crawling and cleaning data from multiple sources...\n'));

  try {
    // Define sources to crawl
    const sources = ['github', 'devto', 'hackernews'];
    
    console.log(chalk.yellow(`📊 Sources: ${sources.join(', ')}\n`));
    
    // Run the pipeline
    const startTime = Date.now();
    const stats = await accelerateDataPipeline.run(sources);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    // Display results
    console.log(chalk.green.bold('\n✅ Pipeline Complete!\n'));
    console.log(chalk.white('📈 Statistics:'));
    console.log(chalk.gray(`  • Items crawled: ${stats.crawled}`));
    console.log(chalk.gray(`  • Items cleaned: ${stats.cleaned}`));
    console.log(chalk.gray(`  • Items stored: ${stats.stored}`));
    console.log(chalk.gray(`  • Duration: ${duration}s`));
    
    // Calculate efficiency
    const efficiency = ((stats.cleaned / stats.crawled) * 100).toFixed(1);
    console.log(chalk.cyan(`\n  • Cleaning efficiency: ${efficiency}%`));
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Pipeline failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runDataPipeline };