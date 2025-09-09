#!/usr/bin/env tsx

import { supabase } from './src/lib/supabase-client';

async function checkSchema() {
  console.log('Checking content_queue schema...');
  
  // Try to get one row to see structure
  const { data, error } = await supabase
    .from('content_queue')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Error:', error.message);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('Existing columns:', Object.keys(data[0]));
  } else {
    console.log('Table is empty, inserting test row to check columns...');
    
    // Try minimal insert
    const { error: insertError } = await supabase
      .from('content_queue')
      .insert({
        title: 'Schema Test',
        url: 'https://test.com',
        description: 'test',
        score: 50
      });
    
    if (insertError) {
      console.log('Insert error:', insertError);
    } else {
      console.log('Basic insert worked!');
    }
  }
}

checkSchema();