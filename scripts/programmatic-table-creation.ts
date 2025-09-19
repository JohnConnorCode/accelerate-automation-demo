#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';

// Direct PostgreSQL execution using pg library
async function createTablesDirectly() {
  console.log('🚀 Creating tables programmatically...\n');

  const { Client } = await import('pg');

  // Parse connection details from Supabase URL
  const supabaseUrl = 'eqpfvmwmdtsgddpsodsr';

  // Try different connection strings
  const connectionStrings = [
    // Direct connection with pooler
    `postgresql://postgres.${supabaseUrl}:postgres@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
    // Transaction mode
    `postgresql://postgres.${supabaseUrl}:postgres@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`,
    // Session mode
    `postgresql://postgres.${supabaseUrl}:postgres@aws-0-us-west-1.pooler.supabase.com:5432/postgres?sslmode=require`
  ];

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse into individual statements
  const statements = sqlContent
    .split(/;\s*(?=\n|$)/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + (s.endsWith(';') ? '' : ';'));

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  // Try each connection string
  for (const connStr of connectionStrings) {
    console.log(`🔌 Trying connection method ${connectionStrings.indexOf(connStr) + 1}/3...`);

    const client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log('✅ Connected to database\n');

      let successCount = 0;
      let errorCount = 0;

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        // Extract operation name
        let opName = 'Operation';
        if (stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)) {
          opName = `Table: ${stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1]}`;
        } else if (stmt.match(/CREATE INDEX (\w+)/i)) {
          opName = `Index: ${stmt.match(/CREATE INDEX (\w+)/i)?.[1]}`;
        } else if (stmt.includes('INSERT')) {
          opName = 'Insert defaults';
        } else if (stmt.includes('GRANT')) {
          opName = 'Grant permissions';
        } else if (stmt.includes('CREATE POLICY')) {
          opName = 'Create policy';
        } else if (stmt.includes('ALTER TABLE')) {
          opName = 'Enable RLS';
        } else if (stmt.includes('CREATE TRIGGER')) {
          opName = 'Create trigger';
        } else if (stmt.includes('CREATE OR REPLACE FUNCTION')) {
          opName = 'Create function';
        }

        process.stdout.write(`[${i+1}/${statements.length}] ${opName}... `);

        try {
          await client.query(stmt);
          console.log('✅');
          successCount++;
        } catch (error: any) {
          if (error.message?.includes('already exists')) {
            console.log('⏭️  (exists)');
            successCount++;
          } else {
            console.log(`❌ ${error.code || error.message}`);
            errorCount++;
          }
        }
      }

      console.log(`\n📊 Results: ${successCount} successful, ${errorCount} failed\n`);

      // Verify tables
      console.log('🔍 Verifying tables...\n');
      const tables = [
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

      let existingTables = 0;
      for (const table of tables) {
        try {
          const result = await client.query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = $1
            )`,
            [table]
          );

          if (result.rows[0].exists) {
            console.log(`✅ ${table}: Exists`);
            existingTables++;
          } else {
            console.log(`❌ ${table}: Not found`);
          }
        } catch (err) {
          console.log(`❌ ${table}: Error checking`);
        }
      }

      console.log(`\n🎯 Status: ${existingTables}/15 tables exist`);

      if (existingTables === 15) {
        console.log('🎉 All tables created successfully!');
        await client.end();
        return true;
      }

      await client.end();
    } catch (error: any) {
      console.log(`❌ Connection failed: ${error.message}\n`);
    }
  }

  return false;
}

// Execute
createTablesDirectly().then(success => {
  if (!success) {
    console.log('\n⚠️  Could not connect with available credentials.');
    console.log('\n📝 Solution: We need the service role key.');
    console.log('\n1. Go to Vercel Dashboard');
    console.log('2. Add SUPABASE_SERVICE_ROLE_KEY environment variable');
    console.log('3. Get the key from Supabase dashboard: Settings > API > service_role key');
  }
}).catch(console.error);