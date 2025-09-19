#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';

async function executeViaManagementAPI() {
  console.log('🚀 Executing SQL via Supabase Management API with access token...\n');

  const projectRef = 'eqpfvmwmdtsgddpsodsr';
  const accessToken = 'sbp_bc088a6cbce802f3f5c688f62acf388ad7e72e5f';

  // Read SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Split into smaller chunks to avoid size limits
  const statements = sqlContent
    .split(/;\s*(?=\n|$)/)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + (s.endsWith(';') ? '' : ';'));

  console.log(`📋 Executing ${statements.length} SQL statements...\n`);

  // Group statements by type for better execution
  const tableStatements = statements.filter(s => s.includes('CREATE TABLE'));
  const indexStatements = statements.filter(s => s.includes('CREATE INDEX'));
  const otherStatements = statements.filter(s =>
    !s.includes('CREATE TABLE') && !s.includes('CREATE INDEX')
  );

  console.log(`📊 Breakdown:`);
  console.log(`   - Tables: ${tableStatements.length}`);
  console.log(`   - Indexes: ${indexStatements.length}`);
  console.log(`   - Other: ${otherStatements.length}\n`);

  // Execute tables first
  console.log('1️⃣ Creating tables...\n');
  for (const stmt of tableStatements) {
    const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i)?.[1] || 'unknown';
    process.stdout.write(`   Creating ${tableName}... `);

    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: stmt })
      });

      if (response.ok) {
        console.log('✅');
      } else {
        const errorText = await response.text();
        if (errorText.includes('already exists')) {
          console.log('⏭️  (exists)');
        } else {
          console.log(`❌ ${response.status}`);
          // Log error details for diagnosis
          console.log(`      Error: ${errorText.substring(0, 100)}`);
        }
      }
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
    }
  }

  // Try using Supabase CLI with the access token
  console.log('\n2️⃣ Attempting via Supabase CLI...\n');

  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // First, try to link the project
    console.log('   Linking project...');
    await execAsync(`SUPABASE_ACCESS_TOKEN="${accessToken}" npx supabase link --project-ref ${projectRef}`);
    console.log('   ✅ Project linked\n');

    // Now try to push the migration
    console.log('   Pushing migration...');
    const tempFile = path.join(__dirname, 'migration_temp.sql');
    fs.writeFileSync(tempFile, sqlContent);

    await execAsync(`SUPABASE_ACCESS_TOKEN="${accessToken}" npx supabase db push --file ${tempFile}`);
    console.log('   ✅ Migration pushed\n');

    // Clean up
    fs.unlinkSync(tempFile);
  } catch (error: any) {
    console.log(`   ❌ CLI approach failed: ${error.message}\n`);
  }

  // Verify what we have
  console.log('3️⃣ Verifying current state...\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
  );

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

  let working = 0;
  let notWorking = 0;
  const missingTables: string[] = [];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`   ❌ ${table}`);
        missingTables.push(table);
        notWorking++;
      } else {
        console.log(`   ✅ ${table}`);
        working++;
      }
    } catch {
      console.log(`   ❌ ${table}`);
      missingTables.push(table);
      notWorking++;
    }
  }

  console.log(`\n📊 Status: ${working}/15 tables accessible\n`);

  if (notWorking > 0) {
    console.log('🔧 Missing tables:', missingTables.join(', '));
    console.log('\n💡 Solution: We need the service role key to create these tables.');
    console.log('\n📝 To get the service role key:');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/settings/api');
    console.log('2. Copy the "service_role" key (not the anon key)');
    console.log('3. Add to Vercel: vercel env add SUPABASE_SERVICE_ROLE_KEY');
    console.log('4. Or add to .env.local: SUPABASE_SERVICE_ROLE_KEY=<key>');
    console.log('\nThe service role key starts with eyJ and has "role":"service_role" in its payload.');
  } else {
    console.log('🎉 All tables are accessible!');
  }
}

executeViaManagementAPI().catch(console.error);