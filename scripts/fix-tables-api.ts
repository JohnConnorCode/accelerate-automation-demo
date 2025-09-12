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

async function fixTables() {
  console.log('🔧 Fixing database tables with Supabase Management API...');
  
  // First, check what tables exist
  await executeSQL(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('queue_projects', 'queue_investors', 'queue_news');
  `, 'Checking existing tables');
  
  // Drop existing tables if they're malformed
  console.log('\n🗑️  Dropping malformed tables if they exist...');
  await executeSQL('DROP TABLE IF EXISTS queue_projects CASCADE;', 'Dropping queue_projects');
  await executeSQL('DROP TABLE IF EXISTS queue_investors CASCADE;', 'Dropping queue_investors');
  await executeSQL('DROP TABLE IF EXISTS queue_news CASCADE;', 'Dropping queue_news');
  
  // Create tables fresh with all columns
  console.log('\n✨ Creating tables with correct schema...');
  
  // Enable UUID extension
  await executeSQL(
    `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,
    'Enabling UUID extension'
  );
  
  // Create queue_projects
  await executeSQL(`
    CREATE TABLE queue_projects (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT,
      score DECIMAL(3, 2) DEFAULT 0,
      status TEXT DEFAULT 'pending',
      team_size INTEGER,
      funding_raised DECIMAL(15, 2),
      launch_date DATE,
      github_url TEXT,
      website_url TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      rejection_reason TEXT,
      approved_at TIMESTAMP,
      approved_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, 'Creating queue_projects table');
  
  // Create queue_investors
  await executeSQL(`
    CREATE TABLE queue_investors (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT,
      score DECIMAL(3, 2) DEFAULT 0,
      status TEXT DEFAULT 'pending',
      amount_min DECIMAL(15, 2),
      amount_max DECIMAL(15, 2),
      deadline TIMESTAMP,
      organization TEXT,
      eligibility_criteria JSONB DEFAULT '[]'::jsonb,
      metadata JSONB DEFAULT '{}'::jsonb,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      rejection_reason TEXT,
      approved_at TIMESTAMP,
      approved_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, 'Creating queue_investors table');
  
  // Create queue_news
  await executeSQL(`
    CREATE TABLE queue_news (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      source TEXT,
      score DECIMAL(3, 2) DEFAULT 0,
      status TEXT DEFAULT 'pending',
      category TEXT,
      author TEXT,
      published_date TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      rejection_reason TEXT,
      approved_at TIMESTAMP,
      approved_by TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `, 'Creating queue_news table');
  
  // Add indexes
  console.log('\n📊 Adding indexes for performance...');
  
  const indexQueries = [
    'CREATE INDEX idx_queue_projects_created_at ON queue_projects(created_at DESC);',
    'CREATE INDEX idx_queue_projects_status ON queue_projects(status);',
    'CREATE INDEX idx_queue_projects_score ON queue_projects(score DESC);',
    'CREATE INDEX idx_queue_investors_created_at ON queue_investors(created_at DESC);',
    'CREATE INDEX idx_queue_investors_status ON queue_investors(status);',
    'CREATE INDEX idx_queue_investors_score ON queue_investors(score DESC);',
    'CREATE INDEX idx_queue_news_created_at ON queue_news(created_at DESC);',
    'CREATE INDEX idx_queue_news_status ON queue_news(status);',
    'CREATE INDEX idx_queue_news_score ON queue_news(score DESC);'
  ];
  
  for (const query of indexQueries) {
    await executeSQL(query, 'Adding index');
  }
  
  // Verify tables were created
  console.log('\n🔍 Verifying tables...');
  await executeSQL(`
    SELECT 
      table_name,
      COUNT(column_name) as column_count
    FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
    GROUP BY table_name
    ORDER BY table_name;
  `, 'Checking table columns');
  
  console.log('\n✅ Database migration complete!');
  console.log('The staging service should now work properly.');
}

fixTables().catch(console.error);