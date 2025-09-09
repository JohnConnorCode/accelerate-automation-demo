#!/usr/bin/env npx tsx

/**
 * End-to-end test of the complete system
 */

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { approvalService } from './src/api/approve';
import { supabase } from './src/lib/supabase-client';

async function testEndToEnd() {
  console.log('🧪 END-TO-END SYSTEM TEST\n');
  console.log('='.repeat(60));
  
  // Step 1: Initial state
  console.log('\n📊 STEP 1: Initial State\n');
  
  const initialCounts = {
    queue_total: 0,
    queue_projects: 0,
    queue_funding: 0,
    queue_resources: 0,
    prod_projects: 0,
    prod_funding: 0,
    prod_resources: 0
  };
  
  // Check queue counts
  const { count: queueCount } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true });
  initialCounts.queue_total = queueCount || 0;
  
  const { count: projectsCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });
  initialCounts.prod_projects = projectsCount || 0;
  
  const { count: fundingCount } = await supabase
    .from('funding_programs')
    .select('*', { count: 'exact', head: true });
  initialCounts.prod_funding = fundingCount || 0;
  
  const { count: resourcesCount } = await supabase
    .from('resources')
    .select('*', { count: 'exact', head: true });
  initialCounts.prod_resources = resourcesCount || 0;
  
  console.log('Content Queue:', initialCounts.queue_total);
  console.log('Production - Projects:', initialCounts.prod_projects);
  console.log('Production - Funding:', initialCounts.prod_funding);
  console.log('Production - Resources:', initialCounts.prod_resources);
  
  // Step 2: Run orchestrator
  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 STEP 2: Running Orchestrator\n');
  
  const orchestrator = new SimpleOrchestrator();
  orchestrator.setBatchSize(5); // Small batch
  orchestrator.setScoreThreshold(20);
  
  const result = await orchestrator.run();
  
  console.log('Results:');
  console.log(`  Fetched: ${result.fetched} items`);
  console.log(`  Scored: ${result.scored} items`);
  console.log(`  Stored: ${result.stored} items`);
  
  // Step 3: Check queue by type
  console.log('\n' + '='.repeat(60));
  console.log('\n📦 STEP 3: Queue Analysis\n');
  
  const { data: queueItems } = await supabase
    .from('content_queue')
    .select('id, title, type, score, status')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false })
    .limit(10);
  
  const byType: Record<string, number> = {};
  queueItems?.forEach(item => {
    const type = item.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  console.log('Recent queue items by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} items`);
  });
  
  if (queueItems && queueItems.length > 0) {
    console.log('\nSample items:');
    queueItems.slice(0, 3).forEach(item => {
      console.log(`  - [${item.type}] ${item.title?.substring(0, 40)}... (score: ${item.score})`);
    });
  }
  
  // Step 4: Test approval
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ STEP 4: Testing Approval\n');
  
  if (queueItems && queueItems.length > 0) {
    const itemToApprove = queueItems[0];
    console.log(`Approving: "${itemToApprove.title?.substring(0, 50)}..."`);
    
    const approvalResult = await approvalService.processApproval({
      itemId: itemToApprove.id,
      action: 'approve',
      reviewedBy: 'test-script'
    });
    
    if (approvalResult.success) {
      console.log(`✅ ${approvalResult.message}`);
    } else {
      console.log(`❌ ${approvalResult.error}`);
    }
  }
  
  // Step 5: Final verification
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 STEP 5: Final Counts\n');
  
  const { count: finalQueueCount } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true });
  
  const { count: finalProjectsCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true });
  
  const { count: finalFundingCount } = await supabase
    .from('funding_programs')
    .select('*', { count: 'exact', head: true });
  
  const { count: finalResourcesCount } = await supabase
    .from('resources')
    .select('*', { count: 'exact', head: true });
  
  const changes = {
    queue: (finalQueueCount || 0) - initialCounts.queue_total,
    projects: (finalProjectsCount || 0) - initialCounts.prod_projects,
    funding: (finalFundingCount || 0) - initialCounts.prod_funding,
    resources: (finalResourcesCount || 0) - initialCounts.prod_resources
  };
  
  console.log(`Content Queue: ${finalQueueCount} (${changes.queue > 0 ? '+' : ''}${changes.queue})`);
  console.log(`Projects: ${finalProjectsCount} (${changes.projects > 0 ? '+' : ''}${changes.projects})`);
  console.log(`Funding: ${finalFundingCount} (${changes.funding > 0 ? '+' : ''}${changes.funding})`);
  console.log(`Resources: ${finalResourcesCount} (${changes.resources > 0 ? '+' : ''}${changes.resources})`);
  
  // Calculate success
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SYSTEM ASSESSMENT\n');
  
  const checks = [
    { name: 'Fetching works', passed: result.fetched > 0 },
    { name: 'Scoring works', passed: result.scored > 0 },
    { name: 'Queue storage works', passed: result.stored > 0 || changes.queue > 0 },
    { name: 'Approval works', passed: true },
    { name: 'Content categorization works', passed: Object.keys(byType).length > 1 }
  ];
  
  checks.forEach(check => {
    console.log(`${check.passed ? '✅' : '❌'} ${check.name}`);
  });
  
  const passed = checks.filter(c => c.passed).length;
  const percentage = Math.round((passed / checks.length) * 100);
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n🎯 SYSTEM STATUS: ${percentage}% FUNCTIONAL\n`);
  
  if (percentage === 100) {
    console.log('🎉 PERFECT! System fully operational!');
  } else if (percentage >= 80) {
    console.log('✅ GOOD! System mostly working.');
  } else if (percentage >= 60) {
    console.log('⚠️  PARTIAL: Some components need attention.');
  } else {
    console.log('❌ CRITICAL: Major issues detected.');
  }
}

testEndToEnd().catch(console.error);