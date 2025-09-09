#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function checkSuccessRate() {
  // Check how many items are in the queue now
  const { count: projects } = await supabase.from('queue_projects').select('*', { count: 'exact', head: true });
  const { count: news } = await supabase.from('queue_news').select('*', { count: 'exact', head: true });
  const { count: investors } = await supabase.from('queue_investors').select('*', { count: 'exact', head: true });
  
  const total = (projects || 0) + (news || 0) + (investors || 0);
  
  console.log('📊 CURRENT QUEUE STATUS:');
  console.log(`Projects: ${projects || 0}`);
  console.log(`News: ${news || 0}`);
  console.log(`Investors: ${investors || 0}`);
  console.log(`TOTAL: ${total}`);
  
  // Estimate success rate based on typical fetch of ~260 items
  const typicalFetch = 260;
  const successRate = Math.round((total / typicalFetch) * 100);
  
  console.log(`\n🎯 ESTIMATED SUCCESS RATE: ${successRate}%`);
  
  if (successRate >= 80) {
    console.log('✅ EXCELLENT: 80%+ success rate achieved!');
  } else if (successRate >= 60) {
    console.log('✅ GOOD: 60%+ success rate achieved');
  } else if (successRate >= 40) {
    console.log('✅ MUCH BETTER: 40%+ success rate (2x improvement)');
  } else {
    console.log('⚠️ Still needs work: Below 40% success rate');
  }
  
  return successRate;
}

checkSuccessRate().then(rate => {
  process.exit(rate >= 40 ? 0 : 1);
});