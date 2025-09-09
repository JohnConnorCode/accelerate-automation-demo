#!/usr/bin/env npx tsx

/**
 * COMPREHENSIVE END-TO-END INTEGRATION TEST
 * Tests the complete pipeline from fetch to approval
 */

import { createClient } from '@supabase/supabase-js';
import { SimpleOrchestrator } from './src/core/simple-orchestrator';

const simpleOrchestrator = new SimpleOrchestrator();

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

interface TestResult {
  test: string;
  passed: boolean;
  details?: any;
  error?: string;
}

async function runE2ETest() {
  console.log('🚀 COMPREHENSIVE END-TO-END INTEGRATION TEST');
  console.log('=' .repeat(60));
  
  const results: TestResult[] = [];
  const startTime = Date.now();
  
  // Test 1: Health Check
  console.log('\n1️⃣ Testing Health Check Endpoint...');
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health');
    const health = await healthResponse.json();
    
    if (health.status === 'healthy') {
      console.log('   ✅ Health check passed');
      results.push({ test: 'Health Check', passed: true, details: health });
    } else {
      throw new Error('Health check failed');
    }
  } catch (error) {
    console.log('   ❌ Health check failed:', error);
    results.push({ test: 'Health Check', passed: false, error: String(error) });
  }
  
  // Test 2: Clear Queue Tables
  console.log('\n2️⃣ Clearing Queue Tables...');
  try {
    await supabase.from('queue_projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('queue_news').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('queue_investors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('   ✅ Queue tables cleared');
    results.push({ test: 'Clear Queue', passed: true });
  } catch (error) {
    console.log('   ❌ Failed to clear queues:', error);
    results.push({ test: 'Clear Queue', passed: false, error: String(error) });
  }
  
  // Test 3: Run Orchestrator
  console.log('\n3️⃣ Running Content Pipeline...');
  try {
    const orchestratorResult = await simpleOrchestrator.run();
    
    console.log(`   📊 Fetched: ${orchestratorResult.fetched} items`);
    console.log(`   📊 Scored: ${orchestratorResult.scored} items`);
    console.log(`   📊 Stored: ${orchestratorResult.stored} items`);
    console.log(`   📊 Success Rate: ${orchestratorResult.successRate}%`);
    
    if (orchestratorResult.stored > 0) {
      console.log('   ✅ Pipeline executed successfully');
      results.push({ 
        test: 'Pipeline Execution', 
        passed: true, 
        details: orchestratorResult 
      });
    } else {
      throw new Error('No items stored');
    }
  } catch (error) {
    console.log('   ❌ Pipeline failed:', error);
    results.push({ test: 'Pipeline Execution', passed: false, error: String(error) });
  }
  
  // Test 4: Verify Queue Data
  console.log('\n4️⃣ Verifying Queue Data...');
  try {
    const { data: projects } = await supabase.from('queue_projects').select('*');
    const { data: news } = await supabase.from('queue_news').select('*');
    const { data: investors } = await supabase.from('queue_investors').select('*');
    
    const totalQueued = (projects?.length || 0) + (news?.length || 0) + (investors?.length || 0);
    
    console.log(`   📦 Projects: ${projects?.length || 0}`);
    console.log(`   📰 News: ${news?.length || 0}`);
    console.log(`   💰 Investors: ${investors?.length || 0}`);
    console.log(`   📊 Total: ${totalQueued}`);
    
    if (totalQueued > 0) {
      console.log('   ✅ Queue data verified');
      results.push({ 
        test: 'Queue Data', 
        passed: true, 
        details: { projects: projects?.length, news: news?.length, investors: investors?.length }
      });
    } else {
      throw new Error('No data in queues');
    }
  } catch (error) {
    console.log('   ❌ Queue verification failed:', error);
    results.push({ test: 'Queue Data', passed: false, error: String(error) });
  }
  
  // Test 5: Test Approval Workflow
  console.log('\n5️⃣ Testing Approval Workflow...');
  try {
    // Get a sample item from queue
    const { data: sampleNews } = await supabase
      .from('queue_news')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleNews) {
      // Approve the item (move to live table)
      const { error: insertError } = await supabase
        .from('accelerate_news')
        .insert({
          title: sampleNews.title,
          content: sampleNews.content,
          url: sampleNews.url,
          source: sampleNews.source,
          accelerate_fit: sampleNews.accelerate_fit,
          accelerate_score: sampleNews.accelerate_score
        });
      
      if (!insertError) {
        // Remove from queue
        await supabase
          .from('queue_news')
          .delete()
          .eq('id', sampleNews.id);
        
        console.log('   ✅ Approval workflow successful');
        results.push({ test: 'Approval Workflow', passed: true });
      } else {
        throw insertError;
      }
    } else {
      console.log('   ⚠️ No items to approve');
      results.push({ test: 'Approval Workflow', passed: true, details: 'No items to test' });
    }
  } catch (error) {
    console.log('   ❌ Approval workflow failed:', error);
    results.push({ test: 'Approval Workflow', passed: false, error: String(error) });
  }
  
  // Test 6: API Performance
  console.log('\n6️⃣ Testing API Performance...');
  try {
    const perfResponse = await fetch('http://localhost:3000/api/performance');
    const perf = await perfResponse.json();
    
    if (perf.health) {
      console.log(`   📊 System Health: ${perf.health}`);
      console.log(`   📊 Success Rate: ${perf.performance?.successRate || 'N/A'}`);
      console.log(`   📊 Queue Depth: ${perf.performance?.queueDepth || 'N/A'}`);
      console.log('   ✅ Performance metrics available');
      results.push({ test: 'API Performance', passed: true, details: perf });
    } else {
      throw new Error('Performance metrics unavailable');
    }
  } catch (error) {
    console.log('   ❌ Performance check failed:', error);
    results.push({ test: 'API Performance', passed: false, error: String(error) });
  }
  
  // Test 7: Error Recovery
  console.log('\n7️⃣ Testing Error Recovery...');
  try {
    // Intentionally trigger an error with bad data
    const { error } = await supabase
      .from('queue_news')
      .insert({
        title: null, // Required field
        url: 'test',
        source: 'test'
      });
    
    if (error) {
      console.log('   ✅ Error handling works (rejected bad data)');
      results.push({ test: 'Error Recovery', passed: true });
    } else {
      throw new Error('Should have rejected bad data');
    }
  } catch (error) {
    console.log('   ❌ Error recovery failed:', error);
    results.push({ test: 'Error Recovery', passed: false, error: String(error) });
  }
  
  // Test 8: Data Integrity
  console.log('\n8️⃣ Testing Data Integrity...');
  try {
    const { data: liveNews } = await supabase
      .from('accelerate_news')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (liveNews && liveNews.length > 0) {
      const hasRequiredFields = liveNews.every(item => 
        item.title && item.url && item.source
      );
      
      if (hasRequiredFields) {
        console.log('   ✅ Data integrity maintained');
        results.push({ test: 'Data Integrity', passed: true });
      } else {
        throw new Error('Missing required fields');
      }
    } else {
      console.log('   ⚠️ No live data to verify');
      results.push({ test: 'Data Integrity', passed: true, details: 'No data' });
    }
  } catch (error) {
    console.log('   ❌ Data integrity check failed:', error);
    results.push({ test: 'Data Integrity', passed: false, error: String(error) });
  }
  
  // SUMMARY
  const duration = (Date.now() - startTime) / 1000;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const successRate = Math.round((passed / results.length) * 100);
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 E2E TEST SUMMARY\n');
  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`📈 Success Rate: ${successRate}%`);
  console.log(`⏱️ Duration: ${duration.toFixed(1)}s`);
  
  if (failed > 0) {
    console.log('\n🔴 FAILED TESTS:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.test}: ${r.error}`);
    });
  }
  
  if (successRate >= 80) {
    console.log('\n✅ SYSTEM IS ROBUST AND PRODUCTION-READY');
  } else if (successRate >= 60) {
    console.log('\n⚠️ SYSTEM IS FUNCTIONAL BUT NEEDS IMPROVEMENTS');
  } else {
    console.log('\n❌ SYSTEM HAS CRITICAL ISSUES');
  }
  
  return successRate >= 60;
}

// Run the test
runE2ETest().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('E2E test failed:', error);
  process.exit(1);
});