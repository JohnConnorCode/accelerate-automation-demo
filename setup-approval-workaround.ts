#!/usr/bin/env tsx

/**
 * Setup approval workflow workaround by creating accelerate_startups as a view
 * or using projects table directly
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ'
);

async function setupApprovalWorkaround() {
  console.log('🔧 SETTING UP APPROVAL WORKFLOW WORKAROUND');
  console.log('=' .repeat(60));
  
  // 1. Check what tables exist
  console.log('\n1️⃣ CHECKING EXISTING TABLES:');
  
  const tables = [
    'content_queue',
    'accelerate_startups', 
    'projects',
    'funding_programs',
    'resources'
  ];
  
  let projectsTableExists = false;
  let accelerateTableExists = false;
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error?.code === '42P01') {
      console.log(`   ❌ ${table}: Does not exist`);
    } else {
      console.log(`   ✅ ${table}: Exists with ${count || 0} items`);
      if (table === 'projects') projectsTableExists = true;
      if (table === 'accelerate_startups') accelerateTableExists = true;
    }
  }
  
  // 2. If projects exists but not accelerate_startups, we can work with that
  if (projectsTableExists && !accelerateTableExists) {
    console.log('\n2️⃣ USING PROJECTS TABLE FOR APPROVAL:');
    console.log('   ✅ Will use "projects" table for approved startups');
    
    // Test insertion
    const testData = {
      name: 'Test Approval ' + Date.now(),
      description: 'Testing approval workflow with projects table',
      url: 'https://test-' + Date.now() + '.com',
      score: 90,
      metadata: {},
      approved_at: new Date().toISOString(),
      approved_by: 'workaround-test'
    };
    
    const { error: insertError } = await supabase
      .from('projects')
      .insert(testData);
    
    if (insertError) {
      console.log('   ⚠️ Cannot insert to projects:', insertError.message);
      
      // If we can't insert, just mark as approved in queue
      console.log('\n3️⃣ FALLBACK: Keep approved items in queue with status');
      return 'queue-only';
    } else {
      console.log('   ✅ Successfully inserted test item');
      // Clean up
      await supabase.from('projects').delete().eq('url', testData.url);
      return 'projects';
    }
  }
  
  // 3. If accelerate_startups exists, use it
  if (accelerateTableExists) {
    console.log('\n✅ ACCELERATE_STARTUPS TABLE EXISTS!');
    return 'accelerate_startups';
  }
  
  // 4. Neither exists - use queue-only mode
  console.log('\n⚠️ NO PRODUCTION TABLES AVAILABLE');
  console.log('Will keep approved items in queue with approved status');
  return 'queue-only';
}

async function testApprovalFlow(mode: string) {
  console.log('\n' + '=' .repeat(60));
  console.log('📊 TESTING APPROVAL WORKFLOW:');
  
  // Create test item in queue
  const testItem = {
    title: 'Approval Test ' + Date.now(),
    description: 'Testing the approval workflow with workaround',
    url: 'https://approval-test-' + Date.now() + '.com',
    source: 'test',
    type: 'project',
    status: 'pending_review',
    score: 85
  };
  
  const { data: queued, error: queueError } = await supabase
    .from('content_queue')
    .insert(testItem)
    .select()
    .single();
  
  if (queueError || !queued) {
    console.log('   ❌ Cannot create test item:', queueError?.message);
    return false;
  }
  
  console.log('   ✅ Test item created in queue');
  
  // Import and test approval service
  const { approvalService } = await import('./src/api/approve');
  
  const result = await approvalService.processApproval({
    itemId: queued.id,
    action: 'approve',
    reviewedBy: 'workaround-test'
  });
  
  if (result.success) {
    console.log('   ✅ APPROVAL WORKFLOW WORKS!');
    console.log(`   Mode: ${mode}`);
    
    // Clean up based on mode
    if (mode === 'projects') {
      await supabase.from('projects').delete().eq('url', testItem.url);
    }
    await supabase.from('content_queue').delete().eq('id', queued.id);
    
    return true;
  } else {
    console.log('   ❌ Approval failed:', result.error);
    // Clean up
    await supabase.from('content_queue').delete().eq('id', queued.id);
    return false;
  }
}

async function main() {
  const mode = await setupApprovalWorkaround();
  const success = await testApprovalFlow(mode);
  
  console.log('\n' + '=' .repeat(60));
  console.log('🏁 FINAL CONFIGURATION:');
  
  if (success) {
    console.log('\n✅ APPROVAL WORKFLOW IS FUNCTIONAL!');
    console.log(`   Using mode: ${mode}`);
    
    if (mode === 'queue-only') {
      console.log('   Items will be marked as approved in content_queue');
      console.log('   (No separate production table available)');
    } else {
      console.log(`   Approved items will be moved to: ${mode} table`);
    }
    
    console.log('\n🚀 SYSTEM IS READY FOR USE!');
  } else {
    console.log('\n⚠️ APPROVAL WORKFLOW NEEDS ATTENTION');
    console.log('   Please run FIX_APPROVAL_NOW.sql in Supabase');
  }
}

main().catch(console.error);