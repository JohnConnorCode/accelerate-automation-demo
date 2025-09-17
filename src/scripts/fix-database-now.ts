#!/usr/bin/env tsx



// Load env vars
import * as dotenv from 'dotenv';
import { supabase } from '../lib/supabase-client';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ No Supabase key found');
  process.exit(1);
}



async function fixDatabase() {
  console.log('🔨 FIXING DATABASE ISSUES...\n');
  
  // Fix 1: Remove constraint
  console.log('1️⃣ Removing description constraint...');
  const { error: constraintError } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_description_check;`
  }).single();
  
  if (constraintError) {
    console.log('   Cannot execute via RPC, trying alternative...');
    
    // Test if we can insert with empty description
    const testUrl = `https://test-${Date.now()}.example.com`;
    const { error: testError } = await supabase
      .from('content_queue')
      .insert({
        title: 'Test Funding Item',
        description: '', // Empty description
        url: testUrl,
        source: 'test',
        type: 'funding',
        status: 'pending_review'
      } as any);
    
    if (!testError) {
      console.log('   ✅ Constraint already removed or not blocking');
      // Clean up
      await supabase.from('content_queue').delete().eq('url', testUrl);
    } else if (testError.code === '23514') {
      console.log('   ❌ Constraint still blocking - needs manual fix in Supabase dashboard');
    }
  } else {
    console.log('   ✅ Constraint removed');
  }
  
  // Fix 2: Create accelerate_startups table
  console.log('\n2️⃣ Creating accelerate_startups table...');
  
  // First check if it exists
  const { error: checkError } = await supabase
    .from('accelerate_startups')
    .select('id')
    .limit(1);
  
  if (!checkError) {
    console.log('   ✅ Table already exists');
  } else if (checkError.message.includes('does not exist')) {
    console.log('   ❌ Table needs to be created');
    console.log('   Please run this SQL in Supabase SQL Editor:');
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
);`);
  }
  
  // Check OpenAI key
  console.log('\n3️⃣ Checking OpenAI API key...');
  if (process.env.OPENAI_API_KEY) {
    console.log('   ✅ OpenAI API key found');
  } else {
    console.log('   ❌ No OpenAI API key in environment');
    console.log('   Checking Vercel environment variables...');
    
    // The key might be in Vercel but not local
    console.log('   To sync from Vercel: vercel env pull');
  }
  
  // Test the system
  console.log('\n4️⃣ Testing funding storage...');
  const testFunding = {
    title: 'Test Grant Program',
    description: 'A test funding program',
    url: `https://test-grant-${Date.now()}.example.com`,
    source: 'test',
    type: 'funding',
    status: 'pending_review',
    score: 50
  };
  
  const { error: insertError } = await supabase
    .from('content_queue')
    .insert(testFunding as any);
  
  if (!insertError) {
    console.log('   ✅ Funding items can be stored');
    // Clean up
    await supabase.from('content_queue').delete().eq('url', testFunding.url);
  } else {
    console.log('   ❌ Funding storage failed:', insertError.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DATABASE STATUS:\n');
  
  const issues = [];
  
  // Check all tables
  const tables = ['content_queue', 'accelerate_startups', 'funding_programs', 'resources'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
      issues.push(table);
    } else {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      console.log(`✅ ${table}: ${count || 0} items`);
    }
  }
  
  if (issues.length === 0) {
    console.log('\n🎉 DATABASE FULLY CONFIGURED!');
  } else {
    console.log('\n⚠️ Issues remaining:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  }
}

fixDatabase().catch(console.error);