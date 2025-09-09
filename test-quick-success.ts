#!/usr/bin/env npx tsx

import { SimpleOrchestrator } from './src/core/simple-orchestrator';

async function quickTest() {
  console.log('🚀 QUICK SUCCESS RATE TEST\n');
  
  const orchestrator = new SimpleOrchestrator();
  const result = await orchestrator.run();
  
  console.log('\n📊 RESULTS:');
  console.log(`Fetched: ${result.fetched}`);
  console.log(`Scored: ${result.scored}`);
  console.log(`Stored: ${result.stored}`);
  console.log(`SUCCESS RATE: ${result.successRate}%`);
  
  if (result.successRate >= 80) {
    console.log('✅ 80%+ ACHIEVED!');
  } else if (result.successRate >= 60) {
    console.log('✅ 60%+ success');
  } else {
    console.log(`❌ Only ${result.successRate}%`);
  }
  
  return result.successRate;
}

quickTest().then(rate => {
  process.exit(rate >= 60 ? 0 : 1);
}).catch(console.error);