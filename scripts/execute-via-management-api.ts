#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';

async function executeSQLViaManagementAPI() {
  console.log('🚀 Executing SQL via Supabase Management API...\n');

  const projectRef = 'eqpfvmwmdtsgddpsodsr';
  const accessToken = 'sbp_bc088a6cbce802f3f5c688f62acf388ad7e72e5f';

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Use Supabase Management API to execute SQL
  const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  try {
    console.log('📡 Sending SQL to Supabase Management API...\n');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: sqlContent
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}):`, errorText);

      // Try alternative endpoint
      console.log('\n🔄 Trying SQL Editor API...\n');

      const altResponse = await fetch(`https://api.supabase.com/platform/projects/${projectRef}/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: sqlContent
        })
      });

      if (altResponse.ok) {
        console.log('✅ SQL executed via SQL Editor API');
      } else {
        console.error('❌ Alternative API also failed:', altResponse.status);
      }
    } else {
      const result = await response.json();
      console.log('✅ SQL executed successfully!');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }

  // Verify tables
  console.log('\n🔍 Verifying tables...\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
  );

  const allTables = [
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

  let existingCount = 0;
  let missingCount = 0;

  for (const table of allTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ ${table}: Not accessible`);
        missingCount++;
      } else {
        console.log(`✅ ${table}: Exists`);
        existingCount++;
      }
    } catch {
      console.log(`❌ ${table}: Error`);
      missingCount++;
    }
  }

  console.log(`\n📊 Summary: ${existingCount}/15 tables exist, ${missingCount} missing`);

  if (missingCount > 0) {
    console.log('\n⚠️  Some tables are still missing.');
    console.log('The SQL needs to be executed with database owner privileges.');
    console.log('\n📝 Next step: Use Supabase Dashboard SQL Editor');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
    console.log('2. Paste the SQL from: scripts/create-essential-tables.sql');
    console.log('3. Click "Run" to execute with proper privileges');
  }
}

executeSQLViaManagementAPI().catch(console.error);