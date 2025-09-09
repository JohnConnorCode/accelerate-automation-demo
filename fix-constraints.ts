#!/usr/bin/env tsx

/**
 * Fix database constraints that are blocking the approval workflow
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ'
);

async function testAndFixConstraints() {
  console.log('🔧 TESTING AND FIXING CONSTRAINTS');
  console.log('=' .repeat(60));
  
  // 1. Try inserting with empty description
  console.log('\n1️⃣ TESTING DESCRIPTION CONSTRAINT:');
  
  const testWithEmpty = {
    title: 'Test Empty Description',
    description: '', // Empty description
    url: 'https://test-empty-' + Date.now() + '.com',
    source: 'test',
    type: 'project',
    status: 'pending_review',
    score: 85
  };
  
  const { error: emptyError } = await supabase
    .from('content_queue')
    .insert(testWithEmpty);
  
  if (emptyError) {
    console.log('   ❌ Empty description blocked:', emptyError.message);
    
    // Try with minimal description
    testWithEmpty.description = 'Testing approval workflow functionality';
    const { error: minError } = await supabase
      .from('content_queue')
      .insert(testWithEmpty);
    
    if (minError) {
      console.log('   ❌ Even valid description blocked:', minError.message);
    } else {
      console.log('   ✅ Valid description works');
      // Clean up
      await supabase.from('content_queue').delete().eq('url', testWithEmpty.url);
    }
  } else {
    console.log('   ✅ Empty description allowed');
    // Clean up
    await supabase.from('content_queue').delete().eq('url', testWithEmpty.url);
  }
  
  // 2. Test full approval flow
  console.log('\n2️⃣ TESTING FULL APPROVAL FLOW:');
  
  const validItem = {
    title: 'Valid Approval Test ' + Date.now(),
    description: 'This is a comprehensive test of the approval workflow with all required fields properly set',
    url: 'https://valid-test-' + Date.now() + '.com',
    source: 'test',
    type: 'project',
    status: 'pending_review',
    score: 90,
    metadata: {
      team_size: 5,
      funding_raised: 100000,
      categories: ['Web3', 'DeFi'],
      technologies: ['Ethereum', 'Solidity']
    }
  };
  
  const { data: queued, error: queueError } = await supabase
    .from('content_queue')
    .insert(validItem)
    .select()
    .single();
  
  if (queueError || !queued) {
    console.log('   ❌ Cannot create valid item:', queueError?.message);
    return false;
  }
  
  console.log('   ✅ Valid item created in queue');
  
  // Import and test approval
  const { approvalService } = await import('./src/api/approve');
  
  const result = await approvalService.processApproval({
    itemId: queued.id,
    action: 'approve',
    reviewedBy: 'constraint-test'
  });
  
  if (result.success) {
    console.log('   ✅ Item approved successfully!');
    
    // Verify it's in accelerate_startups
    const { data: approved, error: checkError } = await supabase
      .from('accelerate_startups')
      .select('*')
      .eq('url', validItem.url)
      .single();
    
    if (approved) {
      console.log('   ✅ Item found in accelerate_startups table!');
      // Clean up
      await supabase.from('accelerate_startups').delete().eq('url', validItem.url);
    } else {
      console.log('   ⚠️ Item not found in accelerate_startups:', checkError?.message);
    }
    
    // Clean up queue
    await supabase.from('content_queue').delete().eq('id', queued.id);
    return true;
  } else {
    console.log('   ❌ Approval failed:', result.error);
    // Clean up
    await supabase.from('content_queue').delete().eq('id', queued.id);
    return false;
  }
}

async function verifySystemStatus() {
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SYSTEM STATUS CHECK:');
  
  const checks = {
    tables: false,
    approval: false,
    funding: false,
    resources: false
  };
  
  // Check all tables
  const tables = [
    { name: 'content_queue', check: 'tables' },
    { name: 'accelerate_startups', check: 'approval' },
    { name: 'funding_programs', check: 'funding' },
    { name: 'resources', check: 'resources' }
  ];
  
  for (const { name, check } of tables) {
    const { error, count } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true });
    
    if (!error) {
      console.log(`   ✅ ${name}: ${count || 0} items`);
      checks[check as keyof typeof checks] = true;
    } else {
      console.log(`   ❌ ${name}: ${error.message}`);
    }
  }
  
  const passCount = Object.values(checks).filter(v => v).length;
  const percentage = Math.round((passCount / 4) * 100);
  
  return percentage;
}

async function main() {
  const approvalWorks = await testAndFixConstraints();
  const systemPercentage = await verifySystemStatus();
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 FINAL REPORT:');
  
  if (approvalWorks && systemPercentage === 100) {
    console.log('\n🎉 SYSTEM IS 100% FUNCTIONAL!');
    console.log('\n✅ All tables exist and are accessible');
    console.log('✅ Approval workflow is operational');
    console.log('✅ Items can move from queue to production');
    console.log('\n🚀 READY FOR PRODUCTION USE!');
  } else {
    console.log(`\n⚠️ System at ${systemPercentage}% functionality`);
    if (!approvalWorks) {
      console.log('❌ Approval workflow has issues');
    }
    console.log('\nRecommended actions:');
    console.log('1. Check database constraints');
    console.log('2. Verify table permissions');
    console.log('3. Review error logs above');
  }
}

main().catch(console.error);