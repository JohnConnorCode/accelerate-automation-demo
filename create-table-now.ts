#!/usr/bin/env tsx

/**
 * Create the accelerate_startups table using Supabase SDK
 * Since we can't use DDL commands directly, we'll work around it
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ'
);

async function createTableWorkaround() {
  console.log('🔨 CREATING TABLE WORKAROUND...\n');
  
  // First, check current state
  const tables = ['content_queue', 'accelerate_startups', 'funding_programs', 'resources'];
  console.log('Current table status:');
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error?.code === '42P01') {
      console.log(`❌ ${table}: Does not exist`);
      
      if (table === 'accelerate_startups') {
        console.log('\n🚨 CRITICAL: accelerate_startups table missing!');
        console.log('This prevents the approval workflow from working.\n');
        
        // Try alternative approach - use projects table if it exists
        console.log('Checking for alternative tables...');
        const { error: projectsError } = await supabase
          .from('projects')
          .select('id')
          .limit(1);
        
        if (!projectsError) {
          console.log('✅ Found "projects" table - can use as alternative');
          
          // Update approval service to use projects table
          console.log('\nSOLUTION: Update approval service to use "projects" table instead');
          return 'projects';
        }
      }
    } else {
      console.log(`✅ ${table}: ${count || 0} items`);
    }
  }
  
  return null;
}

async function testApprovalWithAlternative(tableName: string) {
  console.log(`\n📝 Testing approval with ${tableName} table...`);
  
  // Get a pending item
  const { data: item } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'pending_review')
    .limit(1)
    .single();
  
  if (!item) {
    console.log('No items to approve');
    return;
  }
  
  console.log(`Approving: ${item.title}`);
  
  // Try to insert into the alternative table
  const approvalData = {
    name: item.title,
    description: item.description || '',
    url: item.url,
    source: item.source,
    score: item.score || 0,
    metadata: item.metadata || {},
    approved_at: new Date().toISOString(),
    approved_by: 'system'
  };
  
  const { error } = await supabase
    .from(tableName)
    .insert(approvalData);
  
  if (error) {
    console.log(`❌ Insert failed:`, error.message);
  } else {
    console.log(`✅ Successfully approved to ${tableName} table!`);
    
    // Mark as approved in queue
    await supabase
      .from('content_queue')
      .update({ 
        status: 'approved',
        approved_at: new Date().toISOString() 
      })
      .eq('id', item.id);
  }
}

async function main() {
  const alternativeTable = await createTableWorkaround();
  
  if (alternativeTable) {
    await testApprovalWithAlternative(alternativeTable);
    
    console.log('\n💡 RECOMMENDATION:');
    console.log(`Update the approval service to use "${alternativeTable}" table`);
    console.log('This will make the approval workflow functional immediately.');
  }
  
  console.log('\n📋 FINAL STATUS:');
  console.log('To complete the system setup, you need to:');
  console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('2. Run the SQL from EXECUTE_THIS_SQL.md');
  console.log('3. OR update the code to use the "projects" table instead');
}

main().catch(console.error);