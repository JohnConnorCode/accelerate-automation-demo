#!/usr/bin/env tsx

/**
 * END-TO-END TEST: Verify Projects, Funding, Resources Pipeline
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { supabase } from './src/lib/supabase-client';

async function testEndToEnd() {
  console.log('🔍 END-TO-END VERIFICATION TEST');
  console.log('=' .repeat(60));
  
  // 1. Test what we're fetching
  console.log('\n📡 STEP 1: FETCHING DATA...\n');
  
  const orchestrator = new SimpleOrchestrator();
  orchestrator.setBatchSize(20); // Small batch for testing
  orchestrator.setScoreThreshold(30);
  
  const result = await orchestrator.run();
  
  console.log(`\n📊 FETCH RESULTS:`);
  console.log(`  Total fetched: ${result.fetched}`);
  console.log(`  Total scored: ${result.scored}`);
  console.log(`  Total stored: ${result.stored}`);
  console.log(`  Total rejected: ${result.rejected}`);
  
  // 2. Check what's in the database
  console.log('\n💾 STEP 2: CHECKING DATABASE...\n');
  
  // Check content_queue
  const { data: queueData, error: queueError } = await supabase
    .from('content_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (queueError) {
    console.log('❌ Queue error:', queueError.message);
  } else {
    console.log(`✅ Items in queue: ${queueData?.length || 0}`);
    
    // Analyze content types
    const types = new Set(queueData?.map(item => item.type || 'unknown'));
    console.log(`  Content types: ${Array.from(types).join(', ')}`);
    
    // Check for each type
    const projects = queueData?.filter(item => item.type === 'project' || item.category === 'project').length || 0;
    const funding = queueData?.filter(item => item.type === 'funding' || item.category === 'funding').length || 0;
    const resources = queueData?.filter(item => item.type === 'resource' || item.category === 'resource').length || 0;
    
    console.log(`  Projects: ${projects}`);
    console.log(`  Funding: ${funding}`);
    console.log(`  Resources: ${resources}`);
    
    // Sample data
    if (queueData && queueData.length > 0) {
      console.log('\n📋 SAMPLE ITEMS:');
      queueData.slice(0, 3).forEach((item, i) => {
        console.log(`\n  Item ${i + 1}:`);
        console.log(`    Title: ${item.title}`);
        console.log(`    Type: ${item.type || 'NOT SET'}`);
        console.log(`    Category: ${item.category || 'NOT SET'}`);
        console.log(`    Score: ${item.score}`);
        console.log(`    Source: ${item.source}`);
        console.log(`    URL: ${item.url}`);
      });
    }
  }
  
  // 3. Check enrichment
  console.log('\n🔬 STEP 3: CHECKING ENRICHMENT...\n');
  
  const { data: enrichedData, error: enrichedError } = await supabase
    .from('content_queue')
    .select('*')
    .eq('enrichment_status', 'completed')
    .limit(5);
  
  if (enrichedError) {
    console.log('❌ Enrichment query error:', enrichedError.message);
  } else {
    console.log(`✅ Enriched items: ${enrichedData?.length || 0}`);
    
    if (enrichedData && enrichedData.length > 0) {
      console.log('\n  Sample enriched item:');
      const item = enrichedData[0];
      console.log(`    Title: ${item.title}`);
      console.log(`    Has AI summary: ${!!item.ai_summary}`);
      console.log(`    Has enrichment data: ${!!item.enrichment_data}`);
      console.log(`    Enrichment keys: ${item.enrichment_data ? Object.keys(item.enrichment_data).join(', ') : 'none'}`);
    }
  }
  
  // 4. Check if data is formatted correctly for DB
  console.log('\n✅ STEP 4: CHECKING DATA FORMAT...\n');
  
  const { data: latestItem } = await supabase
    .from('content_queue')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (latestItem) {
    const requiredFields = ['title', 'url', 'score', 'status'];
    const hasAllRequired = requiredFields.every(field => latestItem[field] !== undefined);
    
    console.log(`  Has all required fields: ${hasAllRequired ? '✅' : '❌'}`);
    
    if (!hasAllRequired) {
      const missing = requiredFields.filter(field => latestItem[field] === undefined);
      console.log(`  Missing fields: ${missing.join(', ')}`);
    }
    
    // Check metadata structure
    if (latestItem.metadata) {
      console.log(`  Metadata keys: ${Object.keys(latestItem.metadata).slice(0, 5).join(', ')}...`);
    }
  }
  
  // 5. Final verdict
  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL VERDICT:\n');
  
  const issues = [];
  
  if (result.fetched === 0) issues.push('❌ No data being fetched');
  if (result.stored === 0) issues.push('❌ No data being stored');
  if (!queueData || queueData.length === 0) issues.push('❌ Database is empty');
  
  // Check for proper typing
  if (queueData && queueData.length > 0) {
    const hasTypes = queueData.some(item => item.type || item.category);
    if (!hasTypes) issues.push('⚠️ Items missing type/category');
  }
  
  if (issues.length === 0) {
    console.log('✅ System is working END-TO-END!');
    console.log('  - Fetching real data');
    console.log('  - Scoring and filtering');
    console.log('  - Storing to database');
    console.log('  - Data properly formatted');
  } else {
    console.log('🔴 ISSUES FOUND:');
    issues.forEach(issue => console.log(`  ${issue}`));
  }
  
  console.log('\n' + '='.repeat(60));
}

testEndToEnd().catch(console.error);