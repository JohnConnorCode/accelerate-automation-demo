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

async function addAccelerateColumns() {
  console.log('🔧 Adding missing ACCELERATE columns to database tables...');
  
  // Add ACCELERATE columns to queue_projects
  console.log('\n📊 Adding columns to queue_projects...');
  await executeSQL(`
    ALTER TABLE queue_projects 
    ADD COLUMN IF NOT EXISTS accelerate_fit BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS accelerate_reason TEXT,
    ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS founded_year INTEGER;
  `, 'Adding ACCELERATE columns to queue_projects');
  
  // Add ACCELERATE columns to queue_investors
  console.log('\n📊 Adding columns to queue_investors...');
  await executeSQL(`
    ALTER TABLE queue_investors 
    ADD COLUMN IF NOT EXISTS accelerate_fit BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS accelerate_reason TEXT,
    ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2) DEFAULT 0;
  `, 'Adding ACCELERATE columns to queue_investors');
  
  // Add ACCELERATE columns to queue_news
  console.log('\n📊 Adding columns to queue_news...');
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS accelerate_fit BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS accelerate_reason TEXT,
    ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3, 2) DEFAULT 0;
  `, 'Adding ACCELERATE columns to queue_news');
  
  // Verify columns were added
  console.log('\n🔍 Verifying columns...');
  await executeSQL(`
    SELECT 
      table_name,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
    AND column_name LIKE 'accelerate%'
    ORDER BY table_name, column_name;
  `, 'Checking ACCELERATE columns');
  
  console.log('\n✅ ACCELERATE columns added successfully!');
}

addAccelerateColumns().catch(console.error);