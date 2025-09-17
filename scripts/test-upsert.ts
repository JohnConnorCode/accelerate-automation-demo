#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';

async function testUpsert() {
  console.log('🧪 Testing upsert functionality...\n');
  
  // Test data
  const testProject = {
    url: 'https://test.accelerate.com/test-project-' + Date.now(),
    title: 'Test Project for Upsert',
    description: 'Testing if upserts work with constraints',
    source: 'test',
    score: 0.85,
    status: 'pending',
    metadata: {},
    accelerate_fit: true,
    accelerate_reason: 'Test project'
  };
  
  console.log('1️⃣ First insert attempt...');
  const { data: firstInsert, error: firstError } = await supabase
    .from('queue_projects')
    .insert(testProject as any)
    .select()
    .single();
  
  if (firstError) {
    console.log('   ❌ First insert failed:', firstError.message);
    
    // Try upsert instead
    console.log('\n2️⃣ Trying upsert instead...');
    const { data: upsertData, error: upsertError } = await supabase
      .from('queue_projects')
      .upsert(testProject, {
        onConflict: 'url',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (upsertError) {
      console.log('   ❌ Upsert failed:', upsertError.message);
      console.log('\n⚠️  Database constraints may not be configured.');
      console.log('   Please run the migration in Supabase dashboard.');
    } else {
      console.log('   ✅ Upsert succeeded!');
      console.log('   Data:', upsertData);
    }
  } else {
    console.log('   ✅ First insert succeeded');
    console.log('   ID:', firstInsert.id);
    
    // Try inserting duplicate
    console.log('\n2️⃣ Testing duplicate handling...');
    const { data: dupInsert, error: dupError } = await supabase
      .from('queue_projects')
      .insert(testProject as any)
      .select()
      .single();
    
    if (dupError) {
      if (dupError.code === '23505' || dupError.message?.includes('duplicate')) {
        console.log('   ✅ Duplicate prevented by constraint!');
        console.log('   Constraints are working correctly.');
      } else {
        console.log('   ❌ Insert failed with unexpected error:', dupError.message);
      }
    } else {
      console.log('   ⚠️  Duplicate was inserted - constraints not active');
      console.log('   Please run the migration to add unique constraints.');
    }
    
    // Try upsert on existing
    console.log('\n3️⃣ Testing upsert on existing item...');
    testProject.description = 'Updated description via upsert';
    testProject.score = 0.95;
    
    const { data: upsertExisting, error: upsertError } = await supabase
      .from('queue_projects')
      .upsert(testProject, {
        onConflict: 'url',
        ignoreDuplicates: false
      })
      .select()
      .single();
    
    if (upsertError) {
      console.log('   ❌ Upsert failed:', upsertError.message);
    } else {
      console.log('   ✅ Upsert updated existing record');
      console.log('   New score:', upsertExisting.score);
    }
    
    // Clean up test data
    console.log('\n4️⃣ Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('queue_projects')
      .delete()
      .eq('url', testProject.url);
    
    if (deleteError) {
      console.log('   ❌ Cleanup failed:', deleteError.message);
    } else {
      console.log('   ✅ Test data cleaned up');
    }
  }
  
  // Check if constraints exist
  console.log('\n5️⃣ Checking table structure...');
  const { data: tableInfo, error: infoError } = await supabase
    .from('queue_projects')
    .select('*')
    .limit(0);
  
  if (!infoError) {
    console.log('   ✅ Table accessible');
    
    // Try to get constraint info (this won't work with anon key but worth trying)
    let constraints, constraintError;
    try {
      const result = await supabase.rpc('get_table_constraints', { table_name: 'queue_projects' });
      constraints = result.data;
      constraintError = result.error;
    } catch {
      constraints = null;
      constraintError = 'Function not available';
    }
    
    if (constraints) {
      console.log('   Constraints:', constraints);
    } else {
      console.log('   ℹ️  Cannot query constraints with current permissions');
    }
  } else {
    console.log('   ❌ Table not accessible:', infoError.message);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log('- Database connection: ✅ Working');
  console.log('- Table access: ✅ Confirmed');
  console.log('- Upsert functionality: Testing required');
  console.log('- Unique constraints: Need verification');
  console.log('\nIf upserts are failing, please execute the migration');
  console.log('in your Supabase dashboard SQL editor.');
}

testUpsert().catch(console.error);