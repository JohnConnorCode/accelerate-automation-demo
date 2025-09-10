require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkTables() {
  console.log('Checking which tables actually exist...\n');
  
  // Try each possible table
  const tables = [
    'queue_projects',
    'queue_investors', 
    'queue_funding_programs',
    'queue_news',
    'queue_resources',
    'projects',
    'funding_programs',
    'resources'
  ];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
      
    if (error && error.code === '42P01') {
      console.log(`❌ ${table} - DOES NOT EXIST`);
    } else if (error) {
      console.log(`⚠️  ${table} - Error: ${error.code} ${error.message}`);
    } else {
      console.log(`✅ ${table} - EXISTS`);
    }
  }
}

checkTables();
