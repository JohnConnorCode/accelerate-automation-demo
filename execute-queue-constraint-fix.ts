#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function executeQueueConstraintFix() {
  console.log('🔧 EXECUTING QUEUE CONSTRAINT FIX...\n');
  
  // Test current state
  console.log('1️⃣ Testing current constraint state...');
  
  const timestamp = Date.now();
  
  // Test queue_projects with minimal data that should trigger constraints
  console.log('   Testing queue_projects...');
  const { error: projectError } = await supabase
    .from('queue_projects')
    .insert({
      name: 'Pre-Fix Test',
      description: 'Short', // Should trigger constraint
      source: 'pre-fix-test'
    });
  
  if (projectError) {
    console.log('   ❌ Constraint blocking (expected):', projectError.message || 'Undefined error');
  } else {
    console.log('   ✅ No constraints blocking - already fixed?');
    // Clean up
    await supabase.from('queue_projects').delete().eq('source', 'pre-fix-test');
  }
  
  console.log('\n2️⃣ CONSTRAINTS FIX REQUIRED');
  console.log('   Since we cannot execute ALTER TABLE via Supabase client,');
  console.log('   you need to run the SQL manually in Supabase Dashboard.\n');
  
  console.log('🔗 GO TO: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new\n');
  
  console.log('📝 COPY AND EXECUTE THIS SQL:');
  console.log('=' .repeat(60));
  
  // Read and display the SQL file
  try {
    const sqlContent = fs.readFileSync('fix-queue-constraints.sql', 'utf8');
    console.log(sqlContent);
  } catch (err) {
    console.log('❌ Could not read fix-queue-constraints.sql');
    console.log('   Please run the following SQL manually:');
    console.log(`
-- Fix queue_projects constraints
ALTER TABLE queue_projects DROP CONSTRAINT IF EXISTS queue_projects_description_check;
ALTER TABLE queue_projects ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queue_projects DROP CONSTRAINT IF EXISTS queue_projects_status_check;

-- Fix queue_funding_programs constraints  
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_description_check;
ALTER TABLE queue_funding_programs ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_funding_type_check;
ALTER TABLE queue_funding_programs DROP CONSTRAINT IF EXISTS queue_funding_programs_status_check;

-- Fix queue_resources constraints
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_description_check;
ALTER TABLE queue_resources ALTER COLUMN description DROP NOT NULL;
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_resource_type_check;
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_price_type_check;
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_difficulty_level_check;
ALTER TABLE queue_resources DROP CONSTRAINT IF EXISTS queue_resources_status_check;
    `);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n3️⃣ AFTER RUNNING THE SQL, TEST WITH:');
  console.log('   npx tsx verify-queue-constraints-fixed.ts\n');
  
  // Also test the other queue table access
  console.log('4️⃣ Current queue table status:');
  const tables = ['queue_projects', 'queue_funding_programs', 'queue_resources'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`   ❌ ${table}: ${error.message}`);
      } else {
        console.log(`   ✅ ${table}: Accessible with ${count || 0} items`);
      }
    } catch (err) {
      console.log(`   ❌ ${table}: Exception occurred`);
    }
  }
}

executeQueueConstraintFix().catch(console.error);