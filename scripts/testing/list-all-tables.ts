#!/usr/bin/env npx tsx

import { supabase } from '../../src/lib/supabase-client';

async function listTables() {
  // Try to query information_schema or pg_tables
  const { data, error } = await supabase
    .rpc('get_tables', {})
    .single();
  
  if (error) {
    console.log('Cannot query table list via RPC');
    
    // Fallback: try known tables
    const knownTables = [
      'content_queue',
      'projects', 
      'funding_programs',
      'resources',
      'api_keys',
      'curated_content',
      'users'
    ];
    
    console.log('\nChecking known tables:');
    for (const table of knownTables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error) {
        console.log(`✅ ${table.padEnd(20)} - ${count || 0} items`);
      }
    }
  } else {
    console.log('Tables:', data);
  }
}

listTables().catch(console.error);