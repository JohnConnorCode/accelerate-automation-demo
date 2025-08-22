#!/usr/bin/env node
/**
 * Simple CLI for Accelerate Content Automation
 */
import { program } from 'commander';
import { orchestrator } from './simple-orchestrator';
import chalk from 'chalk';
import { config } from 'dotenv';

config();

program
  .name('accelerate')
  .description('Simple content automation for Accelerate platform')
  .version('3.0.0');

program
  .command('run')
  .description('Fetch, score, and store content')
  .action(async () => {
    try {
      console.log(chalk.blue('🚀 Starting content pipeline...'));
      
      const result = await orchestrator.run();
      
      console.log(chalk.green('\n✅ Pipeline completed!'));
      console.log(`  Fetched: ${result.fetched} items`);
      console.log(`  Scored: ${result.scored} items`);
      console.log(`  Stored: ${result.stored} items`);
      console.log(`  Rejected: ${result.rejected} items`);
      console.log(`  Duration: ${result.duration}s`);
      
      if (result.errors.length > 0) {
        console.log(chalk.yellow('\n⚠️  Warnings:'));
        result.errors.forEach(err => console.log(`  - ${err}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Pipeline failed:'), error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Get pipeline status')
  .action(async () => {
    try {
      const status = await orchestrator.getStatus();
      
      console.log(chalk.blue('\n📊 Pipeline Status'));
      console.log(`  Last run: ${status.lastRun ? status.lastRun.toLocaleString() : 'Never'}`);
      console.log(`  Total content: ${status.totalContent}`);
      
      if (Object.keys(status.breakdown).length > 0) {
        console.log('\n  Breakdown by source:');
        for (const [source, count] of Object.entries(status.breakdown)) {
          console.log(`    ${source}: ${count}`);
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Remove old content')
  .option('-d, --days <number>', 'Days to keep', '30')
  .action(async (options) => {
    try {
      const days = parseInt(options.days);
      console.log(chalk.blue(`🧹 Cleaning content older than ${days} days...`));
      
      const result = await orchestrator.cleanup(days);
      
      console.log(chalk.green(`✅ Deleted ${result.deleted} items`));
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error);
      process.exit(1);
    }
  });

program.parse();