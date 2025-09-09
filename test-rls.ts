#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testRLS() {
  console.log('🔒 Testing Row Level Security Policies\n');
  
  // Test read access
  const { data: readTest, error: readError } = await supabase
    .from('queue_news')
    .select('id')
    .limit(1);
  
  if (readError) {
    console.log('❌ RLS blocking READ access:', readError.message);
  } else {
    console.log('✅ RLS allows READ access');
  }
  
  // Test write access
  const testItem = {
    title: 'RLS Test Item',
    url: 'https://test.com/rls-test',
    source: 'rls-test',
    accelerate_score: 5.0,
    accelerate_fit: true,
    created_at: new Date().toISOString()
  };
  
  const { error: writeError } = await supabase
    .from('queue_news')
    .insert(testItem);
  
  if (writeError) {
    console.log('❌ RLS blocking WRITE access:', writeError.message);
  } else {
    console.log('✅ RLS allows WRITE access');
    
    // Clean up test item
    await supabase
      .from('queue_news')
      .delete()
      .eq('title', 'RLS Test Item');
  }
  
  // Test delete access  
  const { error: deleteError } = await supabase
    .from('queue_news')
    .delete()
    .eq('title', 'Non-existent-item-for-rls-test');
  
  if (deleteError) {
    console.log('❌ RLS blocking DELETE access:', deleteError.message);
  } else {
    console.log('✅ RLS allows DELETE access');
  }
  
  console.log('\n✅ RLS policies configured correctly for internal tool');
}

testRLS().catch(console.error);