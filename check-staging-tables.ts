#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

async function checkStagingTables() {
  console.log('🔍 CHECKING STAGING TABLES...\n');
  
  // Test different table names that might exist
  const possibleTables = [
    'queued_projects',
    'queued_funding_programs', 
    'queued_resources',
    'content_queue',
    'staging_projects',
    'staging_funding_programs',
    'staging_resources'
  ];
  
  for (const table of possibleTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ ${table}: Table does not exist`);
        } else {
          console.log(`⚠️ ${table}: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table}: EXISTS with ${count || 0} items`);
      }
    } catch (err) {
      console.log(`❌ ${table}: Connection error`);
    }
  }
  
  console.log('\n🔍 Checking what tables actually exist...');
  
  // Let's try to get the table schema information
  const { data, error } = await supabase.rpc('get_tables');
  
  if (error) {
    console.log('   Cannot get table list via RPC:', error.message);
  } else if (data) {
    console.log('   Available tables:', data);
  }
}

checkStagingTables().catch(console.error);