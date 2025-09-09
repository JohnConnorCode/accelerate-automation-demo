#!/usr/bin/env npx tsx

/**
 * Test the complete staging table integration
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { approvalServiceV2 } from './src/api/approve-v2';
import { supabase } from './src/lib/supabase-client';

async function testStagingIntegration() {
  console.log('🧪 TESTING STAGING TABLE INTEGRATION\n');
  console.log('='.repeat(60));
  
  // Step 1: Check initial state
  console.log('\n📊 STEP 1: Initial State\n');
  
  const tables = [
    'queued_projects',
    'queued_funding_programs', 
    'queued_resources',
    'projects',
    'funding_programs',
    'resources'
  ];
  
  const initialCounts: Record<string, number> = {};
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    initialCounts[table] = count || 0;
    console.log(`${table.padEnd(25)}: ${count || 0} items`);
  }
  
  // Step 2: Run orchestrator to fetch and stage content
  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 STEP 2: Running Orchestrator\n');
  
  const orchestrator = new SimpleOrchestrator();
  orchestrator.setBatchSize(10); // Small batch for testing
  orchestrator.setScoreThreshold(20);
  
  const result = await orchestrator.run();
  
  console.log('\nOrchestration Results:');
  console.log(`  Fetched: ${result.fetched}`);
  console.log(`  Scored: ${result.scored}`);
  console.log(`  Stored: ${result.stored}`);
  console.log(`  Errors: ${result.errors.length}`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors encountered:');
    result.errors.slice(0, 3).forEach(err => 
      console.log(`  - ${err.substring(0, 100)}`));
  }
  
  // Step 3: Check staging tables
  console.log('\n' + '='.repeat(60));
  console.log('\n📦 STEP 3: Checking Staging Tables\n');
  
  const stagingTables = ['queued_projects', 'queued_funding_programs', 'queued_resources'];
  let totalStaged = 0;
  
  for (const table of stagingTables) {
    const { data, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .eq('status', 'pending_review')
      .limit(3);
    
    const newItems = (count || 0) - initialCounts[table];
    totalStaged += newItems;
    
    console.log(`\n${table}:`);
    console.log(`  Total: ${count || 0} (${newItems > 0 ? '+' + newItems : newItems} new)`);
    
    if (data && data.length > 0) {
      console.log('  Sample items:');
      data.slice(0, 2).forEach(item => {
        const title = item.title || item.name || 'Untitled';
        console.log(`    - ${title.substring(0, 50)}... (score: ${item.score})`);
      });
    }
  }
  
  // Step 4: Test approval workflow
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ STEP 4: Testing Approval Workflow\n');
  
  // Get pending items
  const pending = await approvalServiceV2.getPendingItems();
  console.log(`Found ${pending.total} items pending approval:`);
  console.log(`  - Projects: ${pending.projects.length}`);
  console.log(`  - Funding: ${pending.funding.length}`);
  console.log(`  - Resources: ${pending.resources.length}`);
  
  // Try to approve one of each type
  const toApprove = [];
  
  if (pending.projects.length > 0) {
    toApprove.push({ id: pending.projects[0].id, type: 'project' as const });
    console.log(`\n🔄 Approving project: "${pending.projects[0].name}"`);
  }
  
  if (pending.funding.length > 0) {
    toApprove.push({ id: pending.funding[0].id, type: 'funding' as const });
    console.log(`🔄 Approving funding: "${pending.funding[0].name}"`);
  }
  
  if (pending.resources.length > 0) {
    toApprove.push({ id: pending.resources[0].id, type: 'resource' as const });
    console.log(`🔄 Approving resource: "${pending.resources[0].title}"`);
  }
  
  if (toApprove.length > 0) {
    const approvalResult = await approvalServiceV2.bulkApprove(toApprove, 'test-script');
    console.log(`\nApproval result: ${approvalResult.message}`);
  } else {
    console.log('\n⚠️  No items to approve');
  }
  
  // Step 5: Final verification
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 STEP 5: Final Verification\n');
  
  const finalCounts: Record<string, number> = {};
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    finalCounts[table] = count || 0;
    const diff = finalCounts[table] - initialCounts[table];
    console.log(`${table.padEnd(25)}: ${count || 0} (${diff > 0 ? '+' + diff : diff})`);
  }
  
  // Calculate success
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 INTEGRATION TEST RESULTS\n');
  
  const checks = [
    {
      name: 'Content fetched',
      passed: result.fetched > 0,
      value: result.fetched
    },
    {
      name: 'Content scored',
      passed: result.scored > 0,
      value: result.scored
    },
    {
      name: 'Staged to queued_* tables',
      passed: totalStaged > 0,
      value: totalStaged
    },
    {
      name: 'Approval workflow works',
      passed: toApprove.length > 0,
      value: toApprove.length
    },
    {
      name: 'Production tables updated',
      passed: (finalCounts.projects + finalCounts.funding_programs + finalCounts.resources) > 
              (initialCounts.projects + initialCounts.funding_programs + initialCounts.resources),
      value: 'Yes'
    }
  ];
  
  checks.forEach(check => {
    console.log(`${check.passed ? '✅' : '❌'} ${check.name}: ${check.value}`);
  });
  
  const passed = checks.filter(c => c.passed).length;
  const percentage = Math.round((passed / checks.length) * 100);
  
  console.log('\n' + '='.repeat(60));
  console.log(`🎯 INTEGRATION STATUS: ${percentage}%`);
  
  if (percentage === 100) {
    console.log('🎉 PERFECT! Staging tables fully integrated!');
  } else if (percentage >= 80) {
    console.log('✅ GOOD! Most components integrated.');
  } else if (percentage >= 60) {
    console.log('⚠️  PARTIAL: Some integration issues.');
  } else {
    console.log('❌ FAILED: Major integration problems.');
  }
  
  // Specific diagnostics
  if (totalStaged === 0) {
    console.log('\n⚠️  ISSUE: Content not reaching staging tables');
    console.log('  - Check staging service implementation');
    console.log('  - Verify orchestrator integration');
  }
  
  if (result.stored === 0 && totalStaged === 0) {
    console.log('\n❌ CRITICAL: No content stored anywhere!');
    console.log('  - Check database constraints');
    console.log('  - Verify staging table schema');
  }
}

testStagingIntegration().catch(console.error);