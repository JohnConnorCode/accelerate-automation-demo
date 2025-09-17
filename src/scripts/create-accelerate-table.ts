#!/usr/bin/env tsx

/**
 * Create the missing accelerate_startups production table
 */

import { supabase } from '../lib/supabase-client';

async function createAccelerateTable() {
  console.log('🔨 Creating accelerate_startups table...\n');
  
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS public.accelerate_startups (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      url TEXT UNIQUE NOT NULL,
      logo_url TEXT,
      founded_date DATE,
      team_size INTEGER,
      funding_raised DECIMAL(15,2) DEFAULT 0,
      funding_stage TEXT,
      categories TEXT[],
      technologies TEXT[],
      project_needs TEXT[],
      location TEXT,
      contact_email TEXT,
      social_links JSONB,
      metadata JSONB,
      score INTEGER DEFAULT 0,
      ai_summary TEXT,
      last_activity DATE,
      approved_at TIMESTAMP DEFAULT NOW(),
      approved_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  // Try to execute via RPC (if we have a function for it)
  const { error: rpcError } = await supabase.rpc('exec_sql', { query: createTableSQL });
  
  if (rpcError) {
    console.log('❌ Cannot create table via RPC:', rpcError.message);
    console.log('\n📝 Please run this SQL in Supabase SQL Editor:\n');
    console.log(createTableSQL);
    console.log('\n');
    return false;
  }
  
  console.log('✅ Table created successfully!');
  
  // Verify it exists
  const { error: testError } = await supabase
    .from('accelerate_startups')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.log('❌ Table creation failed:', testError.message);
    return false;
  }
  
  console.log('✅ Table verified and ready!');
  return true;
}

// Also check if we can fix the description constraint
async function checkAndFixConstraints() {
  console.log('\n🔍 Checking content_queue constraints...');
  
  // Test inserting with empty description
  const testItem = {
    title: 'Test Funding Item',
    description: '', // Empty description
    url: 'https://test.example.com/' + Date.now(),
    source: 'test',
    type: 'funding',
    status: 'pending_review',
    score: 50
  };
  
  const { error } = await supabase
    .from('content_queue')
    .insert(testItem as any);
  
  if (error?.code === '23514') {
    console.log('❌ Database has constraint preventing empty descriptions');
    console.log('   This needs to be fixed in Supabase SQL Editor:');
    console.log('\n   ALTER TABLE content_queue');
    console.log('   DROP CONSTRAINT IF EXISTS content_queue_description_check;');
    console.log('\n   Or update the constraint to allow empty strings for funding items.\n');
    
    // Clean up test
    await supabase
      .from('content_queue')
      .delete()
      .eq('url', testItem.url);
  } else if (!error) {
    console.log('✅ Empty descriptions are allowed');
    // Clean up test
    await supabase
      .from('content_queue')
      .delete()
      .eq('url', testItem.url);
  } else {
    console.log('⚠️ Different error:', error.message);
  }
}

async function main() {
  console.log('🚀 FIXING PRODUCTION TABLE ISSUES\n');
  console.log('=' .repeat(60));
  
  const tableCreated = await createAccelerateTable();
  await checkAndFixConstraints();
  
  console.log('\n' + '=' .repeat(60));
  if (tableCreated) {
    console.log('✅ SYSTEM READY FOR PRODUCTION!');
  } else {
    console.log('⚠️ Manual intervention needed in Supabase SQL Editor');
  }
}

main().catch(console.error);