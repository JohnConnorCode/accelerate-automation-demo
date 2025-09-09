#!/usr/bin/env npx tsx

import { supabase } from './src/lib/supabase-client';

async function testTableCreation() {
  console.log('🧪 TESTING TABLE CREATION\n');
  console.log('='.repeat(60));
  
  // Test if we can create a simple test table first
  console.log('\n1. Testing if we can create tables via API...\n');
  
  const testTableName = 'test_queue_' + Date.now();
  
  // Try to insert into a non-existent table to see error
  const { error: testError } = await supabase
    .from(testTableName)
    .insert({ test: 'data' });
  
  console.log('Expected error (table does not exist):');
  console.log(testError?.message || 'No error - something is wrong');
  
  // Check if our queue tables exist
  console.log('\n2. Checking if queue tables exist...\n');
  
  const tables = [
    'queue_projects',
    'queue_funding_programs', 
    'queue_resources'
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error?.code === '42P01') {
      console.log(`❌ ${table}: Does not exist`);
    } else if (error) {
      console.log(`⚠️  ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: Exists`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n⚠️  CRITICAL FINDING:\n');
  console.log('We CANNOT create tables via Supabase client API.');
  console.log('Tables MUST be created in Supabase Dashboard SQL editor.');
  console.log('\nGo to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('Run: create-robust-queue-tables.sql');
}

testTableCreation().catch(console.error);