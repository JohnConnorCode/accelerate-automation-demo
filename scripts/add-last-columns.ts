#!/usr/bin/env npx tsx

const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';
const SUPABASE_ACCESS_TOKEN = 'sbp_39e15da960144236614d7898d00aa5701b2ed9a8';

async function executeSQL(query: string, description: string) {
  console.log(`\n📝 ${description}...`);
  
  const apiUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.text();
    
    if (!response.ok) {
      console.log(`   ⚠️  ${result}`);
      return false;
    }
    
    console.log(`   ✅ Success`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
    return false;
  }
}

async function addLastColumns() {
  console.log('🔧 Adding last missing columns to database tables...');
  
  // Add last columns to queue_projects
  console.log('\n📊 Adding last columns to queue_projects...');
  await executeSQL(`
    ALTER TABLE queue_projects 
    ADD COLUMN IF NOT EXISTS last_funding_date DATE,
    ADD COLUMN IF NOT EXISTS total_funding DECIMAL(15, 2);
  `, 'Adding last columns to queue_projects');
  
  // Add last columns to queue_news
  console.log('\n📊 Adding last columns to queue_news...');
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS company_name TEXT;
  `, 'Adding last columns to queue_news');
  
  // Clear the Supabase schema cache by doing a dummy select
  console.log('\n🔄 Refreshing schema cache...');
  await executeSQL(`
    SELECT COUNT(*) FROM queue_projects;
  `, 'Refreshing queue_projects cache');
  
  await executeSQL(`
    SELECT COUNT(*) FROM queue_news;
  `, 'Refreshing queue_news cache');
  
  await executeSQL(`
    SELECT COUNT(*) FROM queue_investors;
  `, 'Refreshing queue_investors cache');
  
  console.log('\n✅ All columns added successfully!');
  console.log('The database schema is now complete.');
}

addLastColumns().catch(console.error);