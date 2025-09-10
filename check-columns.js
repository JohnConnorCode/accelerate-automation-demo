const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function checkSchema() {
  // Try to insert a minimal record to see what columns exist
  const { data, error } = await supabase
    .from('queue_investors')
    .insert({
      name: 'TEST',
      organization: 'TEST ORG',
      description: 'A test funding program for ACCELERATE startups. This is a long description to meet any minimum length requirements.',
      url: 'https://test.com',
      funding_type: 'grant',
      min_amount: 10000,
      max_amount: 100000,
      currency: 'USD',
      source: 'test',
      fetched_at: new Date().toISOString(),
      score: 50
    })
    .select();
  
  if (error) {
    console.log('Error details:', error);
    console.log('\nThis tells us what columns are missing or wrong');
  } else {
    console.log('Successfully inserted! These columns exist:', Object.keys(data[0]));
    
    // Clean up test record
    await supabase.from('queue_investors').delete().eq('name', 'TEST');
  }
}

checkSchema();