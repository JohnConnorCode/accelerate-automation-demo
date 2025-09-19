#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function executeMigration() {
  console.log('🚀 Executing SQL migration...\n');

  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse SQL into individual statements
  const statements = sqlContent
    .replace(/--.*$/gm, '') // Remove comments
    .split(/;\s*(?=\n|$)/)
    .filter(s => s.trim())
    .map(s => s.trim() + ';');

  console.log(`📋 Executing ${statements.length} SQL statements...\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Skip empty statements
    if (!stmt || stmt === ';') continue;

    // Extract operation name for logging
    let opName = 'Operation';
    if (stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)) {
      opName = `CREATE TABLE ${stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1]}`;
    } else if (stmt.match(/CREATE INDEX (\w+)/i)) {
      opName = `CREATE INDEX ${stmt.match(/CREATE INDEX (\w+)/i)?.[1]}`;
    } else if (stmt.match(/INSERT INTO (\w+)/i)) {
      opName = `INSERT INTO ${stmt.match(/INSERT INTO (\w+)/i)?.[1]}`;
    } else if (stmt.match(/CREATE POLICY/i)) {
      opName = 'CREATE POLICY';
    } else if (stmt.match(/CREATE TRIGGER (\w+)/i)) {
      opName = `CREATE TRIGGER ${stmt.match(/CREATE TRIGGER (\w+)/i)?.[1]}`;
    } else if (stmt.match(/GRANT/i)) {
      opName = 'GRANT PERMISSIONS';
    } else if (stmt.match(/ALTER TABLE/i)) {
      opName = 'ALTER TABLE';
    } else if (stmt.match(/CREATE OR REPLACE FUNCTION/i)) {
      opName = 'CREATE FUNCTION';
    }

    process.stdout.write(`[${i+1}/${statements.length}] ${opName}... `);

    try {
      // Use Supabase's query execution through the REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: stmt })
      });

      if (!response.ok) {
        // Try alternative approach - direct SQL execution
        const altResponse = await fetch(`${SUPABASE_URL}/pg/query`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: stmt })
        });

        if (!altResponse.ok) {
          throw new Error(`HTTP ${altResponse.status}`);
        }
      }

      console.log('✅');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('⚠️  (already exists)');
      } else {
        console.log(`❌ ${error.message}`);
      }
    }
  }

  // Verify tables
  console.log('\n🔍 Verifying tables...\n');
  const tables = ['api_cache', 'system_settings', 'resources', 'funding_programs', 'error_logs'];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      console.log(`${error ? '❌' : '✅'} ${table}`);
    } catch {
      console.log(`❌ ${table}`);
    }
  }
}

executeMigration().catch(console.error);