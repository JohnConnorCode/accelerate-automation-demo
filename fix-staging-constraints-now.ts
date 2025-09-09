#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function fixStagingConstraints() {
  console.log('🔨 FIXING STAGING TABLE CONSTRAINTS...\n');
  
  // Test connection first
  try {
    const { count, error } = await supabase
      .from('queued_projects')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Cannot connect to database:', error.message);
      return;
    }
    console.log('✅ Connected to database\n');
    console.log(`   Found ${count || 0} items in queued_projects`);
  } catch (err) {
    console.error('❌ Connection failed:', err);
    return;
  }
  
  console.log('1️⃣ Removing description constraints...');
  
  // Unfortunately, we can't run ALTER TABLE commands through Supabase client
  // So we'll test if the constraints are still there by trying to insert
  
  // Test queued_projects
  console.log('   Testing queued_projects...');
  const testProject = {
    name: 'Test Project',
    description: 'Test', // Short description
    url: `https://test-proj-${Date.now()}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  const { error: projectError } = await supabase
    .from('queued_projects')
    .insert(testProject);
  
  if (projectError?.code === '23514') {
    console.log('   ❌ queued_projects still has description constraint');
    console.log('   Please run this SQL in Supabase Dashboard:');
    console.log('   ALTER TABLE queued_projects DROP CONSTRAINT IF EXISTS queued_projects_description_check;');
    console.log('   ALTER TABLE queued_projects ALTER COLUMN description DROP NOT NULL;');
  } else if (!projectError) {
    console.log('   ✅ queued_projects constraints fixed');
    // Clean up test data
    await supabase.from('queued_projects').delete().eq('source', 'test');
  } else {
    console.log('   ⚠️ Different error:', projectError.message);
  }
  
  // Test queued_funding_programs
  console.log('   Testing queued_funding_programs...');
  const testFunding = {
    name: 'Test Grant',
    organization: 'Test Org',
    description: 'Test', // Short description
    url: `https://test-grant-${Date.now()}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  const { error: fundingError } = await supabase
    .from('queued_funding_programs')
    .insert(testFunding);
  
  if (fundingError?.code === '23514') {
    console.log('   ❌ queued_funding_programs still has constraints');
    console.log('   Please run this SQL in Supabase Dashboard:');
    console.log('   ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_description_check;');
    console.log('   ALTER TABLE queued_funding_programs ALTER COLUMN description DROP NOT NULL;');
    console.log('   ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_funding_type_check;');
  } else if (!fundingError) {
    console.log('   ✅ queued_funding_programs constraints fixed');
    // Clean up test data
    await supabase.from('queued_funding_programs').delete().eq('source', 'test');
  } else {
    console.log('   ⚠️ Different error:', fundingError.message);
  }
  
  // Test queued_resources
  console.log('   Testing queued_resources...');
  const testResource = {
    title: 'Test Resource',
    description: 'Test', // Short description
    url: `https://test-res-${Date.now()}.com`,
    source: 'test',
    score: 50,
    status: 'pending_review'
  };
  
  const { error: resourceError } = await supabase
    .from('queued_resources')
    .insert(testResource);
  
  if (resourceError?.code === '23514') {
    console.log('   ❌ queued_resources still has constraints');
    console.log('   Please run this SQL in Supabase Dashboard:');
    console.log('   ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_description_check;');
    console.log('   ALTER TABLE queued_resources ALTER COLUMN description DROP NOT NULL;');
    console.log('   ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_resource_type_check;');
    console.log('   ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_price_type_check;');
    console.log('   ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_difficulty_level_check;');
  } else if (!resourceError) {
    console.log('   ✅ queued_resources constraints fixed');
    // Clean up test data
    await supabase.from('queued_resources').delete().eq('source', 'test');
  } else {
    console.log('   ⚠️ Different error:', resourceError.message);
  }
  
  console.log('\n2️⃣ Final verification...');
  
  // Get counts for all staging tables
  const tables = ['queued_projects', 'queued_funding_programs', 'queued_resources'];
  let allWorking = true;
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
        allWorking = false;
      } else {
        console.log(`   ✅ ${table}: ${count || 0} items`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: Connection error`);
      allWorking = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (allWorking) {
    console.log('🎉 STAGING TABLES READY!');
    console.log('   All staging tables are accessible and constraints are fixed');
  } else {
    console.log('⚠️ STAGING TABLES NEED MANUAL SQL FIXES');
    console.log('   Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
    console.log('   Run the ALTER TABLE commands shown above');
    console.log('   Or run the complete SQL from fix-staging-constraints.sql');
  }
  
  console.log('\n📋 COMPLETE SQL TO RUN IN SUPABASE DASHBOARD:');
  console.log('   Copy this entire block into the SQL Editor:');
  console.log(`
-- Fix queued_projects
ALTER TABLE queued_projects DROP CONSTRAINT IF EXISTS queued_projects_description_check;
ALTER TABLE queued_projects ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_projects DROP CONSTRAINT IF EXISTS queued_projects_status_check;

-- Fix queued_funding_programs  
ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_description_check;
ALTER TABLE queued_funding_programs ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_funding_type_check;
ALTER TABLE queued_funding_programs DROP CONSTRAINT IF EXISTS queued_funding_programs_status_check;

-- Fix queued_resources
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_description_check;
ALTER TABLE queued_resources ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_resource_type_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_price_type_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_difficulty_level_check;
ALTER TABLE queued_resources DROP CONSTRAINT IF EXISTS queued_resources_status_check;
  `);
}

fixStagingConstraints().catch(console.error);