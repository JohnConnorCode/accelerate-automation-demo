#!/usr/bin/env npx tsx

/**
 * Database Migration Script using psql
 * Executes the unique constraints migration on Supabase using direct connection
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigrationWithPsql() {
  console.log('🚀 Starting database migration using psql...');
  
  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env');
    process.exit(1);
  }
  
  // Extract connection details from Supabase URL
  const url = new URL(supabaseUrl);
  const host = url.hostname;
  const database = 'postgres';
  const port = '5432';
  const user = 'postgres';
  const password = supabaseServiceKey;
  
  console.log(`📡 Connecting to: ${host}`);
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../database/add-unique-constraints.sql');
    console.log(`📄 Reading migration from: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Create a temporary SQL file for psql execution
    const tempSqlFile = '/tmp/migration.sql';
    require('fs').writeFileSync(tempSqlFile, migrationSQL);
    
    console.log('📝 Migration SQL loaded, executing with psql...');
    
    // Set up connection string for psql
    const connectionString = `postgresql://postgres:${password}@${host}:${port}/${database}`;
    
    try {
      // Execute the migration using psql
      const result = execSync(`psql "${connectionString}" -f ${tempSqlFile}`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Migration executed successfully!');
      console.log('📋 Output:');
      console.log(result);
      
      // Run verification query
      console.log('🔍 Verifying constraints were added...');
      const verificationSQL = `
        SELECT 
          tc.table_name, 
          tc.constraint_name, 
          tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.table_name IN ('queue_projects', 'queue_investors', 'queue_news', 'projects', 'funding_programs', 'resources')
          AND tc.constraint_type = 'UNIQUE'
        ORDER BY tc.table_name, tc.constraint_name;
      `;
      
      const verifyResult = execSync(`psql "${connectionString}" -c "${verificationSQL}"`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      console.log('✅ Verification complete. Unique constraints found:');
      console.log(verifyResult);
      
      // Clean up temp file
      require('fs').unlinkSync(tempSqlFile);
      
    } catch (error: any) {
      console.error('❌ Migration failed:', error.message);
      console.log('📝 Error output:');
      console.log(error.stdout || error.stderr);
      
      // Clean up temp file
      if (require('fs').existsSync(tempSqlFile)) {
        require('fs').unlinkSync(tempSqlFile);
      }
      
      console.log('📍 You can try running the SQL manually in Supabase SQL editor:');
      console.log('https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    console.log('📝 Please run the SQL statements manually in Supabase SQL editor.');
    console.log('📍 Migration file location: database/add-unique-constraints.sql');
    process.exit(1);
  }
}

// Execute migration
runMigrationWithPsql().catch(console.error);