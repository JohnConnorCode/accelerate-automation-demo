#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';

async function completeMigration() {
  // Check for service role key
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SERVICE_KEY || SERVICE_KEY === 'your-service-key-here') {
    console.error(`
❌ SERVICE ROLE KEY NOT CONFIGURED

Please provide the service_role key from Supabase dashboard.

The key you copied from https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/settings/api

Add it to .env.local as:
SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>

Or run:
echo 'SUPABASE_SERVICE_ROLE_KEY=<paste-key-here>' >> .env.local
`);
    process.exit(1);
  }

  console.log('✅ Service role key found\n');

  // Verify it's a service role key
  try {
    const payload = JSON.parse(Buffer.from(SERVICE_KEY.split('.')[1], 'base64').toString());
    if (payload.role !== 'service_role') {
      console.error('❌ This is not a service role key. It has role:', payload.role);
      console.error('Please use the service_role key, not the anon key.');
      process.exit(1);
    }
    console.log('✅ Valid service role key confirmed\n');
  } catch {
    console.error('❌ Invalid JWT format');
    process.exit(1);
  }

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('🚀 Starting SQL migration...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse SQL into individual statements
  const statements = sqlContent
    .replace(/--.*$/gm, '') // Remove comments
    .split(/;\s*(?=\n|$)/)
    .filter(s => s.trim())
    .map(s => s.trim() + ';');

  console.log(`📋 Found ${statements.length} SQL statements\n`);

  // Group by type
  const groups = {
    tables: statements.filter(s => s.match(/CREATE TABLE/i)),
    indexes: statements.filter(s => s.match(/CREATE INDEX/i)),
    policies: statements.filter(s => s.match(/CREATE POLICY/i)),
    functions: statements.filter(s => s.match(/CREATE.*FUNCTION/i)),
    triggers: statements.filter(s => s.match(/CREATE TRIGGER/i)),
    other: statements.filter(s =>
      !s.match(/CREATE TABLE/i) &&
      !s.match(/CREATE INDEX/i) &&
      !s.match(/CREATE POLICY/i) &&
      !s.match(/CREATE.*FUNCTION/i) &&
      !s.match(/CREATE TRIGGER/i)
    )
  };

  // Execute in order
  const executionOrder = [
    { name: 'Tables', items: groups.tables },
    { name: 'Indexes', items: groups.indexes },
    { name: 'Functions', items: groups.functions },
    { name: 'Triggers', items: groups.triggers },
    { name: 'Policies', items: groups.policies },
    { name: 'Other', items: groups.other }
  ];

  for (const group of executionOrder) {
    if (group.items.length === 0) continue;

    console.log(`\n${group.name} (${group.items.length} items):`);

    for (const stmt of group.items) {
      // Extract name for logging
      let itemName = 'item';
      const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      const indexMatch = stmt.match(/CREATE INDEX (\w+)/i);
      const policyMatch = stmt.match(/CREATE POLICY "([^"]+)"/i);
      const functionMatch = stmt.match(/CREATE.*FUNCTION (\w+)/i);
      const triggerMatch = stmt.match(/CREATE TRIGGER (\w+)/i);

      if (tableMatch) itemName = tableMatch[1];
      else if (indexMatch) itemName = indexMatch[1];
      else if (policyMatch) itemName = policyMatch[1];
      else if (functionMatch) itemName = functionMatch[1];
      else if (triggerMatch) itemName = triggerMatch[1];

      process.stdout.write(`  ${itemName}... `);

      try {
        // For service role, we can execute SQL directly via REST API
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: stmt })
        });

        if (response.ok || response.status === 204) {
          console.log('✅');
        } else {
          // Try alternative: direct table operations for table creation
          if (stmt.includes('CREATE TABLE')) {
            // Tables should be created via migrations or dashboard
            console.log('⚠️  (needs dashboard)');
          } else {
            const error = await response.text();
            if (error.includes('already exists')) {
              console.log('⏭️');
            } else {
              console.log(`❌ ${response.status}`);
            }
          }
        }
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log('⏭️');
        } else {
          console.log(`❌ ${error.message}`);
        }
      }
    }
  }

  // Verify all tables
  console.log('\n\n🔍 Verifying all 15 tables:\n');

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

  const results = {
    working: [] as string[],
    missing: [] as string[]
  };

  for (const table of allTables) {
    try {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`  ❌ ${table}: Not accessible`);
        results.missing.push(table);
      } else {
        console.log(`  ✅ ${table}: Ready (can query)`);
        results.working.push(table);
      }
    } catch {
      console.log(`  ❌ ${table}: Error`);
      results.missing.push(table);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`📊 FINAL STATUS: ${results.working.length}/15 tables operational`);
  console.log('='.repeat(60));

  if (results.working.length === 15) {
    console.log('\n🎉 SUCCESS! All 15 tables are now operational!');
    console.log('✨ Your application\'s 83 database calls will now work correctly.');
  } else {
    console.log(`\n⚠️  ${results.missing.length} tables still missing:`);
    console.log(`   ${results.missing.join(', ')}`);
    console.log('\n📝 These tables need to be created via Supabase Dashboard SQL editor.');
    console.log('   Copy the SQL from scripts/create-essential-tables.sql');
  }
}

// Execute
completeMigration().catch(console.error);