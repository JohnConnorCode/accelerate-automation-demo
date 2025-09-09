#!/usr/bin/env npx tsx

import * as fs from 'fs';

async function executeSQLViaREST() {
  console.log('🚀 ATTEMPTING SQL EXECUTION VIA SUPABASE REST API\n');
  console.log('='.repeat(60));

  const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

  try {
    // Read the migration file
    const migrationFile = './supabase/migrations/20250909165620_create_queue_tables.sql';
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    
    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');
    console.log('📄 Migration file loaded');
    console.log(`📊 Size: ${sqlContent.length} characters`);

    // Try executing via different REST endpoints
    const endpoints = [
      '/rest/v1/rpc/exec_sql',
      '/rest/v1/rpc/exec',
      '/database/v1/query'
    ];

    for (const endpoint of endpoints) {
      console.log(`\n🔍 Trying endpoint: ${endpoint}`);
      
      try {
        const response = await fetch(`${supabaseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            sql: sqlContent
          })
        });

        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const result = await response.text();
          console.log(`   ✅ Success! Response: ${result.substring(0, 100)}...`);
          break;
        } else {
          const error = await response.text();
          console.log(`   ❌ Failed: ${error.substring(0, 200)}...`);
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Try to verify if any tables were created
    console.log('\n📊 Checking table existence via REST API...');
    
    const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
    
    for (const table of tables) {
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=id&limit=1`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Range': '0-0'
          }
        });
        
        if (response.status === 200) {
          console.log(`   ✅ Table ${table}: EXISTS and accessible`);
        } else if (response.status === 406) {
          console.log(`   ❌ Table ${table}: DOES NOT EXIST (406 Not Acceptable)`);
        } else {
          const errorText = await response.text();
          console.log(`   ❌ Table ${table}: ${response.status} - ${errorText.substring(0, 100)}`);
        }
      } catch (error: any) {
        console.log(`   ❌ Table ${table}: ERROR - ${error.message}`);
      }
    }

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
  }

  // Always provide manual instructions as fallback
  console.log('\n📝 RELIABLE MANUAL APPROACH:');
  console.log('Since programmatic SQL execution has limitations, please:');
  console.log('');
  console.log('1. 🌐 Open: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('2. 📋 Copy ALL content from: supabase/migrations/20250909165620_create_queue_tables.sql');
  console.log('3. 📝 Paste it into the SQL Editor');
  console.log('4. ▶️  Click RUN button');
  console.log('5. ✅ Verify success message');
  console.log('');
  console.log('📄 The file contains:');
  console.log('   • DROP statements (cleanup)');
  console.log('   • 3 CREATE TABLE statements');
  console.log('   • CREATE INDEX statements');
  console.log('   • GRANT permissions');
  console.log('   • RLS policies');
  console.log('');
  console.log('🔄 After manual execution, run the check script again:');
  console.log('   npx tsx execute-queue-tables.ts');
}

executeSQLViaREST().catch(console.error);