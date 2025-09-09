#!/usr/bin/env npx tsx

import { Client } from 'pg';
import * as fs from 'fs';

async function createQueueTablesDirect() {
  console.log('🚀 CREATING QUEUE TABLES VIA DIRECT DATABASE CONNECTION\n');
  console.log('='.repeat(60));

  // Database connection using the Supabase database URL format
  const client = new Client({
    host: 'db.eqpfvmwmdtsgddpsodsr.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'LHvECRa7m6pLJHMHc8RGDKQGqYRZ2Ufz', // This would need to be the actual password
    ssl: true
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read the migration file
    const migrationFile = './supabase/migrations/20250909165620_create_queue_tables.sql';
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    console.log('\n📄 Migration file loaded successfully');
    console.log(`📊 File size: ${sqlContent.length} characters`);

    // Execute the entire SQL content
    console.log('\n🏃 Executing SQL migration...');
    const result = await client.query(sqlContent);
    console.log('✅ SQL executed successfully');

    // Verify tables were created
    console.log('\n📊 Verifying table creation...');
    
    const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
    
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public'`);
        const exists = parseInt(result.rows[0].count) > 0;
        
        if (exists) {
          console.log(`   ✅ Table ${table}: EXISTS`);
          
          // Check row count
          const countResult = await client.query(`SELECT COUNT(*) FROM ${table}`);
          const rowCount = countResult.rows[0].count;
          console.log(`      📊 Row count: ${rowCount}`);
        } else {
          console.log(`   ❌ Table ${table}: DOES NOT EXIST`);
        }
      } catch (error: any) {
        console.log(`   ❌ Table ${table}: ERROR - ${error.message}`);
      }
    }

    console.log('\n🎉 Queue tables creation completed successfully!');

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n🔑 PASSWORD ISSUE:');
      console.log('The database password is not available in this context.');
      console.log('Please use one of these alternatives:\n');
    } else if (error.message.includes('no pg_hba.conf entry')) {
      console.log('\n🛡️  CONNECTION SECURITY:');
      console.log('Direct connection may be restricted by Supabase security settings.');
      console.log('Please use one of these alternatives:\n');
    }
    
    console.log('📝 RECOMMENDED APPROACH - Manual Execution:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
    console.log('2. Copy contents from: supabase/migrations/20250909165620_create_queue_tables.sql');
    console.log('3. Paste and click RUN');
    
    console.log('\n⚡ OR use Supabase CLI:');
    console.log('   supabase db push --linked');
    
  } finally {
    try {
      await client.end();
      console.log('\n🔌 Database connection closed');
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

createQueueTablesDirect().catch(console.error);