const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkTables() {
  // Check if content_curated table exists
  const { data, error } = await supabase
    .from('content_curated')
    .select('*')
    .limit(1);
  
  if (error) {
    console.log('Table issue:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('\nNeed to create table: content_curated');
    }
  } else {
    console.log('Table exists! Current rows:', data?.length || 0);
  }
}

checkTables();
