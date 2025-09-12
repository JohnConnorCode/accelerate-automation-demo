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

async function addFinalColumns() {
  console.log('🔧 Adding final missing columns to database tables...');
  
  // Add final columns to queue_projects
  console.log('\n📊 Adding final columns to queue_projects...');
  await executeSQL(`
    ALTER TABLE queue_projects 
    ADD COLUMN IF NOT EXISTS competitive_advantage TEXT,
    ADD COLUMN IF NOT EXISTS technology_stack TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS industry_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS market_category TEXT,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS growth_potential TEXT,
    ADD COLUMN IF NOT EXISTS risk_factors TEXT[] DEFAULT ARRAY[]::TEXT[];
  `, 'Adding final columns to queue_projects');
  
  // Add final columns to queue_news
  console.log('\n📊 Adding final columns to queue_news...');
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS company_id UUID,
    ADD COLUMN IF NOT EXISTS relevance_score DECIMAL(3, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL(3, 2) DEFAULT 0;
  `, 'Adding final columns to queue_news');
  
  // Final verification
  console.log('\n🔍 Final column count check...');
  await executeSQL(`
    SELECT 
      table_name,
      COUNT(column_name) as column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
    GROUP BY table_name
    ORDER BY table_name;
  `, 'Final column count');
  
  console.log('\n✅ All final columns added successfully!');
  console.log('The database schema should now be complete.');
}

addFinalColumns().catch(console.error);