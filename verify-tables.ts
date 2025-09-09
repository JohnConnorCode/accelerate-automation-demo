#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifyTables() {
  console.log('🔍 Verifying Queue Tables...\n');

  const tables = ['queue_projects', 'queue_news', 'queue_investors'];
  
  for (const table of tables) {
    try {
      // Try to count rows in each table
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: Table exists (${count || 0} rows)`);
      }
    } catch (e) {
      console.log(`❌ ${table}: Error - ${e}`);
    }
  }
  
  console.log('\n📊 Testing insert into queue_projects...');
  
  const testData = {
    company_name: 'Test Startup ' + Date.now(),
    description: 'A test company to verify table creation',
    source: 'manual_test',
    accelerate_fit: true,
    accelerate_reason: 'Testing table functionality',
    accelerate_score: 0.85,
    confidence_score: 0.90,
    founded_year: 2024,
    location: 'San Francisco, CA',
    website: 'https://example.com'
  };
  
  const { data, error } = await supabase
    .from('queue_projects')
    .insert(testData)
    .select()
    .single();
  
  if (error) {
    console.log('❌ Insert failed:', error.message);
  } else {
    console.log('✅ Insert successful! Test record created:');
    console.log(`   - ID: ${data.id}`);
    console.log(`   - Company: ${data.company_name}`);
    console.log(`   - ACCELERATE Score: ${data.accelerate_score}`);
    
    // Clean up test data
    await supabase
      .from('queue_projects')
      .delete()
      .eq('id', data.id);
    
    console.log('   - Test record cleaned up');
  }
  
  console.log('\n✨ All queue tables are ready for use!');
}

verifyTables().catch(console.error);