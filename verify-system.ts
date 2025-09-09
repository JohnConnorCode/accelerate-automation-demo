#!/usr/bin/env tsx

/**
 * CRITICAL SYSTEM VERIFICATION
 * Let's see what ACTUALLY works
 */

import { supabase } from './src/lib/supabase-client';
import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { approvalService } from './src/api/approve';

async function verifyCriticalFunctions() {
  console.log('🔍 CRITICAL SYSTEM VERIFICATION\n');
  console.log('=' .repeat(60));
  
  // 1. CHECK WHAT'S IN THE DATABASE
  console.log('\n1️⃣ DATABASE CONTENT CHECK:');
  
  const { data: queueItems, error: queueError } = await supabase
    .from('content_queue')
    .select('id, type, title, source, metadata')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (queueError) {
    console.log('❌ Cannot read queue:', queueError.message);
    return;
  }
  
  // Analyze types
  const typeAnalysis: any = {
    project: 0,
    funding: 0,
    resource: 0,
    undefined: 0
  };
  
  queueItems?.forEach(item => {
    const type = item.type || 'undefined';
    typeAnalysis[type] = (typeAnalysis[type] || 0) + 1;
  });
  
  console.log('Content types in queue:');
  console.log('  Projects:', typeAnalysis.project);
  console.log('  Funding:', typeAnalysis.funding);
  console.log('  Resources:', typeAnalysis.resource);
  console.log('  Undefined:', typeAnalysis.undefined);
  
  // 2. CHECK FUNDING SPECIFICALLY
  console.log('\n2️⃣ FUNDING PROGRAMS CHECK:');
  
  const { data: fundingItems } = await supabase
    .from('content_queue')
    .select('*')
    .eq('type', 'funding')
    .limit(3);
  
  if (!fundingItems || fundingItems.length === 0) {
    console.log('❌ NO funding programs in database!');
    
    // Try to fetch one directly
    console.log('  Attempting to fetch funding programs...');
    const { ChainSpecificFetcher } = await import('./src/fetchers/funding/chain-specific');
    const fetcher = new ChainSpecificFetcher();
    const data = await fetcher.fetch();
    const items = fetcher.transform(data);
    console.log('  ✅ Can fetch', items.length, 'funding items');
    console.log('  ❌ But they are NOT reaching the database!');
  } else {
    console.log('✅ Found', fundingItems.length, 'funding programs');
    fundingItems.forEach(item => {
      console.log(`  - ${item.title}`);
      console.log(`    Metadata: ${Object.keys(item.metadata || {}).join(', ')}`);
    });
  }
  
  // 3. CHECK ENRICHMENT
  console.log('\n3️⃣ ENRICHMENT CHECK:');
  
  const { data: enrichedItems } = await supabase
    .from('content_queue')
    .select('title, enrichment_status, enrichment_data, ai_summary')
    .eq('enrichment_status', 'completed')
    .limit(3);
  
  if (!enrichedItems || enrichedItems.length === 0) {
    console.log('❌ NO enriched items found!');
    console.log('  Enrichment is NOT working or NOT storing results');
  } else {
    console.log('✅ Found', enrichedItems.length, 'enriched items');
    enrichedItems.forEach(item => {
      console.log(`  - ${item.title?.substring(0, 40)}...`);
      console.log(`    Has AI summary: ${!!item.ai_summary}`);
      console.log(`    Enrichment data: ${item.enrichment_data ? Object.keys(item.enrichment_data).length + ' fields' : 'EMPTY'}`);
    });
  }
  
  // 4. CHECK PRODUCTION TABLES
  console.log('\n4️⃣ PRODUCTION TABLES CHECK:');
  
  const tables = ['accelerate_startups', 'funding_programs', 'resources'];
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`✅ ${table}: ${count || 0} items`);
    }
  }
  
  // 5. TEST APPROVAL FLOW
  console.log('\n5️⃣ APPROVAL FLOW CHECK:');
  
  // Get a pending item
  const { data: pendingItem } = await supabase
    .from('content_queue')
    .select('id, title, type')
    .eq('status', 'pending_review')
    .limit(1)
    .single();
  
  if (!pendingItem) {
    console.log('❌ No pending items to test approval');
  } else {
    console.log(`Testing approval for: ${pendingItem.title}`);
    
    // Check if production table exists
    const targetTable = pendingItem.type === 'funding' ? 'funding_programs' : 
                       pendingItem.type === 'resource' ? 'resources' : 
                       'accelerate_startups';
    
    const { error: tableError } = await supabase
      .from(targetTable)
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.log(`❌ Cannot approve - table ${targetTable} doesn't exist`);
      console.log('  Need to run create-production-tables.sql first!');
    } else {
      console.log(`✅ Target table ${targetTable} exists`);
    }
  }
  
  // FINAL VERDICT
  console.log('\n' + '=' .repeat(60));
  console.log('🎯 CRITICAL ISSUES:\n');
  
  const issues = [];
  
  if (typeAnalysis.funding === 0) {
    issues.push('❌ Funding programs NOT reaching database');
  }
  if (typeAnalysis.undefined > 0) {
    issues.push('❌ Some items have undefined type');
  }
  if (!enrichedItems || enrichedItems.length === 0) {
    issues.push('❌ Enrichment NOT working');
  }
  
  // Check if production tables exist
  let tablesExist = true;
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      tablesExist = false;
      break;
    }
  }
  if (!tablesExist) {
    issues.push('❌ Production tables NOT created');
  }
  
  if (issues.length === 0) {
    console.log('✅ SYSTEM IS ACTUALLY WORKING END-TO-END!');
  } else {
    console.log('SYSTEM IS NOT FULLY FUNCTIONAL:');
    issues.forEach(issue => console.log('  ' + issue));
    
    console.log('\n📝 TO FIX:');
    if (typeAnalysis.funding === 0) {
      console.log('  1. Debug why funding items are filtered out');
      console.log('     - Check scoring threshold');
      console.log('     - Check per-source limits');
    }
    if (!tablesExist) {
      console.log('  2. Run create-production-tables.sql in Supabase');
    }
    if (!enrichedItems || enrichedItems.length === 0) {
      console.log('  3. Enrichment needs OpenAI API key');
    }
  }
  
  // Calculate actual completion
  const checks = {
    'Projects stored': typeAnalysis.project > 0,
    'Funding stored': typeAnalysis.funding > 0,
    'Resources stored': typeAnalysis.resource > 0,
    'No undefined types': typeAnalysis.undefined === 0,
    'Enrichment works': enrichedItems && enrichedItems.length > 0,
    'Production tables exist': tablesExist
  };
  
  const passed = Object.values(checks).filter(v => v).length;
  const total = Object.keys(checks).length;
  const percentage = Math.round((passed / total) * 100);
  
  console.log('\n📊 ACTUAL SYSTEM COMPLETION: ' + percentage + '%');
  
  if (percentage < 100) {
    console.log('\n⚠️ SYSTEM IS NOT 100% FUNCTIONAL');
    console.log('Missing components:');
    Object.entries(checks).forEach(([check, passing]) => {
      if (!passing) console.log('  - ' + check);
    });
  }
}

verifyCriticalFunctions().catch(console.error);