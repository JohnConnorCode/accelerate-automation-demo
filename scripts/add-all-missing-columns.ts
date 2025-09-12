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

async function addAllMissingColumns() {
  console.log('🔧 Adding ALL missing columns to database tables...');
  
  // Add missing columns to queue_projects
  console.log('\n📊 Adding remaining columns to queue_projects...');
  await executeSQL(`
    ALTER TABLE queue_projects 
    ADD COLUMN IF NOT EXISTS batch_id TEXT,
    ADD COLUMN IF NOT EXISTS founders TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS employee_count INTEGER,
    ADD COLUMN IF NOT EXISTS funding_amount DECIMAL(15, 2),
    ADD COLUMN IF NOT EXISTS funding_round TEXT,
    ADD COLUMN IF NOT EXISTS funding_investors TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS funding_date DATE,
    ADD COLUMN IF NOT EXISTS technologies TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS industries TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS verticals TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS business_model TEXT,
    ADD COLUMN IF NOT EXISTS target_market TEXT,
    ADD COLUMN IF NOT EXISTS revenue DECIMAL(15, 2),
    ADD COLUMN IF NOT EXISTS valuation DECIMAL(15, 2),
    ADD COLUMN IF NOT EXISTS competitors TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS region TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_id TEXT,
    ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS enriched BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
    ADD COLUMN IF NOT EXISTS twitter_url TEXT,
    ADD COLUMN IF NOT EXISTS crunchbase_url TEXT,
    ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS linkedin_employee_count INTEGER,
    ADD COLUMN IF NOT EXISTS linkedin_followers INTEGER;
  `, 'Adding remaining columns to queue_projects');
  
  // Add missing columns to queue_investors
  console.log('\n📊 Adding remaining columns to queue_investors...');
  await executeSQL(`
    ALTER TABLE queue_investors 
    ADD COLUMN IF NOT EXISTS batch_id TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_id TEXT,
    ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS enriched BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS funding_type TEXT,
    ADD COLUMN IF NOT EXISTS investment_stage TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS investment_sectors TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS investment_regions TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS portfolio_companies TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS contact_email TEXT,
    ADD COLUMN IF NOT EXISTS contact_name TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
    ADD COLUMN IF NOT EXISTS twitter_url TEXT;
  `, 'Adding remaining columns to queue_investors');
  
  // Add missing columns to queue_news
  console.log('\n📊 Adding remaining columns to queue_news...');
  await executeSQL(`
    ALTER TABLE queue_news 
    ADD COLUMN IF NOT EXISTS batch_id TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS source_id TEXT,
    ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS enriched BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS enrichment_data JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS content_type TEXT,
    ADD COLUMN IF NOT EXISTS reading_time INTEGER,
    ADD COLUMN IF NOT EXISTS engagement_score DECIMAL(5, 2),
    ADD COLUMN IF NOT EXISTS views INTEGER,
    ADD COLUMN IF NOT EXISTS likes INTEGER,
    ADD COLUMN IF NOT EXISTS comments INTEGER,
    ADD COLUMN IF NOT EXISTS shares INTEGER,
    ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS related_companies TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS related_people TEXT[] DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN IF NOT EXISTS sentiment TEXT,
    ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
  `, 'Adding remaining columns to queue_news');
  
  // Verify all tables have required columns
  console.log('\n🔍 Getting column count for each table...');
  await executeSQL(`
    SELECT 
      table_name,
      COUNT(column_name) as column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
    GROUP BY table_name
    ORDER BY table_name;
  `, 'Checking column counts');
  
  console.log('\n✅ All columns added successfully!');
}

addAllMissingColumns().catch(console.error);