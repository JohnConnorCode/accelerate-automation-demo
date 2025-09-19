#!/usr/bin/env node

/**
 * Direct SQL execution using PostgreSQL connection
 * Backup method if Supabase client methods fail
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// PostgreSQL connection details for Supabase
const DB_CONFIG = {
  host: 'aws-0-us-east-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.eqpfvmwmdtsgddpsodsr',
  password: process.env.SUPABASE_DB_PASSWORD || 'your-db-password',
  ssl: { rejectUnauthorized: false }
};

async function executeDirectSQL() {
  console.log('🔗 Attempting direct PostgreSQL connection...');

  try {
    // Try to install pg if not available
    const { Client } = require('pg');

    const client = new Client(DB_CONFIG);
    await client.connect();

    console.log('✅ Connected to PostgreSQL database');

    // Read SQL file
    const sqlPath = join(__dirname, 'create-essential-tables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');

    // Execute the SQL
    console.log('📝 Executing SQL migration...');
    const result = await client.query(sqlContent);

    console.log('✅ SQL executed successfully');
    console.log('📊 Result:', result);

    await client.end();
    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('pg')) {
      console.log('📦 Installing pg package...');
      const { execSync } = require('child_process');
      execSync('npm install pg @types/pg', { stdio: 'inherit' });
      console.log('✅ pg package installed, retrying...');
      return executeDirectSQL();
    }

    console.error('❌ Direct SQL execution failed:', error);
    throw error;
  }
}

// Export for use in other scripts
export { executeDirectSQL };

// Run if called directly
if (require.main === module) {
  executeDirectSQL().catch(console.error);
}