#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';
import fs from 'fs';

/**
 * Execute SQL statements directly using Supabase client
 * This script splits the SQL into CREATE TABLE statements and executes them individually
 */
async function executeSQLDirect() {
  console.log('🚀 Executing SQL migration directly...\n');

  // Read the SQL file
  const sql = fs.readFileSync('./scripts/create-essential-tables.sql', 'utf-8');

  // Extract CREATE TABLE statements
  const createTableStatements = sql
    .split('\n')
    .join(' ')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.startsWith('CREATE TABLE') || s.startsWith('INSERT INTO'))
    .map(s => s + ';');

  console.log(`📊 Found ${createTableStatements.length} CREATE TABLE/INSERT statements...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const statement of createTableStatements) {
    try {
      // Extract table name from CREATE TABLE statement
      const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const tableName = match ? match[1] : 'unknown';

      console.log(`Creating table: ${tableName}...`);

      // Try to execute using raw SQL
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });

      if (error) {
        console.log(`❌ Failed to create ${tableName}: ${error.message}`);
        errorCount++;
      } else {
        console.log(`✅ Created ${tableName} successfully`);
        successCount++;
      }
    } catch (err: any) {
      console.log(`⚠️  Error executing statement: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);

  // Test tables
  console.log('\n🧪 Testing essential tables...');
  const essentialTables = [
    'api_cache',
    'search_analytics',
    'monitoring_metrics',
    'resources',
    'funding_programs',
    'webhook_endpoints',
    'system_settings',
    'error_logs'
  ];

  for (const table of essentialTables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: accessible`);
      }
    } catch {
      console.log(`   ❌ ${table}: not accessible`);
    }
  }

  console.log('\n📝 Next steps:');
  console.log('   1. If tables failed to create, run the SQL manually in Supabase dashboard');
  console.log('   2. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
  console.log('   3. Copy and paste the content from scripts/create-essential-tables.sql');
  console.log('   4. Click "Run" to execute');
}

executeSQLDirect().catch(console.error);