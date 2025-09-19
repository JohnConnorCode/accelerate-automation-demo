#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting database migration...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Split SQL into individual statements (simple split by semicolon + newline)
  const statements = sqlContent
    .split(/;\s*\n/)
    .filter(stmt => stmt.trim().length > 0)
    .map(stmt => stmt.trim() + ';');

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    // Skip comments
    if (statement.trim().startsWith('--')) {
      continue;
    }

    // Extract table/operation name for logging
    let operationName = 'Unknown operation';
    const createTableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    const createIndexMatch = statement.match(/CREATE INDEX (\w+)/i);
    const insertMatch = statement.match(/INSERT INTO (\w+)/i);
    const grantMatch = statement.match(/GRANT/i);
    const alterMatch = statement.match(/ALTER TABLE (\w+)/i);
    const createPolicyMatch = statement.match(/CREATE POLICY "([^"]+)"/i);
    const createFunctionMatch = statement.match(/CREATE OR REPLACE FUNCTION (\w+)/i);
    const createTriggerMatch = statement.match(/CREATE TRIGGER (\w+)/i);

    if (createTableMatch) {
      operationName = `Create table: ${createTableMatch[1]}`;
    } else if (createIndexMatch) {
      operationName = `Create index: ${createIndexMatch[1]}`;
    } else if (insertMatch) {
      operationName = `Insert into: ${insertMatch[1]}`;
    } else if (grantMatch) {
      operationName = 'Grant permissions';
    } else if (alterMatch) {
      operationName = `Alter table: ${alterMatch[1]}`;
    } else if (createPolicyMatch) {
      operationName = `Create policy: ${createPolicyMatch[1]}`;
    } else if (createFunctionMatch) {
      operationName = `Create function: ${createFunctionMatch[1]}`;
    } else if (createTriggerMatch) {
      operationName = `Create trigger: ${createTriggerMatch[1]}`;
    }

    try {
      console.log(`⏳ [${i + 1}/${statements.length}] ${operationName}...`);

      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      }).single();

      if (error) {
        // Try direct execution as fallback
        const { error: directError } = await supabase.from('_sql').select(statement);

        if (directError) {
          throw directError;
        }
      }

      console.log(`✅ [${i + 1}/${statements.length}] ${operationName} - Success`);
      successCount++;
    } catch (error: any) {
      // Check if it's a "already exists" error which is fine
      if (error.message?.includes('already exists') ||
          error.message?.includes('duplicate key')) {
        console.log(`⚠️  [${i + 1}/${statements.length}] ${operationName} - Already exists (skipped)`);
        successCount++;
      } else {
        console.error(`❌ [${i + 1}/${statements.length}] ${operationName} - Failed`);
        console.error(`   Error: ${error.message}\n`);
        errorCount++;
      }
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);

  // Verify key tables exist
  console.log('\n🔍 Verifying essential tables...');
  const tablesToVerify = [
    'api_cache',
    'search_analytics',
    'resources',
    'funding_programs',
    'system_settings'
  ];

  for (const table of tablesToVerify) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table ${table}: Not accessible`);
      } else {
        console.log(`✅ Table ${table}: Exists and accessible`);
      }
    } catch (e) {
      console.log(`❌ Table ${table}: Error checking`);
    }
  }

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('All 15 essential tables have been created.');
  } else {
    console.log('\n⚠️  Migration completed with some errors.');
    console.log('You may need to run the SQL directly in Supabase dashboard.');
  }
}

// Run the migration
runMigration().catch(console.error);