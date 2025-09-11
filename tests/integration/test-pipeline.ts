/**
 * End-to-end pipeline test
 * Tests the complete flow from fetch to database insertion
 */

import 'dotenv/config';
import { UnifiedOrchestrator } from './src/core/unified-orchestrator';

async function testPipeline() {
  console.log('🚀 ACCELERATE Pipeline Test');
  console.log('=' .repeat(50));
  
  const orchestrator = new UnifiedOrchestrator();
  
  console.log('\nStarting pipeline test...');
  const startTime = Date.now();
  
  try {
    const result = await orchestrator.run();
    
    console.log('\n' + '=' .repeat(50));
    console.log('📊 PIPELINE RESULTS:');
    console.log('=' .repeat(50));
    
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log('');
    console.log('Pipeline stages:');
    console.log(`  1. Fetched: ${result.fetched} items`);
    console.log(`  2. Validated: ${result.validated} items (${((result.validated/result.fetched)*100).toFixed(1)}%)`);
    console.log(`  3. Unique: ${result.unique} items (${result.validated - result.unique} duplicates)`);
    console.log(`  4. Inserted: ${result.inserted} items`);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Calculate success rate
    const successRate = result.fetched > 0 
      ? ((result.inserted / result.fetched) * 100).toFixed(1)
      : 0;
    
    console.log('\n' + '=' .repeat(50));
    console.log(`📈 SUCCESS RATE: ${successRate}%`);
    console.log('=' .repeat(50));
    
    // Determine overall health
    if (parseFloat(successRate as string) >= 10) {
      console.log('\n✅ Pipeline is HEALTHY');
    } else if (parseFloat(successRate as string) >= 5) {
      console.log('\n⚠️ Pipeline is DEGRADED');
    } else {
      console.log('\n❌ Pipeline is FAILING');
    }
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nTotal test time: ${totalTime}s`);
  
  process.exit(0);
}

// Run test
testPipeline();