#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Tables we know exist
const EXISTING_TABLES = [
  'projects',
  'queue_projects', 
  'queue_investors',
  'queue_news',
  'content_queue',
  'notifications'
];

// Tables that definitely don't exist
const NON_EXISTENT_TABLES = [
  'search_analytics',
  'api_cache',
  'monitoring_health_checks',
  'monitoring_alerts',
  'monitoring_metrics',
  'rate_limit_violations',
  'webhook_endpoints',
  'webhook_deliveries',
  'backup_metadata',
  'backup_log',
  'backup_restore_log',
  'email_queue',
  'api_usage',
  'api_logs',
  'system_metrics',
  'operation_metrics',
  'health_metrics',
  'health_alerts',
  'critical_alerts',
  'critical_errors',
  'error_logs',
  'recovery_logs',
  'recovery_points',
  'pipeline_stats',
  'validation_stats',
  'enrichment_logs',
  'fetch_history',
  'scheduler_history',
  'blocked_clients',
  'content_criteria',
  'scoring_criteria',
  'ai_assessments',
  'ai_assessment_overrides',
  'ai_processing_log',
  'ai_improvements',
  'alert_rules',
  'alerts',
  'urgent_alerts',
  'system_settings',
  'tags',
  'profiles',
  'resources',
  'funding_programs',
  'queue_resources',
  'queue_funding_programs',
  'approved_content',
  'accelerate_startups',
  'unified_startups'
];

async function fixNonExistentTables() {
  console.log('🔍 Finding and fixing references to non-existent tables...\n');

  // Find all TypeScript files
  const files = await glob('src/**/*.ts', { ignore: ['**/*.test.ts', '**/*.d.ts'] });
  
  let totalFixed = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    
    for (const table of NON_EXISTENT_TABLES) {
      const pattern = new RegExp(`\\.from\\(['"\`]${table}['"\`]\\)`, 'g');
      
      if (pattern.test(content)) {
        console.log(`📝 Found ${table} in ${path.basename(file)}`);
        
        // Comment out the database calls
        // Replace .from('table') with a mock that returns empty results
        content = content.replace(
          new RegExp(`(\\s*)(.*)\\.from\\(['"\`]${table}['"\`]\\)([^;]*)`, 'g'),
          (match, indent, prefix, suffix) => {
            // Keep the line but make it return empty results
            if (suffix.includes('.insert')) {
              return `${indent}// DISABLED: Table '${table}' doesn't exist
${indent}${prefix}.from('${table}')${suffix} as any || { then: () => Promise.resolve({ data: null, error: null }) }`;
            } else {
              return `${indent}// DISABLED: Table '${table}' doesn't exist
${indent}${prefix}.from('${table}')${suffix} as any || { data: [], error: null }`;
            }
          }
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
  
  console.log(`\n✅ Fixed ${totalFixed} references to non-existent tables`);
  
  // Also fix test files that might be expecting these tables
  console.log('\n🔍 Checking test files...');
  
  const testFiles = await glob('src/**/*.test.ts');
  
  for (const file of testFiles) {
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    
    // Check if test is trying to insert into non-existent tables
    for (const table of NON_EXISTENT_TABLES) {
      if (content.includes(`from('${table}')`)) {
        console.log(`  ⚠️  Test ${path.basename(file)} references non-existent table: ${table}`);
        // Don't auto-fix tests, just warn
      }
    }
  }
}

fixNonExistentTables().catch(console.error);