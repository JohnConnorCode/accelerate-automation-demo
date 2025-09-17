#!/usr/bin/env npx tsx


import type { Database } from '../src/types/supabase';
import { readFileSync } from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase-client';


// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('🔧 Attempting to create queue tables via Supabase client...\n');



async function createTables() {
  // Since we can't execute raw DDL with anon key, let's verify what we have
  // and create the tables using the Supabase client methods
  
  console.log('📋 Checking existing tables...');
  
  const tables = ['queue_projects', 'queue_investors', 'queue_news'];
  const missingTables = [];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(0);
    
    if (error && error.message.includes('does not exist')) {
      missingTables.push(table);
      console.log(`   ❌ ${table} - does not exist`);
    } else if (error) {
      console.log(`   ⚠️  ${table} - ${error.message}`);
    } else {
      console.log(`   ✅ ${table} - exists`);
    }
  }
  
  if (missingTables.length > 0) {
    console.log('\n⚠️  Missing tables detected:', missingTables.join(', '));
    console.log('\n📝 SQL to create missing tables has been prepared:');
    console.log('   File: database/create-queue-tables.sql');
    console.log('\n🔗 To create the tables:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor');
    console.log('2. Copy the contents of database/create-queue-tables.sql');
    console.log('3. Paste and click "Run"');
    console.log('\n💡 Alternative: Get a service role key with admin privileges');
    console.log('   From: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/settings/api');
    console.log('   Add to .env: SUPABASE_SERVICE_KEY=your-service-key');
  } else {
    console.log('\n✅ All required tables exist!');
    
    // Test upsert functionality
    console.log('\n🧪 Testing upsert functionality...');
    const testData = {
      url: 'https://test.example.com/test-' + Date.now(),
      title: 'Test Item',
      description: 'Testing upsert',
      source: 'test',
      score: 0.85,
      status: 'pending'
    };
    
    const { data: upsertData, error: upsertError } = await supabase
      .from('queue_projects')
      .upsert(testData, {
        onConflict: 'url',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (upsertError) {
      console.log('   ❌ Upsert failed:', upsertError.message);
      if (upsertError.message.includes('unique') || upsertError.code === '23505') {
        console.log('   ℹ️  Constraints are working but upsert syntax may need adjustment');
      }
    } else {
      console.log('   ✅ Upsert successful!');
      
      // Clean up test data
      await supabase
        .from('queue_projects')
        .delete()
        .eq('url', testData.url);
      console.log('   ✅ Test data cleaned up');
    }
  }
}

createTables().catch(console.error);