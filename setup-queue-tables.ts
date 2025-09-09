#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function setupQueueTables() {
  console.log('🔄 SUPABASE QUEUE TABLES SETUP ASSISTANT\n');
  console.log('=' .repeat(60));
  
  // Step 1: Check current status
  console.log('\n📊 STEP 1: Checking current table status...\n');
  
  const tables = [
    { name: 'queue_projects', description: 'Startup/project submissions awaiting review' },
    { name: 'queue_funding_programs', description: 'Grants/accelerators/VCs awaiting review' },
    { name: 'queue_resources', description: 'Tools/courses/communities awaiting review' }
  ];
  
  const tableStatus: { [key: string]: boolean } = {};
  let allExist = true;
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table.name)
        .select('id')
        .limit(1);
      
      if (error && error.code === '42P01') {
        console.log(`❌ ${table.name}: MISSING`);
        console.log(`   Purpose: ${table.description}`);
        tableStatus[table.name] = false;
        allExist = false;
      } else if (error) {
        console.log(`⚠️  ${table.name}: ERROR - ${error.message}`);
        tableStatus[table.name] = false;
        allExist = false;
      } else {
        console.log(`✅ ${table.name}: EXISTS`);
        tableStatus[table.name] = true;
      }
    } catch (error: any) {
      console.log(`❌ ${table.name}: ERROR - ${error.message}`);
      tableStatus[table.name] = false;
      allExist = false;
    }
  }
  
  if (allExist) {
    console.log('\n🎉 All queue tables already exist! Setup is complete.');
    
    // Show table info
    console.log('\n📋 Table Summary:');
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table.name)
          .select('*', { count: 'exact', head: true });
        
        const count = error ? 'unknown' : (data?.length || 0);
        console.log(`   ${table.name}: ${count} rows`);
      } catch (error) {
        console.log(`   ${table.name}: count unavailable`);
      }
    }
    
    return;
  }
  
  // Step 2: Show migration file info
  console.log('\n📄 STEP 2: Migration file analysis...\n');
  
  const migrationFile = './supabase/migrations/20250909165620_create_queue_tables.sql';
  
  if (!fs.existsSync(migrationFile)) {
    console.log('❌ Migration file not found!');
    console.log(`   Expected: ${migrationFile}`);
    return;
  }
  
  const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
  const lines = sqlContent.split('\n').length;
  const createTableCount = (sqlContent.match(/CREATE TABLE/gi) || []).length;
  const createIndexCount = (sqlContent.match(/CREATE INDEX/gi) || []).length;
  const grantCount = (sqlContent.match(/GRANT/gi) || []).length;
  const policyCount = (sqlContent.match(/CREATE POLICY/gi) || []).length;
  
  console.log('✅ Migration file ready:');
  console.log(`   File: ${migrationFile}`);
  console.log(`   Size: ${sqlContent.length} characters, ${lines} lines`);
  console.log(`   Contains:`);
  console.log(`     • 3 DROP TABLE statements`);
  console.log(`     • ${createTableCount} CREATE TABLE statements`);
  console.log(`     • ${createIndexCount} CREATE INDEX statements`);
  console.log(`     • ${grantCount} GRANT statements`);
  console.log(`     • ${policyCount} CREATE POLICY statements`);
  
  // Step 3: Execution instructions
  console.log('\n🚀 STEP 3: Execute the migration...\n');
  
  console.log('📝 MANUAL EXECUTION (RECOMMENDED):');
  console.log('');
  console.log('1. 🌐 Open Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('');
  console.log('2. 📋 Copy ALL content from this file:');
  console.log(`   ${migrationFile}`);
  console.log('');
  console.log('3. 📝 Paste into SQL Editor and click RUN');
  console.log('');
  console.log('4. ✅ Look for success message');
  console.log('');
  
  console.log('⚡ ALTERNATIVE - Supabase CLI:');
  console.log('');
  console.log('If you have Supabase CLI properly configured:');
  console.log('   supabase db push --linked');
  console.log('');
  
  // Step 4: Verification
  console.log('🔍 STEP 4: Verification...\n');
  
  console.log('After manual execution, run this script again to verify:');
  console.log('   npx tsx setup-queue-tables.ts');
  console.log('');
  console.log('Or check individual table status:');
  console.log('   npx tsx execute-queue-tables.ts');
  
  // Step 5: Troubleshooting
  console.log('\n🛠️  TROUBLESHOOTING:\n');
  
  console.log('❓ Common Issues:');
  console.log('   • "relation does not exist" → Tables need to be created');
  console.log('   • "permission denied" → Check service role key');
  console.log('   • "syntax error" → Copy entire migration file');
  console.log('');
  
  console.log('📞 Need Help?');
  console.log('   • Check Supabase logs in dashboard');
  console.log('   • Verify project URL and keys in .env');
  console.log('   • Ensure you have proper database permissions');
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY: Queue tables setup requires manual SQL execution');
  console.log('🔗 Direct link: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('📄 Migration file: supabase/migrations/20250909165620_create_queue_tables.sql');
  console.log('=' .repeat(60));
}

setupQueueTables().catch(console.error);