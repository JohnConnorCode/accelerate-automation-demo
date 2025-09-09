#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function checkQueueTables() {
  console.log('🔍 CHECKING QUEUE TABLES (from migration)...\n');
  
  // Test the correct table names from the migration
  const correctTables = [
    'queue_projects',
    'queue_funding_programs', 
    'queue_resources'
  ];
  
  for (const table of correctTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table}: Table does not exist`);
        } else {
          console.log(`⚠️ ${table}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table}: EXISTS with ${count || 0} items`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Connection error`);
    }
  }
  
  // Now test insertion with constraints
  console.log('\n🧪 TESTING CONSTRAINTS ON EXISTING TABLES...');
  const timestamp = Date.now();
  
  // Test queue_projects with short description
  console.log('\n1️⃣ Testing queue_projects constraint...');
  try {
    const { data, error } = await supabase
      .from('queue_projects')
      .insert({
        name: 'Test Project',
        description: 'Short desc', // This should trigger constraint if it exists
        source: 'constraint-test'
      })
      .select();
    
    if (error) {
      console.log('   ❌ Constraint blocking insertion:', error.code, '-', error.message);
      if (error.code === '23514') {
        console.log('   📋 Need to run: ALTER TABLE queue_projects DROP CONSTRAINT IF EXISTS <constraint_name>;');
      }
    } else {
      console.log('   ✅ Insertion successful:', data);
      // Clean up
      await supabase.from('queue_projects').delete().eq('source', 'constraint-test');
    }
  } catch (err) {
    console.log('   ❌ Exception:', err);
  }
  
  // Test queue_funding_programs
  console.log('\n2️⃣ Testing queue_funding_programs constraint...');
  try {
    const { data, error } = await supabase
      .from('queue_funding_programs')
      .insert({
        name: 'Test Grant',
        organization: 'Test Org',
        description: 'Short desc', // This should trigger constraint if it exists
        source: 'constraint-test'
      })
      .select();
    
    if (error) {
      console.log('   ❌ Constraint blocking insertion:', error.code, '-', error.message);
      if (error.code === '23514') {
        console.log('   📋 Need to run: ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS <constraint_name>;');
      }
    } else {
      console.log('   ✅ Insertion successful:', data);
      // Clean up
      await supabase.from('queue_funding_programs').delete().eq('source', 'constraint-test');
    }
  } catch (err) {
    console.log('   ❌ Exception:', err);
  }
  
  // Test queue_resources
  console.log('\n3️⃣ Testing queue_resources constraint...');
  try {
    const { data, error } = await supabase
      .from('queue_resources')
      .insert({
        title: 'Test Resource',
        description: 'Short desc', // This should trigger constraint if it exists
        url: `https://test-${timestamp}.com`,
        source: 'constraint-test'
      })
      .select();
    
    if (error) {
      console.log('   ❌ Constraint blocking insertion:', error.code, '-', error.message);
      if (error.code === '23514') {
        console.log('   📋 Need to run: ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS <constraint_name>;');
      }
    } else {
      console.log('   ✅ Insertion successful:', data);
      // Clean up
      await supabase.from('queue_resources').delete().eq('source', 'constraint-test');
    }
  } catch (err) {
    console.log('   ❌ Exception:', err);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 CONCLUSION:');
  console.log('If tables exist but constraints are blocking insertions,');
  console.log('update the fix-staging-constraints.sql file to use correct table names:');
  console.log('- queue_projects (not queued_projects)');
  console.log('- queue_funding_programs (not queued_funding_programs)');
  console.log('- queue_resources (not queued_resources)');
}

checkQueueTables().catch(console.error);