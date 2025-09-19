#!/usr/bin/env npx tsx

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeSQLViaMCP() {
  console.log('🚀 Executing SQL migration via Supabase MCP...\n');

  // Read the SQL file
  const sqlPath = path.join(__dirname, 'create-essential-tables.sql');
  const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

  // Parse SQL into individual statements
  const statements = sqlContent
    .replace(/--.*$/gm, '') // Remove comments
    .split(/;\s*(?=\n|$)/)
    .filter(s => s.trim())
    .map(s => s.trim() + ';');

  console.log(`📋 Found ${statements.length} SQL statements\n`);

  // Use Supabase CLI with the access token
  const projectRef = 'eqpfvmwmdtsgddpsodsr';
  const accessToken = 'sbp_bc088a6cbce802f3f5c688f62acf388ad7e72e5f';

  // Install Supabase CLI if needed
  try {
    await execAsync('supabase --version');
    console.log('✅ Supabase CLI found\n');
  } catch {
    console.log('📦 Installing Supabase CLI...');
    await execAsync('npm install -g supabase');
    console.log('✅ Supabase CLI installed\n');
  }

  // Execute the SQL
  const tempFile = path.join(__dirname, 'temp_migration.sql');
  fs.writeFileSync(tempFile, sqlContent);

  try {
    // Execute using Supabase CLI
    const cmd = `SUPABASE_ACCESS_TOKEN="${accessToken}" supabase db push --db-url "postgres://postgres.${projectRef}:postgres@aws-0-us-west-1.pooler.supabase.com:5432/postgres" < "${tempFile}"`;

    console.log('⏳ Executing migration...\n');
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    if (stdout) console.log('📄 Output:', stdout);
    if (stderr && !stderr.includes('already exists')) {
      console.log('⚠️  Warnings:', stderr);
    }

    console.log('\n✅ Migration executed successfully!');
  } catch (error: any) {
    console.error('❌ Error executing migration:', error.message);

    // Try alternative approach using curl
    console.log('\n🔄 Trying alternative approach using REST API...\n');

    for (let i = 0; i < Math.min(statements.length, 5); i++) {
      const stmt = statements[i];
      if (!stmt || stmt === ';') continue;

      try {
        const response = await fetch(`https://${projectRef}.supabase.co/rest/v1/`, {
          method: 'POST',
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI',
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: stmt })
        });

        console.log(`Statement ${i+1}: ${response.ok ? '✅' : '❌'}`);
      } catch (err) {
        console.log(`Statement ${i+1}: ❌`);
      }
    }
  } finally {
    // Clean up temp file
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }

  // Verify tables using the anon key
  console.log('\n🔍 Verifying table creation...\n');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
  );

  const tablesToCheck = [
    'api_cache',
    'search_analytics',
    'monitoring_metrics',
    'system_settings',
    'resources',
    'funding_programs',
    'error_logs',
    'fetch_history'
  ];

  for (const table of tablesToCheck) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      console.log(`${error ? '❌' : '✅'} ${table}: ${error ? 'Not accessible' : 'Exists'}`);
    } catch {
      console.log(`❌ ${table}: Error`);
    }
  }
}

executeSQLViaMCP().catch(console.error);