const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testTables() {
  console.log('=== TESTING ACTUAL DATABASE SCHEMA ===\n');
  
  // Test each table to see what columns exist
  const tables = ['queue_projects', 'queue_investors', 'queue_news'];
  
  for (const table of tables) {
    console.log(`\n📊 Table: ${table}`);
    console.log('─'.repeat(40));
    
    // Get one row to see structure
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ Error:', error.message);
    } else if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log('✅ Columns found:', columns.length);
      columns.forEach(col => {
        const value = data[0][col];
        const type = value === null ? 'null' : typeof value;
        console.log(`  - ${col}: ${type}`);
      });
    } else {
      // Try to get column info even if no data
      console.log('⚠️  No data in table, attempting insert test...');
      
      // Minimal test insert
      const testData = {
        name: 'SCHEMA_TEST',
        description: 'Testing schema to find available columns. This is a test record that will be deleted.',
        url: 'https://test.com',
        source: 'test',
        created_at: new Date().toISOString()
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from(table)
        .insert(testData)
        .select();
      
      if (insertError) {
        console.log('  Insert failed:', insertError.message);
        
        // Try to understand what columns are expected
        if (insertError.message.includes('column')) {
          console.log('  Missing required columns in test data');
        }
      } else if (insertData) {
        console.log('  Insert succeeded! Columns:');
        const columns = Object.keys(insertData[0]);
        columns.forEach(col => console.log(`    - ${col}`));
        
        // Clean up
        await supabase.from(table).delete().eq('name', 'SCHEMA_TEST');
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('SCHEMA TEST COMPLETE');
}

testTables();