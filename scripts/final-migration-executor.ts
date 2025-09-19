#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error(`
❌ SUPABASE_SERVICE_ROLE_KEY not found in .env.local

Please:
1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/settings/api
2. Copy the service_role (secret) key
3. Add to .env.local:
   SUPABASE_SERVICE_ROLE_KEY=<your-key-here>
4. Run this script again
`);
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  }
});

async function executeSQL(sql: string): Promise<any> {
  // Direct SQL execution using Supabase's internal method
  const { data, error } = await supabase.rpc('query', { query: sql }).single();

  if (error) {
    // Fallback to REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      throw new Error(`Failed to execute SQL: ${response.statusText}`);
    }

    return await response.json();
  }

  return data;
}

async function runMigration() {
  console.log('🚀 Executing SQL migration with service role key...\n');

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse statements
  const statements = sqlContent
    .split(/;\s*(?=\n|$)/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + (s.endsWith(';') ? '' : ';'));

  console.log(`📋 Executing ${statements.length} SQL statements...\n`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0
  };

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Extract operation name
    let opName = 'Operation';
    const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    const indexMatch = stmt.match(/CREATE INDEX (\w+)/i);
    const policyMatch = stmt.match(/CREATE POLICY/i);

    if (tableMatch) opName = `Table: ${tableMatch[1]}`;
    else if (indexMatch) opName = `Index: ${indexMatch[1]}`;
    else if (policyMatch) opName = 'Policy';
    else if (stmt.includes('INSERT')) opName = 'Insert data';
    else if (stmt.includes('GRANT')) opName = 'Grant permissions';
    else if (stmt.includes('ALTER')) opName = 'Alter table';
    else if (stmt.includes('FUNCTION')) opName = 'Function';
    else if (stmt.includes('TRIGGER')) opName = 'Trigger';

    process.stdout.write(`[${i+1}/${statements.length}] ${opName}... `);

    try {
      await executeSQL(stmt);
      console.log('✅');
      results.success++;
    } catch (error: any) {
      if (error.message?.includes('already exists') ||
          error.message?.includes('duplicate')) {
        console.log('⏭️  (exists)');
        results.skipped++;
      } else {
        console.log(`❌ ${error.message}`);
        results.failed++;
      }
    }
  }

  // Summary
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Success: ${results.success}`);
  console.log(`   ⏭️  Skipped: ${results.skipped}`);
  console.log(`   ❌ Failed: ${results.failed}`);

  // Verify all 15 tables
  console.log('\n🔍 Verifying all 15 tables...\n');

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

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        notWorking++;
      } else {
        console.log(`✅ ${table}: Working (count capability confirmed)`);
        working++;
      }
    } catch (err: any) {
      console.log(`❌ ${table}: ${err.message}`);
      notWorking++;
    }
  }

  console.log(`\n🎯 Final Status: ${working}/15 tables operational`);

  if (working === 15) {
    console.log('🎉 All tables created successfully!');
    console.log('✨ Your application now has full database functionality restored.');
  } else if (notWorking > 0) {
    console.log(`\n⚠️  ${notWorking} tables still need attention.`);
    console.log('You may need to run the SQL directly in Supabase dashboard.');
  }
}

// Execute
runMigration().catch(console.error);