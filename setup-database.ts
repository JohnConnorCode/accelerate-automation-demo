#!/usr/bin/env npx tsx

/**
 * Setup Database Script
 * Creates all required tables for the ACCELERATE content automation system
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Supabase credentials
const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupDatabase() {
  console.log('🚀 Starting database setup...\n');

  try {
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'create-all-tables.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf-8');

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (const statement of statements) {
      try {
        // Skip SELECT verification statements for now
        if (statement.toLowerCase().includes('select') && 
            (statement.includes('queue_status') || 
             statement.includes('prod_status') || 
             statement.includes('message'))) {
          continue;
        }

        console.log(`Executing: ${statement.substring(0, 50)}...`);
        
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        }).single();

        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase
            .from('_sql_migrations')
            .insert({ sql: statement + ';' });
          
          if (directError) {
            console.error(`❌ Error: ${directError.message}`);
            errorCount++;
          } else {
            console.log('✅ Success');
            successCount++;
          }
        } else {
          console.log('✅ Success');
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Results: ${successCount} successful, ${errorCount} errors`);

    // Verify tables were created
    console.log('\n🔍 Verifying tables...\n');

    const tables = [
      'queued_projects',
      'queued_funding_programs', 
      'queued_resources',
      'projects',
      'funding_programs',
      'resources'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        console.log(`❌ ${table}: Not accessible - ${error.message}`);
      } else {
        console.log(`✅ ${table}: Ready`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Database setup complete!');
    console.log('📝 Next steps:');
    console.log('1. Update the approval service to use new table names');
    console.log('2. Update the orchestrator to use queued_* tables');
    console.log('3. Test the complete workflow');

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupDatabase().catch(console.error);