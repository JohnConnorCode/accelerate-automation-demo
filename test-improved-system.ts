#!/usr/bin/env tsx

/**
 * IMPROVED SYSTEM TEST - Validates all enhancements
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';

async function testImprovedSystem() {
  console.log('🚀 TESTING IMPROVED ACCELERATE SYSTEM');
  console.log('=' .repeat(60));
  
  const orchestrator = new SimpleOrchestrator();
  
  // Set reasonable limits for testing
  orchestrator.setBatchSize(30);
  orchestrator.setScoreThreshold(30);
  
  console.log('\n📡 Starting fetch from ALL sources...');
  const startTime = Date.now();
  
  try {
    const result = await orchestrator.run();
    const duration = (Date.now() - startTime) / 1000;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SYSTEM PERFORMANCE RESULTS:');
    console.log('=' .repeat(60));
    
    console.log(`\n✅ SUCCESSFULLY PROCESSED:`);
    console.log(`  📥 Fetched: ${result.fetched} items`);
    console.log(`  📊 Scored: ${result.scored} items`);
    console.log(`  💾 Stored: ${result.stored} items`);
    console.log(`  ❌ Rejected: ${result.rejected} items`);
    console.log(`  ⏱️ Duration: ${duration.toFixed(1)}s`);
    
    // Calculate success metrics
    const acceptanceRate = result.stored > 0 ? 
      ((result.stored / result.scored) * 100).toFixed(1) : 0;
    const processingSpeed = result.scored > 0 ? 
      (result.scored / duration).toFixed(1) : 0;
    
    console.log(`\n📈 QUALITY METRICS:`);
    console.log(`  🎯 Acceptance Rate: ${acceptanceRate}%`);
    console.log(`  ⚡ Processing Speed: ${processingSpeed} items/sec`);
    console.log(`  🏆 Quality Threshold: 30/100`);
    
    // Determine system status
    console.log(`\n🔥 SYSTEM STATUS:`);
    
    if (result.stored >= 20) {
      console.log('  ✅ ROCK SOLID - System is fetching high-quality data!');
    } else if (result.stored >= 10) {
      console.log('  🟡 FUNCTIONAL - System works but needs optimization');
    } else {
      console.log('  🔴 NEEDS WORK - Not enough quality content');
    }
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️ ERRORS ENCOUNTERED (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach(err => {
        console.log(`  - ${err.substring(0, 100)}`);
      });
    }
    
    // CRITICAL VALIDATION
    console.log(`\n🔍 CRITICAL VALIDATION:`);
    
    if (result.fetched === 0) {
      console.log('  ❌ FATAL: No data fetched at all!');
    } else if (result.stored === 0) {
      console.log('  ❌ FATAL: No data passed quality threshold!');
    } else if (acceptanceRate < 10) {
      console.log('  ⚠️ WARNING: Very low acceptance rate - check scoring');
    } else {
      console.log('  ✅ System is working correctly!');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST COMPLETE');
    
  } catch (error: any) {
    console.error('\n❌ CRITICAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testImprovedSystem().catch(console.error);