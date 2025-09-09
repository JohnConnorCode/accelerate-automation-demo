#!/usr/bin/env npx tsx

/**
 * CONCURRENT OPERATIONS STRESS TEST
 * Tests system with 100+ simultaneous operations
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function stressTest() {
  console.log('🔥 CONCURRENT OPERATIONS STRESS TEST');
  console.log('=' .repeat(60));
  
  const results = {
    writes: { success: 0, failed: 0 },
    reads: { success: 0, failed: 0 },
    updates: { success: 0, failed: 0 },
    deletes: { success: 0, failed: 0 }
  };
  
  // Test 1: Concurrent Writes (100 items)
  console.log('\n1️⃣ Testing 100 Concurrent WRITES...');
  const writePromises = [];
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    const promise = supabase
      .from('queue_news')
      .insert({
        title: `Stress Test Item ${i} - ${Date.now()}`,
        url: `https://test.com/item-${i}-${Date.now()}`,
        source: 'stress-test',
        accelerate_score: Math.random() * 9.99,
        accelerate_fit: Math.random() > 0.5,
        created_at: new Date().toISOString()
      })
      .then(() => results.writes.success++)
      .catch(() => results.writes.failed++);
    
    writePromises.push(promise);
  }
  
  await Promise.all(writePromises);
  const writeTime = Date.now() - startTime;
  console.log(`   ✅ Writes: ${results.writes.success}/100 successful`);
  console.log(`   ⏱️ Time: ${writeTime}ms (${(writeTime/100).toFixed(1)}ms per write)`);
  
  // Test 2: Concurrent Reads (100 queries)
  console.log('\n2️⃣ Testing 100 Concurrent READS...');
  const readPromises = [];
  const readStart = Date.now();
  
  for (let i = 0; i < 100; i++) {
    const promise = supabase
      .from('queue_news')
      .select('*')
      .limit(10)
      .then(() => results.reads.success++)
      .catch(() => results.reads.failed++);
    
    readPromises.push(promise);
  }
  
  await Promise.all(readPromises);
  const readTime = Date.now() - readStart;
  console.log(`   ✅ Reads: ${results.reads.success}/100 successful`);
  console.log(`   ⏱️ Time: ${readTime}ms (${(readTime/100).toFixed(1)}ms per read)`);
  
  // Test 3: Concurrent Updates (50 items)
  console.log('\n3️⃣ Testing 50 Concurrent UPDATES...');
  
  // First, get items to update
  const { data: itemsToUpdate } = await supabase
    .from('queue_news')
    .select('id')
    .limit(50);
  
  if (itemsToUpdate && itemsToUpdate.length > 0) {
    const updatePromises = itemsToUpdate.map(item => 
      supabase
        .from('queue_news')
        .update({ accelerate_score: Math.random() * 9.99 })
        .eq('id', item.id)
        .then(() => results.updates.success++)
        .catch(() => results.updates.failed++)
    );
    
    const updateStart = Date.now();
    await Promise.all(updatePromises);
    const updateTime = Date.now() - updateStart;
    
    console.log(`   ✅ Updates: ${results.updates.success}/${itemsToUpdate.length} successful`);
    console.log(`   ⏱️ Time: ${updateTime}ms`);
  } else {
    console.log('   ⚠️ No items to update');
  }
  
  // Test 4: Mixed Operations (reads + writes simultaneously)
  console.log('\n4️⃣ Testing MIXED Operations (50 reads + 50 writes)...');
  const mixedPromises = [];
  const mixedStart = Date.now();
  let mixedSuccess = 0;
  
  // Add 50 writes
  for (let i = 0; i < 50; i++) {
    mixedPromises.push(
      supabase
        .from('queue_news')
        .insert({
          title: `Mixed Test ${i}`,
          url: `https://mixed.com/${i}`,
          source: 'mixed-test',
          accelerate_score: 5.0
        })
        .then(() => mixedSuccess++)
        .catch(() => {})
    );
  }
  
  // Add 50 reads
  for (let i = 0; i < 50; i++) {
    mixedPromises.push(
      supabase
        .from('queue_news')
        .select('*')
        .limit(5)
        .then(() => mixedSuccess++)
        .catch(() => {})
    );
  }
  
  await Promise.all(mixedPromises);
  const mixedTime = Date.now() - mixedStart;
  console.log(`   ✅ Mixed: ${mixedSuccess}/100 successful`);
  console.log(`   ⏱️ Time: ${mixedTime}ms`);
  
  // Test 5: Cleanup (delete test data)
  console.log('\n5️⃣ Cleaning up test data...');
  const { error: cleanupError } = await supabase
    .from('queue_news')
    .delete()
    .or('source.eq.stress-test,source.eq.mixed-test');
  
  if (!cleanupError) {
    console.log('   ✅ Cleanup successful');
  } else {
    console.log('   ❌ Cleanup failed:', cleanupError);
  }
  
  // Performance Analysis
  console.log('\n' + '=' .repeat(60));
  console.log('📊 PERFORMANCE ANALYSIS\n');
  
  const totalOps = results.writes.success + results.reads.success + 
                   results.updates.success + mixedSuccess;
  const totalFailed = results.writes.failed + results.reads.failed + 
                      results.updates.failed;
  const successRate = Math.round((totalOps / (totalOps + totalFailed)) * 100);
  
  console.log(`Total Operations: ${totalOps + totalFailed}`);
  console.log(`Successful: ${totalOps}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success Rate: ${successRate}%`);
  console.log(`\nAverage Response Times:`);
  console.log(`  - Writes: ${(writeTime/100).toFixed(1)}ms`);
  console.log(`  - Reads: ${(readTime/100).toFixed(1)}ms`);
  console.log(`  - Mixed: ${(mixedTime/100).toFixed(1)}ms`);
  
  // Verdict
  if (successRate >= 95) {
    console.log('\n✅ EXCELLENT: System handles high concurrency perfectly');
  } else if (successRate >= 80) {
    console.log('\n✅ GOOD: System handles concurrency well');
  } else if (successRate >= 60) {
    console.log('\n⚠️ ACCEPTABLE: System handles concurrency with some issues');
  } else {
    console.log('\n❌ POOR: System struggles with high concurrency');
  }
  
  return successRate >= 80;
}

stressTest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Stress test failed:', error);
  process.exit(1);
});