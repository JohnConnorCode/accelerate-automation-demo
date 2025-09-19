#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

/**
 * Re-enable critical services after creating database tables
 */
async function reEnableServices() {
  console.log('🔧 Re-enabling critical services...\n');

  // Services to re-enable
  const criticalServices = [
    'api_cache',        // Performance caching
    'search_analytics', // Search tracking
    'monitoring_metrics', // System monitoring
    'rate_limit_violations', // Security
    'webhook_endpoints', // Integrations
    'webhook_deliveries', // Webhook tracking
    'resources',        // Educational content
    'queue_resources',  // Resource approval
    'funding_programs', // Funding opportunities
    'queue_funding_programs', // Funding approval
    'error_logs',       // Error tracking
    'system_settings',  // Configuration
    'fetch_history',    // Fetch tracking
    'monitoring_alerts', // Alert system
    'tags'              // Tag system
  ];

  const files = await glob('src/**/*.ts', { ignore: ['**/*.test.ts', '**/*.d.ts'] });
  
  let totalFixed = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    
    for (const table of criticalServices) {
      // Pattern to find disabled code
      const disabledPattern = new RegExp(
        `// DISABLED: Table '${table}' doesn't exist\\s*\\n\\s*(.*)(\\.from\\('${table}'\\)[^;]*) as any \\|\\| .*`,
        'g'
      );
      
      if (disabledPattern.test(content)) {
        console.log(`🔄 Re-enabling ${table} in ${path.basename(file)}`);
        
        // Remove the DISABLED comment and the fallback
        content = content.replace(
          disabledPattern,
          '$1$2'
        );
        
        modified = true;
        totalFixed++;
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`  ✅ Fixed ${path.basename(file)}`);
    }
  }

  // Also re-enable the search_analytics insert that was commented out
  const searchServicePath = 'src/services/smart-search-service.ts';
  if (fs.existsSync(searchServicePath)) {
    let content = fs.readFileSync(searchServicePath, 'utf-8');
    
    // Re-enable the commented out search analytics tracking
    content = content.replace(
      /\/\/ NOTE: search_analytics table doesn't exist yet[\s\S]*?\/\/ supabase\.from\('search_analytics'\)\.insert\({[\s\S]*?\/\/ }\)\.then.*?;/,
      `supabase.from('search_analytics').insert({
      query,
      results_count: resultsCount,
      response_time: responseTime,
      timestamp: new Date().toISOString()
    }).then(() => {}).then(undefined, console.error);`
    );
    
    fs.writeFileSync(searchServicePath, content);
    console.log('  ✅ Re-enabled search analytics tracking');
  }

  console.log(`\n✅ Re-enabled ${totalFixed} service calls`);
  
  console.log('\n📝 Next steps:');
  console.log('1. Copy the SQL from scripts/create-essential-tables.sql');
  console.log('2. Run it in your Supabase SQL editor');
  console.log('3. Run: npm test');
  console.log('4. Run: npm run dev');
  console.log('\nThe app should now have full functionality! 🚀');
}

reEnableServices().catch(console.error);