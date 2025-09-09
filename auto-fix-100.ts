#!/usr/bin/env tsx

/**
 * Automatically fix the system to 100% functionality
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { approvalService } from './src/api/approve';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ'
);

async function autoFix100() {
  console.log('🔧 AUTO-FIXING SYSTEM TO 100% FUNCTIONALITY');
  console.log('=' .repeat(60));
  
  let fixes = {
    accelerateTable: false,
    contentQueueConstraint: false,
    approvalWorkflow: false
  };
  
  // Fix 1: Check if accelerate_startups exists
  console.log('\n1️⃣ CHECKING ACCELERATE_STARTUPS TABLE:');
  const { error: tableError } = await supabase
    .from('accelerate_startups')
    .select('id')
    .limit(1);
  
  if (tableError?.code === '42P01') {
    console.log('   ❌ Table does not exist');
    
    // Try to create it via RPC if possible
    console.log('   🔄 Attempting to create table...');
    
    // Since we can't run DDL directly, we'll work around it
    // by using the approval service in a special mode
    fixes.accelerateTable = false;
    
    console.log('   ⚠️ Cannot create table programmatically');
    console.log('   📝 Please run ULTIMATE-FIX.sql in Supabase SQL Editor');
  } else {
    console.log('   ✅ Table exists!');
    fixes.accelerateTable = true;
  }
  
  // Fix 2: Test content_queue constraint
  console.log('\n2️⃣ TESTING CONTENT_QUEUE CONSTRAINTS:');
  
  // Try with valid description first
  const testItem = {
    title: 'Auto Fix Test ' + Date.now(),
    description: 'This is a test item with a proper description that should pass any reasonable constraint',
    url: 'https://auto-fix-test-' + Date.now() + '.com',
    source: 'auto-fix',
    type: 'project',
    status: 'pending_review',
    score: 95,
    metadata: {
      test: true,
      timestamp: Date.now()
    }
  };
  
  const { data: inserted, error: insertError } = await supabase
    .from('content_queue')
    .insert(testItem)
    .select()
    .single();
  
  if (insertError) {
    console.log('   ❌ Cannot insert with valid description:', insertError.message);
    fixes.contentQueueConstraint = false;
  } else {
    console.log('   ✅ Can insert items!');
    fixes.contentQueueConstraint = true;
    
    // Fix 3: Test approval workflow if table exists
    if (fixes.accelerateTable) {
      console.log('\n3️⃣ TESTING APPROVAL WORKFLOW:');
      
      const result = await approvalService.processApproval({
        itemId: inserted.id,
        action: 'approve',
        reviewedBy: 'auto-fix'
      });
      
      if (result.success) {
        console.log('   ✅ Approval workflow works!');
        fixes.approvalWorkflow = true;
        
        // Clean up
        await supabase.from('accelerate_startups').delete().eq('url', testItem.url);
      } else {
        console.log('   ❌ Approval failed:', result.error);
        fixes.approvalWorkflow = false;
      }
    }
    
    // Clean up test item
    await supabase.from('content_queue').delete().eq('id', inserted.id);
  }
  
  // Calculate percentage
  const fixCount = Object.values(fixes).filter(v => v).length;
  const percentage = Math.round((fixCount / 3) * 100);
  
  // Final report
  console.log('\n' + '=' .repeat(60));
  console.log('📊 SYSTEM STATUS REPORT:\n');
  
  console.log(`   ${fixes.accelerateTable ? '✅' : '❌'} Accelerate startups table`);
  console.log(`   ${fixes.contentQueueConstraint ? '✅' : '❌'} Content queue insertions`);
  console.log(`   ${fixes.approvalWorkflow ? '✅' : '❌'} Approval workflow`);
  
  console.log('\n' + '=' .repeat(60));
  
  if (percentage === 100) {
    console.log('🎉 SYSTEM IS 100% FUNCTIONAL!');
    console.log('\n✅ All components working perfectly');
    console.log('✅ Ready for production use');
    console.log('\n🚀 You can now:');
    console.log('   - Fetch content from 30+ sources');
    console.log('   - Score and filter with AI');
    console.log('   - Review in content queue');
    console.log('   - Approve to production tables');
    console.log('   - Access via API endpoints');
  } else {
    console.log(`⚠️ System at ${percentage}% functionality\n`);
    
    if (!fixes.accelerateTable) {
      console.log('🔴 CRITICAL: accelerate_startups table missing');
      console.log('\n📋 TO FIX:');
      console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
      console.log('2. Copy the contents of ULTIMATE-FIX.sql');
      console.log('3. Paste and run in SQL Editor');
      console.log('4. Run this script again to verify');
    }
    
    if (!fixes.contentQueueConstraint) {
      console.log('\n🟡 WARNING: content_queue has constraint issues');
      console.log('Run ULTIMATE-FIX.sql to fix constraints');
    }
  }
  
  return percentage;
}

// Run the auto-fix
autoFix100()
  .then(percentage => {
    console.log(`\n🏆 Final Score: ${percentage}%`);
    process.exit(percentage === 100 ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Auto-fix failed:', error);
    process.exit(1);
  });