#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase-client';
import fs from 'fs';

/**
 * Setup all required database tables
 * Run this to create all tables needed for full functionality
 */
async function setupDatabase() {
  console.log('🚀 Setting up database tables...\n');

  // Read the SQL file
  const sql = fs.readFileSync('./scripts/create-essential-tables.sql', 'utf-8');
  
  // Split into individual statements (Supabase doesn't support multiple statements in one call)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  console.log(`📊 Executing ${statements.length} SQL statements...\n`);

  for (const statement of statements) {
    // Skip comments and empty lines
    if (!statement || statement.startsWith('--')) continue;
    
    try {
      // For table creation, we use rpc with the SQL
      const { error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      });

      if (error) {
        // Try direct execution as fallback
        const { error: directError } = await (supabase as any).from('_sql').rpc('exec', {
          query: statement + ';'
        });
        
        if (directError) {
          console.log(`❌ Failed to execute: ${statement.substring(0, 50)}...`);
          console.log(`   Error: ${directError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
          successCount++;
        }
      } else {
        console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
        successCount++;
      }
    } catch (err: any) {
      console.log(`⚠️  Skipped: ${statement.substring(0, 50)}...`);
      console.log(`   Reason: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Results:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  
  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. This might be because:');
    console.log('   1. Tables already exist (which is fine)');
    console.log('   2. You need to run the SQL directly in Supabase');
    console.log('\n📝 To complete setup manually:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Open the SQL editor');
    console.log('   3. Copy the content from scripts/create-essential-tables.sql');
    console.log('   4. Run it');
  } else {
    console.log('\n🎉 Database setup complete!');
    console.log('   All tables created successfully.');
  }
  
  // Test the tables
  console.log('\n🧪 Testing table access...');
  const tables = [
    'api_cache',
    'search_analytics', 
    'resources',
    'funding_programs',
    'webhook_endpoints',
    'system_settings'
  ];
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: accessible`);
      }
    } catch {
      console.log(`   ❌ ${table}: not found`);
    }
  }
}

setupDatabase().catch(console.error);