#!/usr/bin/env npx tsx
import { supabase } from '../src/lib/supabase-client';



const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ Missing SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}



async function testTables() {
  console.log('🔍 Testing what tables actually exist...\n');
  
  // Test if tables exist by trying different operations
  const tables = {
    'queue_projects': { url: 'test1', title: 'Test 1', description: 'Test', source: 'test', status: 'pending' },
    'queue_investors': { url: 'test2', title: 'Test 2', description: 'Test', source: 'test', status: 'pending' },
    'queue_news': { url: 'test3', title: 'Test 3', description: 'Test', source: 'test', status: 'pending' },
    'content_queue': { url: 'test4', title: 'Test 4', description: 'Test', content_type: 'resource', status: 'pending' }
  };
  
  for (const [table, testData] of Object.entries(tables)) {
    console.log(`📋 Testing ${table}:`);
    
    // Try to select from the table
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('   ❌ Table does not exist');
      } else if (error.message.includes('column')) {
        console.log('   ⚠️  Table exists but missing columns:', error.message);
      } else {
        console.log('   ❌ Error:', error.message);
      }
    } else {
      console.log('   ✅ Table exists and is accessible');
      
      // Try to get column info
      if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log('   Columns:', columns.slice(0, 5).join(', ') + (columns.length > 5 ? '...' : ''));
      } else {
        // Try insert to see what columns are needed
        const { error: insertError } = await supabase
          .from(table)
          .insert(testData as any)
          .select();
        
        if (!insertError) {
          console.log('   ✅ Insert successful - table is fully functional');
          // Clean up
          await supabase.from(table).delete().eq('url', testData.url);
        } else if (insertError.message.includes('column')) {
          const missingColumn = insertError.message.match(/column '(\w+)'/)?.[1];
          console.log(`   ⚠️  Missing column: ${missingColumn || 'unknown'}`);
        } else if (insertError.message.includes('duplicate')) {
          console.log('   ✅ Table has unique constraints');
        } else {
          console.log('   Insert error:', insertError.message);
        }
      }
    }
    console.log();
  }
  
  console.log('📊 Summary:');
  console.log('The code expects queue_projects, queue_investors, queue_news tables.');
  console.log('If these dont exist, the staging service cannot work.');
  console.log('\nTo fix: Execute database/create-queue-tables.sql in Supabase.');
}

testTables().catch(console.error);