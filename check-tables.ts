#!/usr/bin/env npx tsx

import { supabase } from './src/lib/supabase-client';

async function checkTables() {
  console.log('🔍 CHECKING DATABASE STATE...\n');
  
  const tables = [
    // Current (old) system
    { name: 'content_queue', type: 'OLD SYSTEM' },
    
    // Staging tables (new)
    { name: 'queued_projects', type: 'NEW STAGING' },
    { name: 'queued_funding_programs', type: 'NEW STAGING' },
    { name: 'queued_resources', type: 'NEW STAGING' },
    
    // Production tables
    { name: 'projects', type: 'PRODUCTION' },
    { name: 'funding_programs', type: 'PRODUCTION' },
    { name: 'resources', type: 'PRODUCTION' }
  ];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ ${table.name.padEnd(25)} [${table.type}] - DOES NOT EXIST`);
    } else {
      console.log(`✅ ${table.name.padEnd(25)} [${table.type}] - ${count || 0} items`);
    }
  }
  
  console.log('\n📊 REALITY CHECK:');
  console.log('- Staging tables (queued_*) probably DON\'T EXIST');
  console.log('- System still uses content_queue (old single table)');
  console.log('- Need to execute create-staging-tables.sql first');
}

checkTables().catch(console.error);