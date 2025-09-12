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

async function addContentLocationColumns() {
  console.log('🔧 Adding content and location columns...');
  
  // Add location to queue_projects
  console.log('\n📊 Adding location to queue_projects...');
  await executeSQL(`
    ALTER TABLE queue_projects 
    ADD COLUMN IF NOT EXISTS location TEXT;
  `, 'Adding location to queue_projects');
  
  // Add content and other fields to queue_news
  console.log('\n📊 Adding content fields to queue_news...');
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS content TEXT,
    ADD COLUMN IF NOT EXISTS publication TEXT,
    ADD COLUMN IF NOT EXISTS image_url TEXT;
  `, 'Adding content fields to queue_news');
  
  // Add name field to queue_investors that seems to be expected
  console.log('\n📊 Adding name to queue_investors...');
  await executeSQL(`
    ALTER TABLE queue_investors 
    ADD COLUMN IF NOT EXISTS name TEXT;
  `, 'Adding name to queue_investors');
  
  console.log('\n✅ Content and location columns added successfully!');
}

addContentLocationColumns().catch(console.error);