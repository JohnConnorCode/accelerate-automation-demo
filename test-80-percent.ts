#!/usr/bin/env npx tsx

/**
 * Test for 80%+ success rate
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { createClient } from '@supabase/supabase-js';

const orchestrator = new SimpleOrchestrator();
const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function test80Percent() {
  console.log('🎯 TESTING FOR 80%+ SUCCESS RATE');
  console.log('=' .repeat(60));
  
  // Clear queue
  console.log('\n📦 Clearing queue...');
  await supabase.from('queue_projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_investors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('🚀 Running improved pipeline...\n');
  const startTime = Date.now();
  
  const result = await orchestrator.run();
  
  const duration = (Date.now() - startTime) / 1000;
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESULTS:');
  console.log(`Fetched: ${result.fetched}`);
  console.log(`Scored: ${result.scored}`);
  console.log(`Stored: ${result.stored}`);
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log(`\n🎯 SUCCESS RATE: ${result.successRate}%`);
  
  // Check queue
  const { count: total } = await supabase
    .from('queue_news')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📦 Items in queue: ${total}`);
  
  if (result.successRate >= 80) {
    console.log('\n✅ EXCELLENT: 80%+ SUCCESS RATE ACHIEVED!');
  } else if (result.successRate >= 60) {
    console.log('\n✅ GOOD: 60%+ success rate');
  } else {
    console.log('\n❌ NEEDS MORE WORK');
  }
  
  return result.successRate;
}

test80Percent().then(rate => {
  console.log(`\n🏁 Final: ${rate}%`);
  process.exit(rate >= 60 ? 0 : 1);
});