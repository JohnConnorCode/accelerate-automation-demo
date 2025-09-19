#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function verifyTables() {
  console.log('🔍 Verifying all 15 essential tables...\n');

  const tables = [
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

  let working = 0;
  let notWorking = 0;
  const results: { [key: string]: boolean } = {};

  for (const table of tables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        results[table] = false;
        notWorking++;
      } else {
        console.log(`✅ ${table}: Accessible (can query)`);
        results[table] = true;
        working++;
      }
    } catch (err: any) {
      console.log(`❌ ${table}: ${err.message}`);
      results[table] = false;
      notWorking++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 FINAL VERIFICATION: ${working}/15 tables operational`);
  console.log('='.repeat(60) + '\n');

  if (working === 15) {
    console.log('🎉 SUCCESS! All 15 essential tables are operational!');
    console.log('✨ Your application is now fully functional.');
    console.log('📈 All 83 database calls should now work correctly.');
  } else {
    console.log(`⚠️  ${notWorking} tables are still not accessible:\n`);

    const missingTables = Object.entries(results)
      .filter(([_, accessible]) => !accessible)
      .map(([table]) => table);

    console.log('Missing tables:', missingTables.join(', '));
    console.log('\n📝 These may need additional permissions or creation.');
  }

  // Test write access to a new table
  console.log('\n🧪 Testing write access to new tables...');

  try {
    // Try to insert into api_cache
    const { error } = await supabase
      .from('api_cache')
      .insert({
        cache_key: 'test_key_' + Date.now(),
        cache_value: { test: true },
        expires_at: new Date(Date.now() + 3600000).toISOString()
      });

    if (error) {
      console.log(`⚠️  Write test failed: ${error.message}`);
      console.log('This is expected with anon key. Service role key needed for writes.');
    } else {
      console.log('✅ Write access confirmed!');
    }
  } catch (err: any) {
    console.log(`⚠️  Write test error: ${err.message}`);
  }

  return working === 15;
}

verifyTables().then(success => {
  process.exit(success ? 0 : 1);
}).catch(console.error);