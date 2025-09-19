#!/usr/bin/env node

/**
 * Execute SQL migration to create essential tables in Supabase
 * Uses service role key for elevated privileges
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

async function executeMigration() {
  console.log('🚀 Starting database migration...');

  try {
    // Create Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false
      }
    });

    // Read the SQL file
    const sqlPath = join(__dirname, 'create-essential-tables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    console.log('📖 Read SQL file successfully');
    console.log(`📊 SQL file contains ${sqlContent.split('\n').length} lines`);

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔍 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) {
        continue;
      }

      try {
        console.log(`\n📝 Executing statement ${i + 1}/${statements.length}:`);
        console.log(`   ${statement.substring(0, 80)}${statement.length > 80 ? '...' : ''}`);

        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // Try direct query if RPC fails
          const { data: directData, error: directError } = await supabase
            .from('pg_stat_database')
            .select('*')
            .limit(0); // This will fail but test connection

          if (directError) {
            console.log('   Trying alternative execution method...');

            // Use raw SQL execution
            const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'apikey': SUPABASE_SERVICE_ROLE_KEY
              },
              body: JSON.stringify({ sql: statement + ';' })
            });

            if (!result.ok) {
              throw new Error(`HTTP ${result.status}: ${await result.text()}`);
            }
          }
        }

        console.log(`   ✅ Success`);
        successCount++;

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;

        // Continue with next statement unless it's a critical error
        if (err.message.includes('already exists')) {
          console.log('   ℹ️  Table/function already exists, continuing...');
          successCount++; // Count as success since table exists
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful statements: ${successCount}`);
    console.log(`   ❌ Failed statements: ${errorCount}`);
    console.log(`   📈 Success rate: ${Math.round((successCount / (successCount + errorCount)) * 100)}%`);

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    await verifyTables(supabase);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function verifyTables(supabase) {
  const expectedTables = [
    'api_cache',
    'search_analytics',
    'monitoring_metrics',
    'rate_limit_violations',
    'error_logs',
    'system_settings',
    'fetch_history',
    'monitoring_alerts',
    'tags',
    'resources',
    'queue_resources',
    'funding_programs',
    'queue_funding_programs',
    'webhook_endpoints',
    'webhook_deliveries'
  ];

  let foundTables = 0;

  for (const tableName of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (!error) {
        console.log(`   ✅ ${tableName} - exists and accessible`);
        foundTables++;
      } else {
        console.log(`   ❌ ${tableName} - ${error.message}`);
      }
    } catch (err) {
      console.log(`   ❌ ${tableName} - ${err.message}`);
    }
  }

  console.log(`\n🎯 Tables verified: ${foundTables}/${expectedTables.length}`);

  if (foundTables === expectedTables.length) {
    console.log('🎉 All tables created successfully!');
  } else {
    console.log('⚠️  Some tables may not have been created properly.');
  }
}

// Execute migration
executeMigration().catch(console.error);