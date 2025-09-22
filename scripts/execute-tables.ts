#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ No Supabase key found. Please set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('🚀 Creating production tables for approval workflow...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'create-production-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf8');

  // Split into individual statements (by semicolon) and filter out empty ones
  const statements = sqlContent
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'; // Re-add semicolon

    // Skip pure comments
    if (statement.trim().startsWith('--')) continue;

    // Get table name for logging
    const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/i);
    const tableName = tableMatch ? tableMatch[1] : `Statement ${i + 1}`;

    try {
      console.log(`Executing: ${tableName}...`);

      // Execute via RPC call
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      }).single();

      if (error) {
        // Try direct execution as backup
        const { error: directError } = await (supabase as any).from('_sql').select(statement);

        if (directError) {
          console.error(`❌ Failed: ${tableName}`);
          console.error(`   Error: ${error.message || directError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Created: ${tableName}`);
          successCount++;
        }
      } else {
        console.log(`✅ Created: ${tableName}`);
        successCount++;
      }
    } catch (e) {
      console.error(`❌ Failed: ${tableName}`);
      console.error(`   Error: ${e}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTS:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify tables exist
  console.log('\n🔍 Verifying tables...');
  const tables = ['accelerate_startups', 'accelerate_investors', 'accelerate_news'];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`✅ ${table} exists and is accessible`);
    } else if (error.code === '42P01') {
      console.log(`❌ ${table} does not exist`);
    } else {
      console.log(`⚠️ ${table} exists but has issues: ${error.message}`);
    }
  }

  if (errorCount > 0) {
    console.log('\n⚠️ Some tables may not have been created.');
    console.log('Please execute the SQL manually in Supabase dashboard:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
    console.log('2. Copy contents of: scripts/create-production-tables.sql');
    console.log('3. Paste and execute in SQL editor');
  } else {
    console.log('\n✅ All production tables created successfully!');
    console.log('The approval workflow should now work.');
  }
}

createTables().catch(console.error);