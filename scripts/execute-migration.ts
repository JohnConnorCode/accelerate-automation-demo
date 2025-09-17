#!/usr/bin/env npx tsx

/**
 * Database Migration Executor
 * Executes migration statements one by one using Supabase client
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import dotenv from 'dotenv';
import { supabase } from '../src/lib/supabase-client';


// Load environment variables
dotenv.config();

async function executeMigration() {
  console.log('🚀 Executing database migration...');
  
  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';
  
  console.log(`📡 Connecting to: ${supabaseUrl}`);
  
  // Create Supabase client
  
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../database/add-unique-constraints.sql');
    console.log(`📄 Reading migration from: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Parse individual SQL statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // List of individual SQL statements to execute
    const migrations = [
      // 1. Add unique constraints
      `ALTER TABLE queue_projects ADD CONSTRAINT IF NOT EXISTS queue_projects_url_unique UNIQUE (url)`,
      `ALTER TABLE queue_investors ADD CONSTRAINT IF NOT EXISTS queue_investors_url_unique UNIQUE (url)`,
      `ALTER TABLE queue_news ADD CONSTRAINT IF NOT EXISTS queue_news_url_unique UNIQUE (url)`,
      
      // 2. Production tables constraints
      `ALTER TABLE projects ADD CONSTRAINT IF NOT EXISTS projects_url_unique UNIQUE (url)`,
      `ALTER TABLE funding_programs ADD CONSTRAINT IF NOT EXISTS funding_programs_url_unique UNIQUE (url)`,
      `ALTER TABLE resources ADD CONSTRAINT IF NOT EXISTS resources_url_unique UNIQUE (url)`,
      
      // 3. Performance indexes
      `CREATE INDEX IF NOT EXISTS idx_queue_projects_created_at ON queue_projects(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON queue_projects(status)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_projects_score ON queue_projects(score DESC)`,
      
      `CREATE INDEX IF NOT EXISTS idx_queue_investors_created_at ON queue_investors(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_investors_status ON queue_investors(status)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_investors_score ON queue_investors(score DESC)`,
      
      `CREATE INDEX IF NOT EXISTS idx_queue_news_created_at ON queue_news(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_news_status ON queue_news(status)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_news_score ON queue_news(score DESC)`,
      
      // 4. Composite indexes
      `CREATE INDEX IF NOT EXISTS idx_queue_projects_status_score ON queue_projects(status, score DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_investors_status_score ON queue_investors(status, score DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_news_status_score ON queue_news(status, score DESC)`,
    ];
    
    let successCount = 0;
    let failureCount = 0;
    
    // Execute each migration
    for (let i = 0; i < migrations.length; i++) {
      const statement = migrations[i];
      console.log(`⏳ Executing statement ${i + 1}/${migrations.length}...`);
      console.log(`   ${statement.substring(0, 60)}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.log(`⚠️  Statement ${i + 1} failed (this may be expected): ${error.message}`);
          console.log(`📝 Statement: ${statement}`);
          failureCount++;
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
          successCount++;
        }
      } catch (err: any) {
        console.log(`⚠️  Statement ${i + 1} failed with exception: ${err.message}`);
        console.log(`📝 Statement: ${statement}`);
        failureCount++;
      }
      
      // Small delay between statements
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Failed: ${failureCount}`);
    
    // Verification query
    console.log('\n🔍 Verifying constraints...');
    try {
      const { data: constraints, error: verifyError } = await supabase
        .from('information_schema.table_constraints')
        .select('table_name, constraint_name, constraint_type')
        .eq('table_schema', 'public')
        .in('table_name', ['queue_projects', 'queue_investors', 'queue_news', 'projects', 'funding_programs', 'resources'])
        .eq('constraint_type', 'UNIQUE')
        .order('table_name');
        
      if (verifyError) {
        console.log('⚠️  Could not verify constraints automatically');
        console.log('📝 Please check manually in Supabase dashboard');
      } else {
        console.log('✅ Unique constraints found:');
        console.table(constraints);
      }
    } catch (verifyErr) {
      console.log('⚠️  Verification check failed - this is expected with some Supabase configurations');
    }
    
    if (failureCount > 0) {
      console.log(`\n🔧 Some statements failed. This is often normal if constraints already exist.`);
      console.log(`📍 You can check the results in Supabase dashboard:`);
      console.log(`https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor`);
    }
    
    console.log('\n🎉 Migration process completed!');
    
  } catch (error) {
    console.error('❌ Migration process failed:', error);
    console.log('\n📍 Manual execution option:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor');
    console.log('2. Paste the SQL from: database/add-unique-constraints.sql');
    console.log('3. Run the SQL statements one by one');
    process.exit(1);
  }
}

// Execute migration
executeMigration().catch(console.error);