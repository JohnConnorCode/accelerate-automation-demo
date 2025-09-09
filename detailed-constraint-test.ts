#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function detailedConstraintTest() {
  console.log('🔍 DETAILED CONSTRAINT ANALYSIS...\n');
  
  const timestamp = Date.now();
  
  // Test with the most minimal data first to see exactly what fails
  console.log('1️⃣ Testing queued_projects with minimal data...');
  
  try {
    const result = await supabase
      .from('queued_projects')
      .insert({
        name: 'Test',
        url: `https://test-${timestamp}.com`
      })
      .select();
    
    console.log('   ✅ Basic insert worked:', result.data);
    
    if (result.data && result.data.length > 0) {
      // Clean up
      await supabase.from('queued_projects').delete().eq('url', `https://test-${timestamp}.com`);
    }
  } catch (error) {
    console.log('   ❌ Basic insert failed with exception:', error);
  }
  
  // Now test with short description that might trigger constraint
  console.log('\n2️⃣ Testing short description constraint...');
  
  try {
    const result = await supabase
      .from('queued_projects')
      .insert({
        name: 'Test Project',
        description: 'Short', // Less than 50 chars
        url: `https://test-desc-${timestamp}.com`
      })
      .select();
    
    if (result.error) {
      console.log('   ❌ Short description failed:');
      console.log('      Code:', result.error.code);
      console.log('      Message:', result.error.message);
      console.log('      Details:', result.error.details);
      console.log('      Hint:', result.error.hint);
      console.log('      Full error:', JSON.stringify(result.error, null, 2));
    } else {
      console.log('   ✅ Short description worked:', result.data);
      if (result.data && result.data.length > 0) {
        // Clean up
        await supabase.from('queued_projects').delete().eq('url', `https://test-desc-${timestamp}.com`);
      }
    }
  } catch (error) {
    console.log('   ❌ Exception during short description test:', error);
  }
  
  // Test with long enough description
  console.log('\n3️⃣ Testing long description...');
  
  try {
    const longDescription = 'This is a long description that should definitely be over 50 characters to pass any length constraint checks.';
    const result = await supabase
      .from('queued_projects')
      .insert({
        name: 'Test Project Long',
        description: longDescription,
        url: `https://test-long-${timestamp}.com`
      })
      .select();
    
    if (result.error) {
      console.log('   ❌ Long description failed:', result.error.message);
    } else {
      console.log('   ✅ Long description worked:', result.data);
      if (result.data && result.data.length > 0) {
        // Clean up
        await supabase.from('queued_projects').delete().eq('url', `https://test-long-${timestamp}.com`);
      }
    }
  } catch (error) {
    console.log('   ❌ Exception during long description test:', error);
  }
  
  // Get table schema to understand constraints
  console.log('\n4️⃣ Checking table schema...');
  
  try {
    const { data, error } = await supabase
      .from('queued_projects')
      .select('*')
      .limit(0); // Just get schema, no data
    
    if (error) {
      console.log('   ❌ Schema check failed:', error.message);
    } else {
      console.log('   ✅ Table schema accessible');
    }
  } catch (error) {
    console.log('   ❌ Exception during schema check:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY:');
  console.log('   The constraint issues may be preventing basic insertions.');
  console.log('   Please execute the SQL constraints fix in Supabase Dashboard.');
  console.log('\n🔗 Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('\n📝 Execute this SQL:');
  console.log(`
-- Remove all blocking constraints from staging tables
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

-- Test insertions
INSERT INTO queued_projects (name, description, url, source, score, status)
VALUES ('Test Project', 'Test', 'https://test-proj-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

INSERT INTO queued_funding_programs (name, organization, description, url, source, score, status)
VALUES ('Test Grant', 'Test Org', 'Test', 'https://test-grant-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

INSERT INTO queued_resources (title, description, url, source, score, status)
VALUES ('Test Resource', 'Test', 'https://test-res-' || extract(epoch from now()) || '.com', 'test', 50, 'pending_review');

-- Verify it worked
SELECT 'queued_projects' as table_name, COUNT(*) as count FROM queued_projects
UNION ALL
SELECT 'queued_funding_programs', COUNT(*) FROM queued_funding_programs
UNION ALL
SELECT 'queued_resources', COUNT(*) FROM queued_resources;

-- Clean up test data
DELETE FROM queued_projects WHERE source = 'test';
DELETE FROM queued_funding_programs WHERE source = 'test';
DELETE FROM queued_resources WHERE source = 'test';
  `);
}

detailedConstraintTest().catch(console.error);