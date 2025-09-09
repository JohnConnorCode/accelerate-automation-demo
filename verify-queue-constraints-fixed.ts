#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function verifyConstraintsFixed() {
  console.log('✅ VERIFYING QUEUE CONSTRAINTS ARE FIXED...\n');
  
  const timestamp = Date.now();
  let allTestsPassed = true;
  
  // Test 1: queue_projects with minimal/invalid data that should have triggered constraints
  console.log('1️⃣ Testing queue_projects with constraint-triggering data...');
  
  const testProject = {
    name: 'Test Project',
    description: 'Short', // Previously would fail 50+ char constraint
    source: 'verification-test',
    status: 'pending_review' // Custom status that might have failed enum constraint
  };
  
  console.log('   Inserting:', JSON.stringify(testProject, null, 2));
  
  const { data: projectData, error: projectError } = await supabase
    .from('queue_projects')
    .insert(testProject)
    .select();
  
  if (projectError) {
    console.log('   ❌ STILL BLOCKED:', projectError.code, '-', projectError.message);
    allTestsPassed = false;
  } else {
    console.log('   ✅ SUCCESS! Data inserted:', projectData?.length, 'record(s)');
  }
  
  // Test 2: queue_funding_programs
  console.log('\n2️⃣ Testing queue_funding_programs...');
  
  const testFunding = {
    name: 'Test Grant',
    organization: 'Test Org',
    description: 'Short desc', // Previously would fail constraint
    source: 'verification-test',
    funding_type: 'custom_type', // Might have failed enum constraint
    status: 'pending_review'
  };
  
  console.log('   Inserting:', JSON.stringify(testFunding, null, 2));
  
  const { data: fundingData, error: fundingError } = await supabase
    .from('queue_funding_programs')
    .insert(testFunding)
    .select();
  
  if (fundingError) {
    console.log('   ❌ STILL BLOCKED:', fundingError.code, '-', fundingError.message);
    allTestsPassed = false;
  } else {
    console.log('   ✅ SUCCESS! Data inserted:', fundingData?.length, 'record(s)');
  }
  
  // Test 3: queue_resources
  console.log('\n3️⃣ Testing queue_resources...');
  
  const testResource = {
    title: 'Test Resource',
    description: 'Test', // Previously would fail constraint
    url: `https://test-verify-${timestamp}.com`,
    source: 'verification-test',
    resource_type: 'custom_type', // Might have failed enum constraint
    price_type: 'custom_price', // Might have failed enum constraint
    difficulty_level: 'custom_level', // Might have failed enum constraint
    status: 'pending_review'
  };
  
  console.log('   Inserting:', JSON.stringify(testResource, null, 2));
  
  const { data: resourceData, error: resourceError } = await supabase
    .from('queue_resources')
    .insert(testResource)
    .select();
  
  if (resourceError) {
    console.log('   ❌ STILL BLOCKED:', resourceError.code, '-', resourceError.message);
    allTestsPassed = false;
  } else {
    console.log('   ✅ SUCCESS! Data inserted:', resourceData?.length, 'record(s)');
  }
  
  // Test 4: Verify empty/null descriptions work
  console.log('\n4️⃣ Testing null/empty descriptions...');
  
  const { error: emptyError } = await supabase
    .from('queue_projects')
    .insert({
      name: 'Empty Desc Test',
      description: null, // Should work if NOT NULL constraint removed
      source: 'verification-test'
    });
  
  if (emptyError) {
    console.log('   ⚠️ Null description blocked:', emptyError.message);
  } else {
    console.log('   ✅ Null descriptions allowed');
  }
  
  // Clean up all test data
  console.log('\n5️⃣ Cleaning up test data...');
  
  const cleanupResults = await Promise.all([
    supabase.from('queue_projects').delete().eq('source', 'verification-test'),
    supabase.from('queue_funding_programs').delete().eq('source', 'verification-test'),
    supabase.from('queue_resources').delete().eq('source', 'verification-test')
  ]);
  
  cleanupResults.forEach((result, index) => {
    const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
    if (result.error) {
      console.log(`   ❌ Failed to clean ${tables[index]}:`, result.error.message);
    } else {
      console.log(`   ✅ Cleaned ${tables[index]}`);
    }
  });
  
  // Final status
  console.log('\n' + '='.repeat(60));
  if (allTestsPassed) {
    console.log('🎉 ALL CONSTRAINT TESTS PASSED!');
    console.log('✅ Queue tables are ready for data insertion');
    console.log('✅ Short descriptions are allowed');
    console.log('✅ Custom enum values are allowed');
    console.log('✅ System is ready for content automation');
  } else {
    console.log('❌ SOME CONSTRAINTS STILL BLOCKING');
    console.log('⚠️ Please check the errors above and run additional SQL fixes');
    console.log('💡 You may need to identify and remove additional constraints');
  }
  
  // Show table counts
  console.log('\n📊 Current table counts:');
  const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ${table}: Error - ${error.message}`);
    } else {
      console.log(`   ${table}: ${count || 0} items`);
    }
  }
}

verifyConstraintsFixed().catch(console.error);