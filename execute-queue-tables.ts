#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Initialize Supabase client with service role key 
const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
// Use the service key that works with other scripts
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function executeQueueTables() {
  console.log('🚀 CHECKING QUEUE TABLES STATUS\n');
  console.log('='.repeat(60));
  
  // First check if tables exist
  console.log('\n📊 Checking existing table status...');
  
  const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
  const tableStatus: { [key: string]: boolean } = {};
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          console.log(`   ❌ Table ${table}: DOES NOT EXIST`);
          tableStatus[table] = false;
        } else {
          console.log(`   ⚠️  Table ${table}: ERROR - ${error.message}`);
          tableStatus[table] = false;
        }
      } else {
        console.log(`   ✅ Table ${table}: EXISTS and accessible`);
        tableStatus[table] = true;
      }
    } catch (error: any) {
      console.log(`   ❌ Table ${table}: ERROR - ${error.message}`);
      tableStatus[table] = false;
    }
  }
  
  const existingTables = Object.values(tableStatus).filter(Boolean).length;
  const totalTables = tables.length;
  
  console.log(`\n📈 Status: ${existingTables}/${totalTables} tables exist`);
  
  if (existingTables === totalTables) {
    console.log('\n🎉 All queue tables already exist! No action needed.');
    return;
  }
  
  // Read migration file for manual execution
  const migrationFile = './supabase/migrations/20250909165620_create_queue_tables.sql';
  
  if (!fs.existsSync(migrationFile)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
  
  console.log('\n📝 MANUAL EXECUTION REQUIRED:\n');
  console.log('Since the Supabase JavaScript client cannot execute DDL statements,');
  console.log('you need to manually execute the SQL in the Supabase dashboard:\n');
  console.log('🔗 URL: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new\n');
  console.log('📋 Steps:');
  console.log('1. Click the link above to open the SQL Editor');
  console.log('2. Copy the entire contents of: supabase/migrations/20250909165620_create_queue_tables.sql');
  console.log('3. Paste it into the SQL Editor');
  console.log('4. Click the RUN button');
  console.log('5. Verify all tables are created successfully\n');
  
  console.log('📄 Migration file details:');
  console.log(`   File: ${migrationFile}`);
  console.log(`   Size: ${sqlContent.length} characters`);
  console.log(`   Contains: CREATE TABLE statements for all 3 queue tables`);
  console.log(`   Plus: Indexes, permissions, and RLS policies`);
  
  console.log('\n⚡ Alternative: Use Supabase CLI (if available):');
  console.log('   supabase db push --linked');
  
  console.log('\n🔄 Re-run this script after manual execution to verify success.');
}

executeQueueTables().catch(console.error);