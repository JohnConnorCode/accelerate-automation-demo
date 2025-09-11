const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use the anon key directly for testing
const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function checkQueueProjects() {
  // Get first 3 projects from queue
  const { data, error } = await supabase
    .from('queue_projects')
    .select('company_name, founded_year, team_size, funding_amount, accelerate_fit, accelerate_score, accelerate_reason')
    .order('created_at', { ascending: false })
    .limit(3);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Latest projects in queue:');
  console.log(JSON.stringify(data, null, 2));
  
  // Check if fields are populated
  if (data && data.length > 0) {
    const sample = data[0];
    console.log('\nField population check:');
    console.log('- company_name:', sample.company_name ? '✅' : '❌');
    console.log('- founded_year:', sample.founded_year ? '✅' : '❌');
    console.log('- team_size:', sample.team_size ? '✅' : '❌');
    console.log('- funding_amount:', sample.funding_amount !== null ? '✅' : '❌');
    console.log('- accelerate_fit:', sample.accelerate_fit !== null ? '✅' : '❌');
    console.log('- accelerate_score:', sample.accelerate_score ? '✅' : '❌');
    console.log('- accelerate_reason:', sample.accelerate_reason ? '✅' : '❌');
  }
}

checkQueueProjects();