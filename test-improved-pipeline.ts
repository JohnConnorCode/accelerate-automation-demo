#!/usr/bin/env npx tsx

/**
 * Test improved pipeline with higher success rate
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { createClient } from '@supabase/supabase-js';

const orchestrator = new SimpleOrchestrator();
const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testImprovedPipeline() {
  console.log('🚀 TESTING IMPROVED PIPELINE');
  console.log('=' .repeat(60));
  
  // Clear existing queue data
  console.log('\n📦 Clearing queue tables...');
  await supabase.from('queue_projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_investors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  // Run the improved orchestrator
  console.log('\n🔄 Running improved pipeline...\n');
  const startTime = Date.now();
  
  const result = await orchestrator.run();
  
  const duration = (Date.now() - startTime) / 1000;
  
  // Display results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 PIPELINE RESULTS\n');
  console.log(`Items Fetched: ${result.fetched}`);
  console.log(`Items Scored: ${result.scored}`);
  console.log(`Items Stored: ${result.stored}`);
  console.log(`Items Rejected: ${result.rejected}`);
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`\n🎯 SUCCESS RATE: ${result.successRate}%`);
  
  // Verify queue data
  const { data: projects } = await supabase.from('queue_projects').select('id', { count: 'exact', head: true });
  const { data: news } = await supabase.from('queue_news').select('id', { count: 'exact', head: true });
  const { data: investors } = await supabase.from('queue_investors').select('id', { count: 'exact', head: true });
  
  console.log('\n📦 QUEUE STATUS:');
  console.log(`Projects: ${projects?.count || 0}`);
  console.log(`News: ${news?.count || 0}`);
  console.log(`Investors: ${investors?.count || 0}`);
  console.log(`Total: ${(projects?.count || 0) + (news?.count || 0) + (investors?.count || 0)}`);
  
  // Analyze success rate
  console.log('\n' + '=' .repeat(60));
  if (result.successRate >= 80) {
    console.log('✅ EXCELLENT: 80%+ success rate achieved!');
  } else if (result.successRate >= 60) {
    console.log('✅ GOOD: 60%+ success rate achieved');
  } else if (result.successRate >= 40) {
    console.log('⚠️ IMPROVED: 40%+ success rate (2x better than before)');
  } else {
    console.log('❌ NEEDS MORE WORK: Still below 40% success rate');
  }
  
  return result.successRate;
}

testImprovedPipeline().then(rate => {
  console.log(`\n🏁 Final Success Rate: ${rate}%`);
  process.exit(rate >= 40 ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});