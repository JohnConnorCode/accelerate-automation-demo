#!/usr/bin/env tsx

import { supabase } from '../src/lib/supabase-client';

async function checkTables() {
  // Try different table names
  const tables = ['accelerate_startups', 'accelerate_projects', 'projects_live'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (!error) {
        console.log(`✅ Table exists: ${table}`);
      } else {
        console.log(`❌ Table not found or error: ${table} - ${error.code}`);
      }
    } catch (e) {
      console.log(`❌ Error checking ${table}`);
    }
  }
}

checkTables();
