#!/usr/bin/env npx tsx

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

async function executeDirectly() {
  console.log('🚀 Executing SQL migration using Supabase CLI...\n');

  const accessToken = 'sbp_bc088a6cbce802f3f5c688f62acf388ad7e72e5f';
  const projectRef = 'eqpfvmwmdtsgddpsodsr';

  // First, ensure we're logged in
  console.log('1️⃣ Logging into Supabase...');
  try {
    await execAsync(`SUPABASE_ACCESS_TOKEN="${accessToken}" npx supabase login`);
    console.log('✅ Logged in\n');
  } catch (e) {
    console.log('⚠️  Already logged in or login not needed\n');
  }

  // Link to the project
  console.log('2️⃣ Linking to project...');
  try {
    await execAsync(`npx supabase link --project-ref ${projectRef} --password "${accessToken}"`);
    console.log('✅ Project linked\n');
  } catch (e) {
    console.log('⚠️  Project already linked or using existing link\n');
  }

  // Create a migration file in the proper location
  console.log('3️⃣ Creating migration...');

  // Ensure migrations directory exists
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Copy our SQL to a migration file
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14);
  const migrationFile = path.join(migrationsDir, `${timestamp}_create_essential_tables.sql`);

  const sqlContent = fs.readFileSync(path.join(__dirname, 'create-essential-tables.sql'), 'utf-8');
  fs.writeFileSync(migrationFile, sqlContent);
  console.log(`✅ Migration file created: ${migrationFile}\n`);

  // Push the migration
  console.log('4️⃣ Pushing migration to database...');
  try {
    const { stdout, stderr } = await execAsync(`npx supabase db push`);
    console.log('✅ Migration pushed successfully!\n');
    if (stdout) console.log('Output:', stdout);
    if (stderr && !stderr.includes('already exists')) console.log('Info:', stderr);
  } catch (error: any) {
    console.log('❌ Push failed:', error.message);
    console.log('\n🔄 Trying remote push...');

    try {
      const { stdout, stderr } = await execAsync(`npx supabase db push --db-url postgresql://postgres:${accessToken}@db.${projectRef}.supabase.co:5432/postgres`);
      console.log('✅ Remote push successful!\n');
      if (stdout) console.log('Output:', stdout);
    } catch (e: any) {
      console.log('❌ Remote push also failed:', e.message);
    }
  }

  // Verify tables
  console.log('\n5️⃣ Verifying tables...\n');

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    `https://${projectRef}.supabase.co`,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
  );

  const tables = [
    'api_cache', 'search_analytics', 'monitoring_metrics',
    'rate_limit_violations', 'error_logs', 'system_settings',
    'fetch_history', 'monitoring_alerts', 'tags',
    'resources', 'queue_resources', 'funding_programs',
    'queue_funding_programs', 'webhook_endpoints', 'webhook_deliveries'
  ];

  let working = 0;
  let missing = 0;

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ ${table}`);
        missing++;
      } else {
        console.log(`✅ ${table}`);
        working++;
      }
    } catch {
      console.log(`❌ ${table}`);
      missing++;
    }
  }

  console.log(`\n📊 Final Status: ${working}/15 tables exist`);

  if (working === 15) {
    console.log('🎉 All tables created successfully!');
  } else {
    console.log(`\n⚠️  ${missing} tables still missing`);
    console.log('\n📝 Alternative: Opening Supabase dashboard...');
    await execAsync('open https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
    console.log('Please paste and run the SQL from scripts/create-essential-tables.sql');
  }
}

executeDirectly().catch(console.error);