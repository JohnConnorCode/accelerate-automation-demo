#!/usr/bin/env tsx

import { supabase } from '../src/lib/supabase-client';

async function checkDBStructure() {
  console.log('🔍 CHECKING ACTUAL DATABASE STRUCTURE\n');
  console.log('=' .repeat(60));
  
  // Check all queue tables
  const queueTables = [
    'content_queue',
    'queue_projects', 
    'queue_resources',
    'queue_investors',
    'queue_news'
  ];
  
  console.log('\n📋 QUEUE TABLES (for staging/review):');
  for (const table of queueTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`✅ ${table} - EXISTS (${data?.length || 0} sample rows)`);
    } else {
      console.log(`❌ ${table} - ${error.code === '42P01' ? 'NOT FOUND' : error.message}`);
    }
  }
  
  // Check live/approved tables
  const liveTables = [
    'content_curated',
    'accelerate_projects',
    'accelerate_startups',
    'accelerate_resources',
    'accelerate_investors',
    'projects_live',
    'resources_live',
    'investors_live'
  ];
  
  console.log('\n🚀 LIVE TABLES (for approved content):');
  for (const table of liveTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`✅ ${table} - EXISTS (${data?.length || 0} rows)`);
    } else {
      console.log(`❌ ${table} - ${error.code === '42P01' ? 'NOT FOUND' : error.message}`);
    }
  }
  
  // Show the data flow
  console.log('\n📊 UNDERSTANDING THE DATA FLOW:');
  console.log('1. Fetch from sources → Validate with AccelerateValidator');
  console.log('2. Insert to queue_* tables for manual review');
  console.log('3. Admin approves → Move to live/accelerate_* tables');
  console.log('4. Live tables are what users see');
  
  // Check what's actually in queue_projects
  const { data: projects } = await supabase
    .from('queue_projects')
    .select('id, company_name, created_at')
    .limit(3);
    
  if (projects && projects.length > 0) {
    console.log('\n📌 Sample queue_projects:');
    projects.forEach(p => {
      console.log(`   - ${p.company_name} (${p.id})`);
    });
  }
}

checkDBStructure();
