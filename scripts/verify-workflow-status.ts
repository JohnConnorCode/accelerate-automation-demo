#!/usr/bin/env tsx

/**
 * Verify Approval Workflow Status
 * Check if all required tables exist and approval workflow is ready
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyWorkflowStatus() {
  console.log('🔍 APPROVAL WORKFLOW STATUS CHECK\n');
  console.log('=' .repeat(50));

  // Check queue tables (source)
  console.log('\n📥 QUEUE TABLES (Source for approval):');
  const queueTables = ['queue_projects', 'queue_investors', 'queue_news'];
  const queueStatus: Record<string, { exists: boolean; count: number }> = {};

  for (const table of queueTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id');

      if (error) {
        queueStatus[table] = { exists: false, count: 0 };
        console.log(`❌ ${table}: Does not exist`);
      } else {
        queueStatus[table] = { exists: true, count: data?.length || 0 };
        console.log(`✅ ${table}: ${data?.length || 0} items waiting`);
      }
    } catch (err) {
      queueStatus[table] = { exists: false, count: 0 };
      console.log(`❌ ${table}: Error checking`);
    }
  }

  // Check production tables (targets)
  console.log('\n📤 PRODUCTION TABLES (Target for approved items):');
  const productionTables = ['accelerate_startups', 'accelerate_investors', 'accelerate_news'];
  const productionStatus: Record<string, { exists: boolean; count: number }> = {};

  for (const table of productionTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id');

      if (error) {
        productionStatus[table] = { exists: false, count: 0 };
        console.log(`❌ ${table}: MISSING - approval will fail`);
      } else {
        productionStatus[table] = { exists: true, count: data?.length || 0 };
        console.log(`✅ ${table}: ${data?.length || 0} approved items`);
      }
    } catch (err) {
      productionStatus[table] = { exists: false, count: 0 };
      console.log(`❌ ${table}: Error checking`);
    }
  }

  // Workflow assessment
  console.log('\n🔄 WORKFLOW ASSESSMENT:');

  const queueTablesReady = Object.values(queueStatus).every(s => s.exists);
  const productionTablesReady = Object.values(productionStatus).every(s => s.exists);
  const hasQueuedItems = Object.values(queueStatus).some(s => s.count > 0);

  console.log(`Queue Tables Ready: ${queueTablesReady ? '✅' : '❌'}`);
  console.log(`Production Tables Ready: ${productionTablesReady ? '✅' : '❌'}`);
  console.log(`Items to Process: ${hasQueuedItems ? '✅' : '⚠️ None'}`);

  // Overall status
  console.log('\n' + '=' .repeat(50));
  if (queueTablesReady && productionTablesReady) {
    console.log('🎉 APPROVAL WORKFLOW: READY');
    console.log('✅ All tables exist - approvals will work');
  } else if (queueTablesReady && !productionTablesReady) {
    console.log('🚨 APPROVAL WORKFLOW: BROKEN');
    console.log('❌ Missing production tables - approvals will fail');
    console.log('🛠️  ACTION REQUIRED: Create missing production tables');
  } else {
    console.log('⚠️  APPROVAL WORKFLOW: INCOMPLETE');
    console.log('❌ Missing both queue and production tables');
  }

  // Summary with counts
  const totalQueued = Object.values(queueStatus).reduce((sum, s) => sum + s.count, 0);
  const totalApproved = Object.values(productionStatus).reduce((sum, s) => sum + s.count, 0);

  console.log(`\n📊 CURRENT DATA:`);
  console.log(`   Queued Items: ${totalQueued}`);
  console.log(`   Approved Items: ${totalApproved}`);

  if (totalQueued > 0 && !productionTablesReady) {
    console.log(`\n⚡ URGENT: ${totalQueued} items waiting for approval but production tables missing!`);
  }

  return {
    queueTablesReady,
    productionTablesReady,
    workflowReady: queueTablesReady && productionTablesReady,
    totalQueued,
    totalApproved
  };
}

// Run verification
verifyWorkflowStatus().catch(console.error);