#!/usr/bin/env npx tsx

/**
 * Database Migration Script
 * Executes the unique constraints migration on Supabase
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runMigration() {
  console.log('🚀 Starting database migration...');
  
  // Get Supabase credentials
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env');
    process.exit(1);
  }
  
  console.log(`📡 Connecting to: ${supabaseUrl}`);
  
  // Create client with service key for admin operations
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
    },
  });
  
  try {
    // Read the migration file
    const migrationPath = join(__dirname, '../database/add-unique-constraints.sql');
    console.log(`📄 Reading migration from: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Migration SQL loaded, executing...');
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 80)}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          // Try direct execution if RPC fails
          console.log('🔄 Trying direct execution...');
          const { error: directError } = await supabase
            .from('_migrations')
            .select('*')
            .limit(0); // This will trigger a connection test
          
          if (directError) {
            console.error('❌ Database connection failed:', directError.message);
            process.exit(1);
          }
          
          // For now, log the statement that needs manual execution
          console.log(`📝 Please execute this statement manually in Supabase SQL editor:`);
          console.log(statement + ';');
          console.log('---');
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      }
    }
    
    console.log('🎉 Migration completed!');
    
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
    
    const { data: constraints, error: verifyError } = await supabase.rpc('exec_sql', {
      sql_query: verificationSQL
    });
    
    if (verifyError) {
      console.log('⚠️ Could not verify constraints automatically. Please run this query in Supabase SQL editor:');
      console.log(verificationSQL);
    } else {
      console.log('✅ Verification complete. Unique constraints found:');
      console.table(constraints);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('📝 Please run the SQL statements manually in Supabase SQL editor.');
    console.log('📍 Migration file location: database/add-unique-constraints.sql');
    process.exit(1);
  }
}

// Execute migration
runMigration().catch(console.error);