const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function findColumns() {
  console.log('Testing queue_investors columns...\n');
  
  // Try increasingly complex inserts to find what works
  const tests = [
    {
      name: 'Minimal test 1',
      data: {
        name: 'TEST1',
        created_at: new Date().toISOString()
      }
    },
    {
      name: 'With description',
      data: {
        name: 'TEST2',
        description: 'A test funding program for ACCELERATE startups with long description.',
        created_at: new Date().toISOString()
      }
    },
    {
      name: 'With organization',
      data: {
        name: 'TEST3',
        organization: 'Test Org',
        description: 'A test funding program for ACCELERATE startups with long description.',
        created_at: new Date().toISOString()
      }
    },
    {
      name: 'With source',
      data: {
        name: 'TEST4',
        organization: 'Test Org',
        description: 'A test funding program for ACCELERATE startups with long description.',
        source: 'test',
        created_at: new Date().toISOString()
      }
    }
  ];
  
  for (const test of tests) {
    console.log(`Testing: ${test.name}`);
    const { data, error } = await supabase
      .from('queue_investors')
      .insert(test.data)
      .select();
    
    if (error) {
      console.log(`  ❌ Failed: ${error.message}\n`);
    } else {
      console.log(`  ✅ SUCCESS! Columns that exist:`);
      Object.keys(data[0]).forEach(col => {
        console.log(`     - ${col}`);
      });
      
      // Clean up
      await supabase.from('queue_investors').delete().eq('name', test.data.name);
      
      console.log('\n  This configuration works!\n');
      return data[0];
    }
  }
  
  console.log('Could not insert any test data');
}

findColumns();