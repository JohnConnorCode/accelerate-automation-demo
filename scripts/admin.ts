#!/usr/bin/env tsx

import { Command } from 'commander';
import { UnifiedOrchestrator } from '../src/core/unified-orchestrator';
import { testConnection, getDatabaseStats } from '../src/lib/supabase-client';
import { cache } from '../src/lib/cache-service';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('accelerate-admin')
  .description('Admin CLI for Accelerate Content Automation')
  .version('2.0.0');

/**
 * Test command - verify all connections
 */
program
  .command('test')
  .description('Test all connections and configurations')
  .action(async () => {
    console.log(chalk.blue('\n🔍 Testing Accelerate System Configuration\n'));
    
    const tests = [
      { name: 'Database Connection', test: testConnection },
      { name: 'Cache Service', test: () => cache.getStats() },
      { name: 'GitHub API', test: () => !!process.env.GITHUB_TOKEN },
      { name: 'Twitter API', test: () => !!process.env.TWITTER_BEARER_TOKEN },
    ];

    const table = new Table({
      head: ['Service', 'Status', 'Details'],
      colWidths: [20, 15, 40]
    });

    for (const { name, test } of tests) {
      const spinner = ora(`Testing ${name}...`).start();
      try {
        const result = await test();
        spinner.succeed();
        table.push([
          name,
          chalk.green('✓ PASS'),
          typeof result === 'object' ? JSON.stringify(result) : 'Connected'
        ]);
      } catch (error: any) {
        spinner.fail();
        table.push([
          name,
          chalk.red('✗ FAIL'),
          error.message || 'Connection failed'
        ]);
      }
    }

    console.log(table.toString());
  });

/**
 * Run command - execute fetchers
 */
program
  .command('run [category]')
  .description('Run fetchers (all, projects, funding, resources, metrics)')
  .option('-d, --dry-run', 'Simulate without database writes')
  .action(async (category, _options) => {
    const spinner = ora('Starting orchestrator...').start();
    
    try {
      const orchestrator = new UnifiedOrchestrator();
      let result;
      if (category) {
        spinner.text = `Running ${category} fetchers...`;
        result = await orchestrator.runCategory(category);
      } else {
        spinner.text = 'Running all fetchers...';
        result = await orchestrator.run();
      }
      
      spinner.succeed('Orchestrator completed');
      
      // Display results
      const table = new Table({
        head: ['Metric', 'Value'],
        colWidths: [25, 20]
      });

      if (result.stats) {
        table.push(
          ['Items Fetched', result.stats.fetched || 0],
          ['Items Enriched', result.stats.enriched || 0],
          ['Items Qualified', result.stats.qualified || 0],
          ['Items Inserted', result.stats.inserted || 0],
          ['Items Updated', result.stats.updated || 0],
          ['Items Rejected', result.stats.rejected || 0],
          ['Average Score', result.stats.averageScore?.toFixed(1) || 'N/A'],
          ['Coverage %', result.stats.coverage?.percentage || 'N/A']
        );
      }

      console.log('\n' + table.toString());

      if (result.errors?.length > 0) {
        console.log(chalk.yellow('\n⚠️  Errors:'));
        result.errors.forEach((err: string) => console.log(`  - ${err}`));
      }

    } catch (error: any) {
      spinner.fail('Orchestrator failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

/**
 * Stats command - show database statistics
 */
program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    const spinner = ora('Fetching statistics...').start();
    
    try {
      const stats = await getDatabaseStats();
      spinner.succeed('Statistics fetched');
      
      const table = new Table({
        head: ['Category', 'Count'],
        colWidths: [20, 15]
      });

      table.push(
        ['Projects', stats.projects || 0],
        ['Funding Programs', stats.funding_programs || 0],
        ['Resources', stats.resources || 0],
        ['Total', (stats.projects || 0) + (stats.funding_programs || 0) + (stats.resources || 0)]
      );

      console.log('\n' + table.toString());

    } catch (error: any) {
      spinner.fail('Failed to fetch statistics');
      console.error(chalk.red(error.message));
    }
  });

/**
 * Cache command - manage cache
 */
program
  .command('cache <action>')
  .description('Cache management (clear, stats)')
  .action(async (action) => {
    const spinner = ora(`Cache ${action}...`).start();
    
    try {
      switch (action) {
        case 'clear':
          await cache.cleanExpired();
          spinner.succeed('Cache cleared');
          break;
        
        case 'stats':
          const stats = await cache.getStats();
          spinner.succeed('Cache statistics');
          console.log('\nCache Stats:');
          console.log(`  In-Memory: ${stats.inMemoryCount} entries`);
          console.log(`  Database: ${stats.databaseCount} entries`);
          break;
        
        default:
          spinner.fail(`Unknown action: ${action}`);
      }
    } catch (error: any) {
      spinner.fail(`Cache ${action} failed`);
      console.error(chalk.red(error.message));
    }
  });

/**
 * Monitor command - continuous monitoring
 */
program
  .command('monitor')
  .description('Start continuous monitoring')
  .option('-i, --interval <minutes>', 'Update interval in minutes', '60')
  .action(async (options) => {
    const interval = parseInt(options.interval);
    console.log(chalk.blue(`\n📊 Starting continuous monitoring (every ${interval} minutes)\n`));
    
    const orchestrator = new UnifiedOrchestrator();
    await orchestrator.runContinuous(interval);
  });

/**
 * Setup command - help with initial setup
 */
program
  .command('setup')
  .description('Setup wizard for initial configuration')
  .action(async () => {
    console.log(chalk.blue('\n🚀 Accelerate Setup Wizard\n'));
    
    const steps = [
      {
        title: '1. Environment Variables',
        check: () => require('fs').existsSync('.env'),
        instructions: `
  Create a .env file with:
  - SUPABASE_URL: Your Supabase project URL
  - SUPABASE_ANON_KEY: Your Supabase anon key
  - GITHUB_TOKEN: GitHub personal access token (optional)
  - TWITTER_BEARER_TOKEN: Twitter API bearer token (optional)
  
  Get Supabase credentials from:
  ${chalk.cyan('https://app.supabase.com/project/_/settings/api')}`
      },
      {
        title: '2. Database Setup',
        check: testConnection,
        instructions: `
  Run the SQL setup script in Supabase:
  1. Go to ${chalk.cyan('https://app.supabase.com/project/_/sql/new')}
  2. Copy contents of ${chalk.yellow('scripts/setup-supabase.sql')}
  3. Run the script`
      },
      {
        title: '3. API Keys (Optional)',
        check: () => process.env.GITHUB_TOKEN || process.env.TWITTER_BEARER_TOKEN,
        instructions: `
  For enhanced features, get API keys:
  - GitHub: ${chalk.cyan('https://github.com/settings/tokens/new')}
  - Twitter: ${chalk.cyan('https://developer.twitter.com')}`
      }
    ];

    for (const step of steps) {
      console.log(chalk.yellow(`\n${step.title}`));
      
      try {
        const result = await step.check();
        if (result) {
          console.log(chalk.green('  ✓ Configured'));
        } else {
          console.log(chalk.red('  ✗ Not configured'));
          console.log(step.instructions);
        }
      } catch (error) {
        console.log(chalk.red('  ✗ Not configured'));
        console.log(step.instructions);
      }
    }

    console.log(chalk.blue('\n📝 Next Steps:'));
    console.log('  1. Complete any missing configuration above');
    console.log('  2. Run: npm run admin test');
    console.log('  3. Run: npm run admin run');
    console.log('  4. Deploy: npm run deploy');
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}