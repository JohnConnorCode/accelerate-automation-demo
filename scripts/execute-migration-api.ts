#!/usr/bin/env npx tsx

import { readFileSync } from 'fs';
import path from 'path';

// This script needs a Supabase access token from the dashboard
// Get it from: https://supabase.com/dashboard/account/tokens

const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN');
  console.error('\nTo get an access token:');
  console.error('1. Go to https://supabase.com/dashboard/account/tokens');
  console.error('2. Generate a new access token');
  console.error('3. Run: export SUPABASE_ACCESS_TOKEN="your-token-here"');
  console.error('4. Run this script again');
  process.exit(1);
}

async function executeMigration() {
  console.log('🚀 Executing database migration via Supabase Management API...\n');
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'database', 'create-queue-tables.sql');
  const migrationSQL = readFileSync(migrationPath, 'utf-8');
  
  // Supabase Management API endpoint
  const apiUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: migrationSQL
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    console.log('✅ Migration executed successfully!');
    console.log('Result:', result);
    
    // Verify tables were created
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
      ORDER BY table_name;
    `;
    
    console.log('\n🔍 Verifying tables...');
    const verifyResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: verifyQuery })
    });
    
    if (verifyResponse.ok) {
      const tables = await verifyResponse.json();
      console.log('✅ Tables found:', tables);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nAlternative: Use the Supabase dashboard SQL editor');
    console.error('URL: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor');
  }
}

executeMigration();