#!/usr/bin/env npx tsx

const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';
const SUPABASE_ACCESS_TOKEN = 'sbp_39e15da960144236614d7898d00aa5701b2ed9a8';

async function executeSQL(query: string, description: string) {
  console.log(`📝 ${description}...`);
  
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

async function addMissingColumns() {
  console.log('🔧 Adding missing columns to queue tables...\n');
  
  // Add accelerate_fit column to all queue tables
  const tables = ['queue_projects', 'queue_investors', 'queue_news'];
  
  for (const table of tables) {
    await executeSQL(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS accelerate_fit JSONB DEFAULT '{}'::jsonb;`,
      `Adding accelerate_fit to ${table}`
    );
  }
  
  // Add any other missing columns that might be needed
  const additionalColumns = [
    { table: 'queue_projects', column: 'ai_summary', type: 'TEXT' },
    { table: 'queue_projects', column: 'enrichment_data', type: 'JSONB DEFAULT \'{}\'::jsonb' },
    { table: 'queue_investors', column: 'ai_summary', type: 'TEXT' },
    { table: 'queue_investors', column: 'enrichment_data', type: 'JSONB DEFAULT \'{}\'::jsonb' },
    { table: 'queue_news', column: 'ai_summary', type: 'TEXT' },
    { table: 'queue_news', column: 'enrichment_data', type: 'JSONB DEFAULT \'{}\'::jsonb' }
  ];
  
  console.log('\n📋 Adding additional columns...');
  for (const { table, column, type } of additionalColumns) {
    await executeSQL(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type};`,
      `Adding ${column} to ${table}`
    );
  }
  
  console.log('\n✅ All missing columns added!');
}

addMissingColumns().catch(console.error);