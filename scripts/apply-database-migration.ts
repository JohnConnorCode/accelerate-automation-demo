#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function executeMigration() {
  console.log('🚀 Starting database migration...\n');
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'add-unique-constraints.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  // Split into individual statements (removing comments and empty lines)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 10)
    .map(s => s + ';');
  
  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
  
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip comments and verification queries
    if (statement.includes('SELECT') && statement.includes('information_schema')) {
      console.log(`⏭️  Skipping verification query ${i + 1}`);
      continue;
    }
    
    // Get a description of what we're doing
    let description = 'SQL statement';
    if (statement.includes('ALTER TABLE queue_projects')) {description = 'Adding unique constraint to queue_projects';}
    else if (statement.includes('ALTER TABLE queue_investors')) {description = 'Adding unique constraint to queue_investors';}
    else if (statement.includes('ALTER TABLE queue_news')) {description = 'Adding unique constraint to queue_news';}
    else if (statement.includes('ALTER TABLE projects')) {description = 'Adding unique constraint to projects';}
    else if (statement.includes('ALTER TABLE funding_programs')) {description = 'Adding unique constraint to funding_programs';}
    else if (statement.includes('ALTER TABLE resources')) {description = 'Adding unique constraint to resources';}
    else if (statement.includes('CREATE INDEX')) {description = 'Creating index';}
    else if (statement.includes('CREATE OR REPLACE FUNCTION')) {description = 'Creating cleanup function';}
    else if (statement.includes('COMMENT ON')) {description = 'Adding comment';}
    
    process.stdout.write(`${i + 1}/${statements.length}: ${description}... `);
    
    try {
      // Use rpc to execute raw SQL
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement 
      }).catch(async (err) => {
        // If exec_sql doesn't exist, try a different approach
        // We'll check if the constraint already exists first
        if (statement.includes('ADD CONSTRAINT')) {
          const tableName = statement.match(/ALTER TABLE (\w+)/)?.[1];
          const constraintName = statement.match(/CONSTRAINT (\w+)/)?.[1];
          
          if (tableName && constraintName) {
            // Check if constraint exists
            const { data: existing } = await supabase
              .from('information_schema.table_constraints')
              .select('*')
              .eq('table_name', tableName)
              .eq('constraint_name', constraintName)
              .single();
            
            if (existing) {
              return { error: null, alreadyExists: true };
            }
          }
        }
        
        // For other statements, we need to handle them differently
        throw err;
      });
      
      if (error) {
        // Check if it's because constraint already exists
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.code === '42710') {
          console.log('✓ Already exists');
          results.successful++;
        } else {
          console.log(`✗ Failed: ${error.message}`);
          results.failed++;
          results.errors.push(`Statement ${i + 1}: ${error.message}`);
        }
      } else {
        console.log('✓ Success');
        results.successful++;
      }
    } catch (err: any) {
      // Try alternative approach for constraints
      if (statement.includes('ADD CONSTRAINT') && statement.includes('UNIQUE')) {
        try {
          // Extract table and column
          const tableName = statement.match(/ALTER TABLE (\w+)/)?.[1];
          const columnName = 'url'; // All our constraints are on URL
          
          if (tableName) {
            // Check if we can at least query the table
            const { count, error: checkError } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            
            if (!checkError) {
              console.log('⚠️  Table exists but cannot add constraint via API');
              results.failed++;
              results.errors.push(`Cannot add constraint to ${tableName} via API - manual execution required`);
            } else {
              console.log(`✗ Table check failed: ${checkError.message}`);
              results.failed++;
              results.errors.push(`${tableName}: ${checkError.message}`);
            }
          }
        } catch (altErr: any) {
          console.log(`✗ Error: ${altErr.message}`);
          results.failed++;
          results.errors.push(`Statement ${i + 1}: ${altErr.message}`);
        }
      } else {
        console.log(`✗ Error: ${err.message}`);
        results.failed++;
        results.errors.push(`Statement ${i + 1}: ${err.message}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  Errors encountered:');
    results.errors.forEach(err => console.log(`  - ${err}`));
    
    console.log('\n💡 Note: Some operations require database admin privileges.');
    console.log('   You may need to execute the migration directly in Supabase dashboard:');
    console.log('   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor');
  }
  
  // Run verification query
  console.log('\n🔍 Verifying constraints...');
  const { data: constraints, error: verifyError } = await supabase
    .from('queue_projects')
    .select('url')
    .limit(0); // Just checking structure
  
  if (!verifyError) {
    console.log('✅ Database connection verified');
    
    // Try to check for duplicates
    const tables = ['queue_projects', 'queue_investors', 'queue_news'];
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('url, count:url.count()')
        .limit(1);
      
      if (!error) {
        console.log(`✅ ${table} is accessible`);
      }
    }
  } else {
    console.log(`⚠️  Verification issue: ${verifyError.message}`);
  }
}

// Run the migration
executeMigration().catch(console.error);