#!/usr/bin/env node

/**
 * Create missing tables using the working anon key
 * We'll try to create tables through the REST API
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

async function createMissingTables() {
  console.log('🚀 Creating missing tables...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // First, let's check which tables currently exist
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

  console.log('\n🔍 Checking existing tables...');

  const existingTables = [];
  const missingTables = [];

  for (const table of allTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        missingTables.push(table);
        console.log(`❌ ${table}: Missing`);
      } else {
        existingTables.push(table);
        console.log(`✅ ${table}: Exists`);
      }
    } catch {
      missingTables.push(table);
      console.log(`❌ ${table}: Missing`);
    }
  }

  console.log(`\n📊 Status: ${existingTables.length}/15 exist, ${missingTables.length} missing`);

  if (missingTables.length === 0) {
    console.log('🎉 All tables already exist!');
    return;
  }

  console.log('\n📝 Attempting to create missing tables through data insertion...');

  // Try to create missing tables by attempting to insert data
  // This might trigger table creation in some setups
  const sampleData = {
    api_cache: {
      cache_key: 'test_key_12345',
      cache_value: { test: true },
      expires_at: new Date(Date.now() + 3600000).toISOString()
    },
    search_analytics: {
      query: 'test query',
      results_count: 0,
      response_time: 100,
      timestamp: new Date().toISOString()
    },
    monitoring_metrics: {
      name: 'test_metric',
      value: 1.0,
      unit: 'count',
      timestamp: new Date().toISOString()
    },
    rate_limit_violations: {
      ip_address: '127.0.0.1',
      endpoint: '/test',
      violation_count: 1,
      violation_type: 'rate_limit',
      timestamp: new Date().toISOString()
    },
    monitoring_alerts: {
      alert_id: 'test_alert_12345',
      severity: 'info',
      service: 'test',
      message: 'Test alert',
      details: { test: true },
      resolved: false,
      created_at: new Date().toISOString()
    },
    tags: {
      name: 'test-tag',
      count: 1,
      category: 'test',
      created_at: new Date().toISOString()
    },
    queue_resources: {
      title: 'Test Resource',
      description: 'Test description',
      url: 'https://example.com/test',
      resource_type: 'article',
      status: 'pending',
      metadata: { test: true },
      created_at: new Date().toISOString()
    },
    queue_funding_programs: {
      name: 'Test Program',
      organization: 'Test Org',
      description: 'Test description',
      url: 'https://example.com/test',
      funding_type: 'grant',
      status: 'pending',
      metadata: { test: true },
      created_at: new Date().toISOString()
    },
    webhook_endpoints: {
      url: 'https://example.com/webhook',
      events: ['test.event'],
      secret: 'test_secret',
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    webhook_deliveries: {
      event_type: 'test.event',
      payload: { test: true },
      status: 'pending',
      delivered_at: new Date().toISOString()
    }
  };

  let createdCount = 0;

  for (const tableName of missingTables) {
    if (sampleData[tableName]) {
      console.log(`\n🔨 Attempting to create ${tableName}...`);

      try {
        const { data, error } = await supabase
          .from(tableName)
          .insert(sampleData[tableName])
          .select();

        if (!error) {
          console.log(`   ✅ ${tableName} created successfully`);
          createdCount++;

          // Clean up test data
          if (data && data[0] && data[0].id) {
            await supabase.from(tableName).delete().eq('id', data[0].id);
          }
        } else {
          console.log(`   ❌ Failed to create ${tableName}: ${error.message}`);
        }
      } catch (err) {
        console.log(`   ❌ Exception creating ${tableName}: ${err.message}`);
      }
    }
  }

  console.log(`\n📊 Created ${createdCount} new tables`);

  // Final verification
  console.log('\n🔍 Final verification...');
  let finalExistingCount = 0;

  for (const table of allTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (!error) {
        finalExistingCount++;
        console.log(`✅ ${table}: Verified`);
      } else {
        console.log(`❌ ${table}: Still missing`);
      }
    } catch {
      console.log(`❌ ${table}: Still missing`);
    }
  }

  console.log(`\n🎯 Final status: ${finalExistingCount}/15 tables exist`);

  if (finalExistingCount < 15) {
    console.log('\n💡 Remaining tables need to be created manually in Supabase Dashboard:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
    console.log('2. Paste the SQL from: scripts/create-essential-tables.sql');
    console.log('3. Click "Run" to execute with proper privileges');

    console.log('\n📋 SQL to execute:');
    console.log('```sql');

    // Print only the missing table SQL
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const sqlPath = join(__dirname, 'create-essential-tables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    console.log(sqlContent);
    console.log('```');
  } else {
    console.log('🎉 All tables successfully created!');
  }
}

// Execute the script
createMissingTables().catch(console.error);