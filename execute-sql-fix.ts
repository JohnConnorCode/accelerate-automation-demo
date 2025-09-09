#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function executeSQLFixes() {
  console.log('🔨 EXECUTING DATABASE FIXES...\n');
  
  // First, let's test our connection
  const { data: testData, error: testError } = await supabase
    .from('content_queue')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.error('❌ Cannot connect to database:', testError.message);
    return;
  }
  
  console.log('✅ Connected to database\n');
  
  // Fix 1: Check if accelerate_startups exists
  console.log('1️⃣ Checking accelerate_startups table...');
  const { error: checkError } = await supabase
    .from('accelerate_startups')
    .select('id')
    .limit(1);
  
  if (checkError?.message?.includes('does not exist')) {
    console.log('   Table does not exist - needs creation');
    console.log('   ⚠️ Cannot create table via client API');
    console.log('\n   Please run this SQL in Supabase Dashboard:');
    console.log(`
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

GRANT ALL ON public.accelerate_startups TO authenticated;
GRANT ALL ON public.accelerate_startups TO service_role;
GRANT SELECT ON public.accelerate_startups TO anon;
    `);
  } else if (!checkError) {
    console.log('   ✅ Table already exists');
  }
  
  // Fix 2: Test if we can insert funding with empty description
  console.log('\n2️⃣ Testing funding item storage...');
  const testUrl = `https://test-funding-${Date.now()}.example.com`;
  const { error: insertError } = await supabase
    .from('content_queue')
    .insert({
      title: 'Test Funding Program',
      description: '', // Empty description
      url: testUrl,
      source: 'test',
      type: 'funding',
      status: 'pending_review',
      score: 50
    });
  
  if (insertError?.code === '23514') {
    console.log('   ❌ Description constraint still blocking');
    console.log('   Run this in Supabase SQL Editor:');
    console.log('   ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_description_check;');
  } else if (!insertError) {
    console.log('   ✅ Funding items can be stored with empty descriptions');
    // Clean up test
    await supabase.from('content_queue').delete().eq('url', testUrl);
  } else {
    console.log('   ⚠️ Different error:', insertError.message);
  }
  
  // Check all tables
  console.log('\n3️⃣ Checking all production tables...');
  const tables = ['content_queue', 'accelerate_startups', 'funding_programs', 'resources'];
  let allTablesExist = true;
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
      allTablesExist = false;
    } else {
      console.log(`   ✅ ${table}: ${count || 0} items`);
    }
  }
  
  // Final status
  console.log('\n' + '=' .repeat(60));
  if (allTablesExist) {
    console.log('🎉 DATABASE READY FOR PRODUCTION!');
    console.log('   All tables exist and are accessible');
  } else {
    console.log('⚠️ DATABASE NEEDS MANUAL FIXES IN SUPABASE');
    console.log('   Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
    console.log('   Run the SQL shown above');
  }
  
  // Test the approval workflow
  console.log('\n4️⃣ Testing approval workflow...');
  const { data: pendingItem } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'pending_review')
    .limit(1)
    .single();
  
  if (pendingItem && !checkError) {
    // Try to approve it
    const { approvalService } = await import('./src/api/approve');
    const result = await approvalService.processApproval({
      itemId: pendingItem.id,
      action: 'approve',
      reviewedBy: 'system-test'
    });
    
    if (result.success) {
      console.log('   ✅ Approval workflow working!');
    } else {
      console.log('   ❌ Approval failed:', result.error);
    }
  } else {
    console.log('   ⚠️ No items to test or accelerate_startups missing');
  }
}

executeSQLFixes().catch(console.error);