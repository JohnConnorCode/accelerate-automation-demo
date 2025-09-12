#!/usr/bin/env npx tsx

import { UnifiedOrchestrator } from '../src/core/unified-orchestrator';

async function testPipeline() {
  console.log('🚀 Testing complete pipeline with real database...\n');
  
  const orchestrator = new UnifiedOrchestrator();
  
  console.log('📊 Running pipeline...');
  const startTime = Date.now();
  
  try {
    const result = await orchestrator.run();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n✅ Pipeline completed in', duration, 'seconds');
    console.log('\n📈 Results:');
    console.log('   Fetched:', result.fetched);
    console.log('   Validated:', result.validated);
    console.log('   Scored:', result.scored);
    console.log('   Inserted:', result.inserted);
    console.log('   Errors:', result.errors);
    
    if (result.inserted > 0) {
      console.log('\n🎉 SUCCESS! Data is flowing through the pipeline!');
      console.log('   The database tables are working correctly.');
      console.log('   Upserts are functioning properly.');
    } else if (result.fetched > 0) {
      console.log('\n⚠️  Data fetched but nothing inserted.');
      console.log('   This could mean all items were duplicates.');
    } else {
      console.log('\n❌ No data fetched. Check data sources.');
    }
    
  } catch (error) {
    console.error('❌ Pipeline error:', error);
  }
  
  console.log('\n📊 Checking database status...');
  const status = await orchestrator.getStatus();
  console.log('   Health:', status.healthy ? '✅ Healthy' : '❌ Unhealthy');
  console.log('   Success Rate:', status.successRate + '%');
  console.log('   Queue Depth:', status.queueDepth);
  
  process.exit(0);
}

testPipeline().catch(console.error);