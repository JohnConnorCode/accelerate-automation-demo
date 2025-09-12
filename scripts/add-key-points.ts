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

async function addKeyPointsColumn() {
  console.log('🔧 Adding key_points column to queue_news...');
  
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS key_points TEXT[] DEFAULT ARRAY[]::TEXT[];
  `, 'Adding key_points to queue_news');
  
  console.log('\n✅ Column added successfully!');
}

addKeyPointsColumn().catch(console.error);