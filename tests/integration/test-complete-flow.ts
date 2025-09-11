/**
 * Complete End-to-End Flow Test
 * Tests the entire pipeline from fetch to approval
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const API_URL = 'http://localhost:3000/api';
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCompleteFlow() {
  console.log('🔄 TESTING COMPLETE FLOW');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Trigger data fetch
    console.log('\n1️⃣ Fetching fresh data...');
    const fetchResponse = await fetch(`${API_URL}/scheduler/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'content-fetch' })
    });
    
    const fetchResult = await fetchResponse.json();
    if (!fetchResult.success) {
      throw new Error(`Fetch failed: ${fetchResult.error}`);
    }
    
    console.log(`✅ Fetched ${fetchResult.result.fetched} items`);
    console.log(`✅ ${fetchResult.result.unique} unique items`);
    console.log(`✅ ${fetchResult.result.inserted} inserted to queue`);
    
    // Step 2: Check queue
    console.log('\n2️⃣ Checking queue...');
    const queueResponse = await fetch(`${API_URL}/queue/projects`);
    const queueData = await queueResponse.json();
    
    if (!Array.isArray(queueData)) {
      throw new Error('Queue data is not an array');
    }
    
    console.log(`✅ ${queueData.length} items in queue`);
    
    if (queueData.length === 0) {
      console.log('⚠️  No items in queue to test approval');
      return;
    }
    
    // Step 3: Test approval
    console.log('\n3️⃣ Testing approval process...');
    const itemToApprove = queueData[0];
    console.log(`   Approving: ${itemToApprove.company_name || itemToApprove.title}`);
    
    const approvalResponse = await fetch(`${API_URL}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemToApprove.id,
        type: 'projects',
        action: 'approve',
        reviewerNotes: 'Approved in complete flow test'
      })
    });
    
    const approvalResult = await approvalResponse.json();
    if (!approvalResult.success) {
      throw new Error(`Approval failed: ${approvalResult.error}`);
    }
    
    console.log(`✅ Item approved and moved to production`);
    console.log(`   Production ID: ${approvalResult.data?.id}`);
    
    // Step 4: Verify in production
    console.log('\n4️⃣ Verifying in production table...');
    const { data: prodItem, error } = await supabase
      .from('accelerate_startups')
      .select('*')
      .eq('id', approvalResult.data.id)
      .single();
    
    if (error || !prodItem) {
      throw new Error('Failed to find item in production');
    }
    
    console.log(`✅ Item found in production table`);
    console.log(`   Name: ${prodItem.name}`);
    console.log(`   Score: ${prodItem.accelerate_score}`);
    
    // Step 5: Test rejection
    console.log('\n5️⃣ Testing rejection process...');
    if (queueData.length > 1) {
      const itemToReject = queueData[1];
      console.log(`   Rejecting: ${itemToReject.company_name || itemToReject.title}`);
      
      const rejectResponse = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemToReject.id,
          type: 'projects',
          action: 'reject',
          reviewerNotes: 'Rejected in test'
        })
      });
      
      const rejectResult = await rejectResponse.json();
      if (!rejectResult.success) {
        throw new Error(`Rejection failed: ${rejectResult.error}`);
      }
      
      console.log(`✅ Item rejected and removed from queue`);
    }
    
    // Step 6: Test duplicate approval prevention
    console.log('\n6️⃣ Testing duplicate approval prevention...');
    const duplicateResponse = await fetch(`${API_URL}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: itemToApprove.id,
        type: 'projects',
        action: 'approve'
      })
    });
    
    const duplicateResult = await duplicateResponse.json();
    if (duplicateResult.success) {
      throw new Error('Duplicate approval should have failed!');
    }
    
    console.log(`✅ Duplicate approval properly prevented`);
    
    // Step 7: Check analytics
    console.log('\n7️⃣ Checking analytics...');
    const analyticsResponse = await fetch(`${API_URL}/analytics`);
    const analyticsData = await analyticsResponse.json();
    
    console.log(`✅ Analytics endpoint working`);
    console.log(`   Total in queue: ${analyticsData.totalInQueue}`);
    console.log(`   Total approved: ${analyticsData.totalApproved}`);
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ COMPLETE FLOW TEST PASSED!');
    console.log('All components working end-to-end');
    
  } catch (error) {
    console.error('\n❌ FLOW TEST FAILED:', error);
    process.exit(1);
  }
}

testCompleteFlow();