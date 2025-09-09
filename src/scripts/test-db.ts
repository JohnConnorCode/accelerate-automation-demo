#!/usr/bin/env node
/**
 * Test database connectivity
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';

config();

async function testDB() {
  console.log('Testing database connection...\n');
  
  // Test 1: Check if we can connect
  console.log('1. Testing basic connection...');
  try {
    const { data, error } = await supabase
      .from('content_queue')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Connected to database');
  } catch (e) {
    console.log('❌ Connection error:', e);
    return false;
  }
  
  // Test 2: Check table schema
  console.log('\n2. Checking content_queue columns...');
  try {
    const { data, error } = await supabase
      .from('content_queue')
      .select('*')
      .limit(0);
    
    if (!error && data) {
      console.log('✅ Table exists and is accessible');
    }
  } catch (e) {
    console.log('❌ Table access error:', e);
  }
  
  // Test 3: Try simple insert
  console.log('\n3. Testing simple insert...');
  const testItem = {
    title: 'Test Item ' + Date.now(),
    description: 'This is a test item',
    url: 'https://example.com',
    source: 'test',
    type: 'project',
    score: 50,
    confidence: 0.5,
    factors: { test: true },
    recommendation: 'review',
    status: 'pending_review',
    raw_data: { test: true },
    metadata: {},
    tags: ['test'],
    created_at: new Date().toISOString()
  };
  
  console.log('Inserting:', JSON.stringify(testItem, null, 2));
  
  try {
    const { data, error } = await supabase
      .from('content_queue')
      .insert([testItem])
      .select('id, title');
    
    if (error) {
      console.log('❌ Insert failed:', error.message);
      console.log('Error details:', error);
    } else if (data && data.length > 0) {
      console.log('✅ Insert successful! ID:', data[0].id);
      
      // Clean up test item
      const { error: deleteError } = await supabase
        .from('content_queue')
        .delete()
        .eq('id', data[0].id);
      
      if (!deleteError) {
        console.log('✅ Test item cleaned up');
      }
    } else {
      console.log('⚠️ Insert returned no data');
    }
  } catch (e) {
    console.log('❌ Insert error:', e);
  }
  
  // Test 4: Count items
  console.log('\n4. Counting items in queue...');
  try {
    const { count, error } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Count failed:', error.message);
    } else {
      console.log(`✅ Total items in queue: ${count}`);
    }
  } catch (e) {
    console.log('❌ Count error:', e);
  }
  
  return true;
}

// Run test
testDB().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ Database tests completed');
  } else {
    console.log('❌ Database tests failed');
  }
  process.exit(success ? 0 : 1);
});