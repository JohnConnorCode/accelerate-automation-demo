#!/usr/bin/env tsx

import { supabase } from '../src/lib/supabase-client';

async function clearAndTest() {
  console.log('🧹 Clearing database for real test...\n');
  
  // Clear all tables
  await supabase.from('queue_projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_resources').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('queue_investors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  
  console.log('✅ Database cleared');
  console.log('\nNow run: curl -X POST http://localhost:3002/api/scheduler/run -H "Content-Type: application/json" -d \'{"task":"content-fetch"}\'');
}

clearAndTest();
