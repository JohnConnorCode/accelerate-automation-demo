#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function testConstraintInsertion() {
  console.log('🧪 TESTING CONSTRAINT INSERTION...\n');
  
  const timestamp = Date.now();
  
  // Test 1: queued_projects with minimal valid data
  console.log('1️⃣ Testing queued_projects insertion...');
  const testProject = {
    name: 'Test Project',
    description: 'Test', // Short description to trigger constraint
    url: `https://test-proj-${timestamp}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  console.log('   Inserting:', JSON.stringify(testProject, null, 2));
  const { data: projectData, error: projectError } = await supabase
    .from('queued_projects')
    .insert(testProject)
    .select();
  
  if (projectError) {
    console.log('   ❌ INSERT FAILED:', projectError.code, '-', projectError.message);
    console.log('   ❌ Details:', projectError.details);
    console.log('   ❌ Hint:', projectError.hint);
  } else {
    console.log('   ✅ INSERT SUCCESS:', projectData);
    // Clean up
    await supabase.from('queued_projects').delete().eq('source', 'test');
  }
  
  // Test 2: queued_funding_programs
  console.log('\n2️⃣ Testing queued_funding_programs insertion...');
  const testFunding = {
    name: 'Test Grant',
    organization: 'Test Org',
    description: 'Test', // Short description to trigger constraint
    url: `https://test-grant-${timestamp}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  console.log('   Inserting:', JSON.stringify(testFunding, null, 2));
  const { data: fundingData, error: fundingError } = await supabase
    .from('queued_funding_programs')
    .insert(testFunding)
    .select();
  
  if (fundingError) {
    console.log('   ❌ INSERT FAILED:', fundingError.code, '-', fundingError.message);
    console.log('   ❌ Details:', fundingError.details);
    console.log('   ❌ Hint:', fundingError.hint);
  } else {
    console.log('   ✅ INSERT SUCCESS:', fundingData);
    // Clean up
    await supabase.from('queued_funding_programs').delete().eq('source', 'test');
  }
  
  // Test 3: queued_resources
  console.log('\n3️⃣ Testing queued_resources insertion...');
  const testResource = {
    title: 'Test Resource',
    description: 'Test', // Short description to trigger constraint
    url: `https://test-res-${timestamp}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  console.log('   Inserting:', JSON.stringify(testResource, null, 2));
  const { data: resourceData, error: resourceError } = await supabase
    .from('queued_resources')
    .insert(testResource)
    .select();
  
  if (resourceError) {
    console.log('   ❌ INSERT FAILED:', resourceError.code, '-', resourceError.message);
    console.log('   ❌ Details:', resourceError.details);
    console.log('   ❌ Hint:', resourceError.hint);
  } else {
    console.log('   ✅ INSERT SUCCESS:', resourceData);
    // Clean up
    await supabase.from('queued_resources').delete().eq('source', 'test');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('If you see constraint errors above (code 23514), run this SQL:');
  console.log(`
-- Copy this to Supabase SQL Editor:
ALTER TABLE queued_projects DROP CONSTRAINT IF EXISTS queued_projects_description_check;
ALTER TABLE queued_projects ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_projects DROP CONSTRAINT IF EXISTS queued_projects_status_check;

ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_description_check;
ALTER TABLE queued_funding_programs ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_funding_type_check;
ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_status_check;

ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_description_check;
ALTER TABLE queued_resources ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_resource_type_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_price_type_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_difficulty_level_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_status_check;
  `);
}

testConstraintInsertion().catch(console.error);