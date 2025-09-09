const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function verifyTables() {
  console.log('🔍 Verifying queue tables creation...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const tablesToCheck = [
    'queue_projects',
    'queue_funding_programs', 
    'queue_resources'
  ];
  
  console.log(`📋 Checking ${tablesToCheck.length} tables...`);
  
  for (const tableName of tablesToCheck) {
    try {
      console.log(`\n🔎 Checking table: ${tableName}`);
      
      // Try to query the table structure
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0); // Just check if table exists, don't fetch data
      
      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          console.log(`❌ Table ${tableName} does not exist`);
        } else {
          console.log(`⚠️  Table ${tableName} exists but has error: ${error.message}`);
        }
      } else {
        console.log(`✅ Table ${tableName} exists and is accessible`);
      }
    } catch (err) {
      console.log(`❌ Error checking ${tableName}: ${err.message}`);
    }
  }
  
  // Test a simple insert to verify table structure (if tables exist)
  console.log('\n🧪 Testing table structures with sample data...');
  
  // Test projects table
  try {
    const { data, error } = await supabase
      .from('queue_projects')
      .insert({
        name: 'Test Project',
        description: 'This is a test project description that is long enough to meet the 100 character minimum requirement for the description field validation.',
        short_description: 'Short test description under 200 chars',
        url: 'https://test-project-unique-url-' + Date.now() + '.com',
        team_size: 3,
        founder_names: ['John Doe', 'Jane Smith'],
        funding_raised: 100000,
        funding_stage: 'pre-seed',
        launch_date: '2024-01-15',
        technical_stack: ['React', 'Node.js', 'PostgreSQL'],
        categories: ['Web3', 'DeFi'],
        target_market: 'DeFi traders and liquidity providers',
        project_needs: ['Funding', 'Technical mentorship'],
        problem_statement: 'There is a significant gap in the market for user-friendly DeFi tools that provide real-time analytics and insights for traders and liquidity providers.',
        solution_description: 'We are building a comprehensive DeFi analytics platform that aggregates data from multiple protocols and presents actionable insights through an intuitive dashboard.',
        unique_value_proposition: 'First platform to combine real-time analytics with automated strategy recommendations',
        source: 'test',
        twitter_url: 'https://twitter.com/testproject'
      })
      .select();
      
    if (error) {
      console.log('❌ Projects table structure issue:', error.message);
    } else {
      console.log('✅ Projects table structure is valid');
      
      // Clean up test data
      if (data && data.length > 0) {
        await supabase.from('queue_projects').delete().eq('id', data[0].id);
        console.log('🧹 Test data cleaned up');
      }
    }
  } catch (err) {
    console.log('❌ Could not test projects table:', err.message);
  }
  
  console.log('\n📊 Verification complete!');
  console.log('\n🎯 Next steps:');
  console.log('1. If tables don\'t exist, execute the SQL in Supabase dashboard');
  console.log('2. If tables exist, you\'re ready to use the queue system');
  console.log('3. Test the full workflow: fetch → queue → approve');
}

verifyTables();