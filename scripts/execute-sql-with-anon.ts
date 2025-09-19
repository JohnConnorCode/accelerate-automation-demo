#!/usr/bin/env node

/**
 * Execute SQL migration using anon key and RPC functions
 * This approach works with the anon key we have available
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

async function executeMigration() {
  console.log('🚀 Starting database migration with anon key...');

  try {
    // Create Supabase client with anon key
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Read the SQL file
    const sqlPath = join(__dirname, 'create-essential-tables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    console.log('📖 Read SQL file successfully');

    // Split SQL into individual CREATE TABLE statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && stmt.toUpperCase().includes('CREATE TABLE'));

    console.log(`🔍 Found ${statements.length} CREATE TABLE statements`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each CREATE TABLE statement using direct HTTP API
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      console.log(`\n📝 Executing statement ${i + 1}/${statements.length}:`);
      const tableName = extractTableName(statement);
      console.log(`   Creating table: ${tableName}`);

      try {
        // Try direct SQL execution via HTTP
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            sql: statement + ';'
          })
        });

        if (response.ok) {
          console.log(`   ✅ Success`);
          successCount++;
        } else {
          // Try alternative approach - create table by inserting into information_schema
          console.log(`   ⚠️  Direct SQL failed, trying alternative...`);

          // Check if table already exists
          const { data: existingTable, error: checkError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (!checkError) {
            console.log(`   ✅ Table ${tableName} already exists`);
            successCount++;
          } else {
            console.log(`   ❌ Failed to create ${tableName}: ${await response.text()}`);
            errorCount++;
          }
        }

      } catch (err) {
        console.log(`   ❌ Error: ${err.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successful statements: ${successCount}`);
    console.log(`   ❌ Failed statements: ${errorCount}`);

    // If we couldn't create tables directly, let's try a different approach
    if (errorCount > 0) {
      console.log('\n🔄 Trying alternative approach using individual table creation...');
      await createTablesIndividually(supabase);
    }

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    await verifyTables(supabase);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

function extractTableName(sql: string): string {
  const match = sql.match(/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)/i);
  return match ? match[1] : 'unknown';
}

async function createTablesIndividually(supabase: any) {
  const tablesToCreate = [
    {
      name: 'api_cache',
      columns: `
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        cache_key VARCHAR(255) UNIQUE NOT NULL,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    },
    {
      name: 'search_analytics',
      columns: `
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        query TEXT NOT NULL,
        results_count INTEGER DEFAULT 0,
        response_time INTEGER,
        user_id UUID,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    },
    {
      name: 'monitoring_metrics',
      columns: `
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        value NUMERIC NOT NULL,
        unit VARCHAR(50),
        tags JSONB,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    },
    {
      name: 'rate_limit_violations',
      columns: `
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        ip_address INET NOT NULL,
        endpoint VARCHAR(255),
        violation_count INTEGER DEFAULT 1,
        violation_type VARCHAR(50),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    },
    {
      name: 'error_logs',
      columns: `
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        error_type VARCHAR(100),
        error_message TEXT,
        stack_trace TEXT,
        context JSONB,
        severity VARCHAR(20),
        service VARCHAR(100),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      `
    }
  ];

  for (const table of tablesToCreate) {
    console.log(`\n🔨 Creating ${table.name} via HTTP...`);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          query: `CREATE TABLE IF NOT EXISTS ${table.name} (${table.columns})`
        })
      });

      if (response.ok) {
        console.log(`   ✅ ${table.name} created successfully`);
      } else {
        console.log(`   ⚠️  ${table.name} creation via HTTP failed: ${await response.text()}`);
      }
    } catch (err) {
      console.log(`   ❌ ${table.name} error: ${err.message}`);
    }
  }
}

async function verifyTables(supabase: any) {
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
    console.log('\n💡 Try running the SQL manually in Supabase dashboard > SQL Editor');
  }
}

// Execute migration
executeMigration().catch(console.error);