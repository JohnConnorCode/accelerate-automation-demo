#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';

async function checkSchema() {
  console.log('🔍 Checking database schema...\n');
  
  const tables = ['queue_projects', 'queue_investors', 'queue_news', 'projects', 'funding_programs', 'resources'];
  
  for (const table of tables) {
    console.log(`📋 Table: ${table}`);
    
    // Try to query the table
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('   ❌ Table does not exist');
      } else if (error.message.includes('column')) {
        console.log('   ⚠️  Table exists but schema mismatch');
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    } else {
      console.log('   ✅ Table exists and is accessible');
      if (data && data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
      } else {
        // Try inserting a test record to see what columns are required
        const testData: any = {
          url: 'https://test.example.com/' + Date.now(),
          title: 'Test',
          description: 'Test',
          source: 'test',
          score: 0,
          status: 'pending',
          metadata: {}
        };
        
        const { error: insertError } = await (supabase
          .from(table) as any)
          .insert(testData)
          .select();
        
        if (insertError) {
          // Extract column info from error
          if (insertError.message.includes('column')) {
            console.log('   Schema issue:', insertError.message);
          }
        } else {
          // Clean up
          await supabase.from(table).delete().eq('url', testData.url);
        }
      }
    }
    console.log();
  }
  
  console.log('📊 Schema Summary:');
  console.log('If tables are missing or have schema mismatches,');
  console.log('you need to run the full database schema creation script.');
  console.log('\nCheck database/schema.sql for the complete schema.');
}