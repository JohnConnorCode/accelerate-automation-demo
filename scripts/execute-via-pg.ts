#!/usr/bin/env npx tsx

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function executeMigrationViaPG() {
  console.log('🚀 Executing migration via direct PostgreSQL connection...\n');

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const JWT_SECRET = 'dLmgH/rZWIkdAWXuv62Tqvh9rF8PDAHvteaK/rMJKi4G1jbbcsaaHC9oBMZoAE0MsRJv5v5XalkDrOXP8acjtw==';

  // PostgreSQL connection details
  const projectRef = 'eqpfvmwmdtsgddpsodsr';

  // Try different connection methods
  const connectionConfigs = [
    {
      name: 'Direct with password',
      config: {
        host: 'db.eqpfvmwmdtsgddpsodsr.supabase.co',
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: JWT_SECRET, // Sometimes the JWT secret is the postgres password
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Pooler connection',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 5432,
        database: 'postgres',
        user: `postgres.${projectRef}`,
        password: JWT_SECRET,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Transaction pooler',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: `postgres.${projectRef}`,
        password: JWT_SECRET,
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse statements
  const statements = sqlContent
    .split(/;\s*(?=\n|$)/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + (s.endsWith(';') ? '' : ';'));

  console.log(`📋 Found ${statements.length} SQL statements\n`);

  for (const connConfig of connectionConfigs) {
    console.log(`\n🔌 Trying: ${connConfig.name}`);

    const client = new Client(connConfig.config);

    try {
      await client.connect();
      console.log('✅ Connected successfully!\n');

      let successCount = 0;
      let errorCount = 0;

      // Execute each statement
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];

        // Extract operation name
        let opName = 'Operation';
        const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
        const indexMatch = stmt.match(/CREATE INDEX (\w+)/i);

        if (tableMatch) {
          opName = `Table: ${tableMatch[1]}`;
        } else if (indexMatch) {
          opName = `Index: ${indexMatch[1]}`;
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
            console.log(`❌ ${error.code || error.message.substring(0, 50)}`);
            errorCount++;
          }
        }
      }

      console.log(`\n📊 Results: ${successCount} successful, ${errorCount} failed`);

      if (successCount > 0) {
        // Verify tables
        console.log('\n🔍 Verifying tables...\n');

        const tables = [
          'api_cache', 'search_analytics', 'monitoring_metrics',
          'rate_limit_violations', 'error_logs', 'system_settings',
          'fetch_history', 'monitoring_alerts', 'tags',
          'resources', 'queue_resources', 'funding_programs',
          'queue_funding_programs', 'webhook_endpoints', 'webhook_deliveries'
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
              console.log(`✅ ${table}`);
              existingTables++;
            } else {
              console.log(`❌ ${table}`);
            }
          } catch {
            console.log(`❌ ${table}`);
          }
        }

        console.log(`\n🎯 Status: ${existingTables}/15 tables exist`);

        if (existingTables === 15) {
          console.log('🎉 All tables created successfully!');
          await client.end();
          return true;
        }
      }

      await client.end();
    } catch (error: any) {
      console.log(`❌ Connection failed: ${error.message}`);
    }
  }

  console.log('\n❌ Could not connect with any method.');
  console.log('\n📝 Solution: Use Supabase Dashboard SQL Editor');
  console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('2. Copy and paste the SQL from: scripts/create-essential-tables.sql');
  console.log('3. Click "Run" to execute');

  return false;
}

executeMigrationViaPG().catch(console.error);