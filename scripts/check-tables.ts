#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';

/**
 * Check which tables currently exist in the database
 */
async function checkTables() {
  console.log('🔍 Checking existing tables...\n');

  const expectedTables = [
    'api_cache',
    'search_analytics',
    'monitoring_metrics',
    'rate_limit_violations',
    'error_logs',
    'system_settings',
    'fetch_history',
    'monitoring_alerts',
    'tags',
    'resources',
    'queue_resources',
    'funding_programs',
    'queue_funding_programs',
    'webhook_endpoints',
    'webhook_deliveries'
  ];

  console.log('📊 Testing table access:');
  console.log('=' .repeat(50));

  let existingCount = 0;
  let missingCount = 0;
  const missingTables: string[] = [];

  for (const table of expectedTables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table.padEnd(25)} - MISSING`);
          missingTables.push(table);
          missingCount++;
        } else {
          console.log(`⚠️  ${table.padEnd(25)} - ERROR: ${error.message}`);
          missingCount++;
        }
      } else {
        console.log(`✅ ${table.padEnd(25)} - EXISTS`);
        existingCount++;
      }
    } catch (err: any) {
      console.log(`❌ ${table.padEnd(25)} - ERROR: ${err.message}`);
      missingTables.push(table);
      missingCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   ✅ Existing tables: ${existingCount}`);
  console.log(`   ❌ Missing tables: ${missingCount}`);

  if (missingTables.length > 0) {
    console.log('\n📝 Missing tables:');
    missingTables.forEach(table => console.log(`   - ${table}`));

    console.log('\n🔧 To create missing tables:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
    console.log('   2. Copy the content from: scripts/create-essential-tables.sql');
    console.log('   3. Paste it in the SQL editor');
    console.log('   4. Click "Run" to execute');
    console.log('\n   Or copy this content:');
    console.log('   📋 File: /Users/johnconnor/Desktop/claude-test-2/accelerate-content-automation/scripts/create-essential-tables.sql');
  } else {
    console.log('\n🎉 All essential tables exist!');
  }
}

checkTables().catch(console.error);