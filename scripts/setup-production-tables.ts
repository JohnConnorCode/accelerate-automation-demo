#!/usr/bin/env tsx

/**
 * Setup Production Tables for Approval Workflow
 * Creates the missing accelerate_* tables that approved items move to
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role (needed for DDL operations)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setupProductionTables() {
  console.log('🚀 SETTING UP PRODUCTION TABLES FOR APPROVAL WORKFLOW\n');
  console.log('=' .repeat(70));

  try {
    // 1. Check current table status
    console.log('\n📊 Checking current table status...');

    const requiredTables = ['accelerate_startups', 'accelerate_investors', 'accelerate_news'];
    const tableStatus: Record<string, boolean> = {};

    for (const table of requiredTables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      tableStatus[table] = !error;

      if (error) {
        console.log(`❌ ${table}: Missing`);
      } else {
        console.log(`✅ ${table}: Exists`);
      }
    }

    const missingTables = Object.entries(tableStatus)
      .filter(([_, exists]) => !exists)
      .map(([table, _]) => table);

    if (missingTables.length === 0) {
      console.log('\n🎉 All production tables already exist!');
      return await verifyTables();
    }

    console.log(`\n🔧 Need to create ${missingTables.length} tables: ${missingTables.join(', ')}`);

    // 2. Read the SQL file
    console.log('\n📖 Reading SQL script...');
    const sqlFilePath = join(__dirname, 'create-production-tables.sql');
    const sqlScript = readFileSync(sqlFilePath, 'utf8');

    // 3. Try to execute via RPC (if available)
    console.log('\n🔨 Attempting to create tables via RPC...');

    const { error: rpcError } = await supabase.rpc('exec_sql', {
      query: sqlScript
    });

    if (rpcError) {
      console.log('❌ RPC execution failed:', rpcError.message);
      console.log('\n📝 Please manually run the SQL in Supabase SQL Editor:');
      console.log('\n' + '=' .repeat(50));
      console.log(sqlScript);
      console.log('=' .repeat(50));
      return false;
    }

    console.log('✅ Tables created successfully via RPC!');

    // 4. Verify all tables now exist
    return await verifyTables();

  } catch (error) {
    console.error('❌ Setup failed:', error);
    return false;
  }
}

async function verifyTables() {
  console.log('\n🔍 Verifying production tables...');

  const requiredTables = [
    'accelerate_startups',
    'accelerate_investors',
    'accelerate_news'
  ];

  let allTablesExist = true;

  for (const table of requiredTables) {
    try {
      // Test basic select operation
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
        allTablesExist = false;
      } else {
        console.log(`✅ ${table}: Ready for inserts`);
      }

    } catch (error) {
      console.log(`❌ ${table}: ${error}`);
      allTablesExist = false;
    }
  }

  return allTablesExist;
}

async function testApprovalWorkflow() {
  console.log('\n🧪 Testing approval workflow readiness...');

  // Test that queue tables exist
  const queueTables = ['queue_projects', 'queue_investors', 'queue_news'];

  for (const table of queueTables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);

    if (error) {
      console.log(`❌ Queue table ${table}: ${error.message}`);
      return false;
    } else {
      console.log(`✅ Queue table ${table}: Ready`);
    }
  }

  // Test that we can check record counts
  try {
    const { data: projectsData } = await supabase
      .from('queue_projects')
      .select('id');

    const { data: investorsData } = await supabase
      .from('queue_investors')
      .select('id');

    const { data: newsData } = await supabase
      .from('queue_news')
      .select('id');

    console.log(`\n📊 Current queue status:`);
    console.log(`   - Projects: ${projectsData?.length || 0} items`);
    console.log(`   - Investors: ${investorsData?.length || 0} items`);
    console.log(`   - News: ${newsData?.length || 0} items`);

    return true;

  } catch (error) {
    console.log('❌ Queue table access failed:', error);
    return false;
  }
}

async function main() {
  const tablesSetup = await setupProductionTables();
  const workflowReady = await testApprovalWorkflow();

  console.log('\n' + '=' .repeat(70));

  if (tablesSetup && workflowReady) {
    console.log('🎉 SUCCESS: Approval workflow is ready!');
    console.log('\n✅ Complete pipeline now works:');
    console.log('   Fetch → Queue → Approve → Production');
    console.log('\n🚀 You can now approve items and they will move to:');
    console.log('   - queue_projects → accelerate_startups');
    console.log('   - queue_investors → accelerate_investors');
    console.log('   - queue_news → accelerate_news');
  } else {
    console.log('❌ FAILED: Manual intervention needed');
    console.log('\n📝 Please run the SQL script manually in Supabase SQL Editor');
    console.log('   File: scripts/create-production-tables.sql');
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { setupProductionTables, verifyTables, testApprovalWorkflow };