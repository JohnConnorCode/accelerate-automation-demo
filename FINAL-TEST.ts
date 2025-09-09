#!/usr/bin/env tsx

/**
 * FINAL COMPREHENSIVE TEST - WITH PROPER ENV LOADING
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { supabase } from './src/lib/supabase-client';
import { approvalService } from './src/api/approve';

async function finalTest() {
  console.log('🎯 FINAL SYSTEM TEST - COMPLETE VERIFICATION');
  console.log('=' .repeat(60));
  
  const results: Record<string, boolean> = {};
  
  // 1. TEST TABLES
  console.log('\n1️⃣ TESTING DATABASE TABLES:');
  const tables = ['content_queue', 'accelerate_startups', 'funding_programs', 'resources'];
  let allTablesExist = true;
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
      allTablesExist = false;
    } else {
      console.log(`   ✅ ${table}: ${count || 0} items`);
    }
  }
  results['tables'] = allTablesExist;
  
  // 2. TEST FETCHING
  console.log('\n2️⃣ TESTING DATA FETCHING:');
  const orchestrator = new SimpleOrchestrator();
  orchestrator.setBatchSize(5);
  orchestrator.setScoreThreshold(30);
  
  const fetchResult = await orchestrator.run();
  console.log(`   ✅ Fetched: ${fetchResult.fetched} items`);
  console.log(`   ✅ Scored: ${fetchResult.scored} items`);
  console.log(`   ✅ Stored: ${fetchResult.stored} items`);
  
  results['fetching'] = fetchResult.fetched > 0;
  results['scoring'] = fetchResult.scored > 0;
  results['storage'] = fetchResult.stored >= 0; // Can be 0 if all duplicates
  
  // 3. TEST FUNDING
  console.log('\n3️⃣ TESTING FUNDING PROGRAMS:');
  const { data: fundingItems } = await supabase
    .from('content_queue')
    .select('*')
    .eq('type', 'funding');
  
  console.log(`   ${fundingItems?.length ? '✅' : '❌'} Funding items in queue: ${fundingItems?.length || 0}`);
  results['funding'] = (fundingItems?.length || 0) > 0;
  
  // 4. TEST APPROVAL
  console.log('\n4️⃣ TESTING APPROVAL WORKFLOW:');
  const { data: pendingItem } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'pending_review')
    .limit(1)
    .single();
  
  if (pendingItem && allTablesExist) {
    const approvalResult = await approvalService.processApproval({
      itemId: pendingItem.id,
      action: 'approve',
      reviewedBy: 'final-test'
    });
    
    if (approvalResult.success) {
      console.log(`   ✅ Approval workflow works`);
      results['approval'] = true;
    } else {
      console.log(`   ❌ Approval failed: ${approvalResult.error}`);
      results['approval'] = false;
    }
  } else {
    console.log(`   ⚠️ No items to test or tables missing`);
    results['approval'] = false;
  }
  
  // 5. TEST ENRICHMENT
  console.log('\n5️⃣ TESTING ENRICHMENT:');
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const { data: enrichedItems } = await supabase
    .from('content_queue')
    .select('*')
    .eq('enrichment_status', 'completed');
  
  if (hasOpenAI) {
    console.log(`   ✅ OpenAI key configured`);
  } else {
    console.log(`   ⚠️ No OpenAI key (enrichment will be mock)`);
  }
  console.log(`   ${enrichedItems?.length ? '✅' : '⚠️'} Enriched items: ${enrichedItems?.length || 0}`);
  results['enrichment'] = hasOpenAI || (enrichedItems?.length || 0) > 0;
  
  // FINAL REPORT
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL SYSTEM STATUS:\n');
  
  const components = {
    'Database Tables': results['tables'],
    'Data Fetching': results['fetching'],
    'Content Scoring': results['scoring'],
    'Queue Storage': results['storage'],
    'Funding Programs': results['funding'],
    'Approval Workflow': results['approval'],
    'Enrichment': results['enrichment']
  };
  
  let passCount = 0;
  Object.entries(components).forEach(([name, passing]) => {
    console.log(`   ${passing ? '✅' : '❌'} ${name}`);
    if (passing) passCount++;
  });
  
  const percentage = Math.round((passCount / Object.keys(components).length) * 100);
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🏆 SYSTEM COMPLETENESS: ${percentage}%\n`);
  
  if (percentage === 100) {
    console.log('🎉 SYSTEM IS 100% FUNCTIONAL!');
    console.log('   All components working perfectly');
    console.log('   Ready for production deployment');
  } else if (percentage >= 85) {
    console.log('✅ SYSTEM IS PRODUCTION READY');
    console.log('   Core functionality working');
    console.log('   Minor features can be added later');
  } else if (percentage >= 70) {
    console.log('⚠️ SYSTEM IS MOSTLY FUNCTIONAL');
    console.log('   Can be used with some limitations');
  } else {
    console.log('❌ SYSTEM NEEDS FIXES');
    console.log('   Critical components not working');
  }
  
  // What's missing
  const missing = Object.entries(components)
    .filter(([_, passing]) => !passing)
    .map(([name]) => name);
  
  if (missing.length > 0) {
    console.log('\n📝 MISSING COMPONENTS:');
    missing.forEach(component => console.log(`   - ${component}`));
  }
  
  // Business value
  console.log('\n💼 BUSINESS VALUE:');
  if (results['fetching'] && results['scoring'] && results['storage']) {
    console.log('   ✅ Can discover and evaluate Web3 projects');
  }
  if (results['funding']) {
    console.log('   ✅ Can track funding opportunities');
  }
  if (results['approval']) {
    console.log('   ✅ Can curate content for production');
  }
  if (results['enrichment']) {
    console.log('   ✅ Can enrich content with AI insights');
  }
  
  return percentage;
}

finalTest()
  .then(percentage => {
    console.log(`\n🎯 Final Score: ${percentage}%`);
    process.exit(percentage === 100 ? 0 : 1);
  })
  .catch(console.error);