#!/usr/bin/env npx tsx

// Using the Supabase Management API with the access token
const SUPABASE_ACCESS_TOKEN = 'sbp_6e20e3edb22f4158328b31a0dec746fdd0cbaf2a';
const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';

async function executeSQL() {
  console.log('🚀 Executing SQL via Supabase Management API...\n');

  const sql = `
-- Create queue_projects table
CREATE TABLE IF NOT EXISTS queue_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  company_name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  founded_year INTEGER,
  
  -- ACCELERATE Fields (Required)
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  confidence_score NUMERIC(3,2),
  
  -- Location & Team
  location TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  founders TEXT[],
  team_size INTEGER,
  employee_count INTEGER,
  
  -- Funding & Business
  funding_amount BIGINT,
  funding_round TEXT,
  funding_investors TEXT[],
  last_funding_date DATE,
  total_funding BIGINT,
  valuation BIGINT,
  revenue BIGINT,
  business_model TEXT,
  
  -- Technology & Industry
  technology_stack TEXT[],
  industry_tags TEXT[],
  market_category TEXT,
  target_market TEXT,
  competitive_advantage TEXT,
  
  -- Source & Enrichment
  source TEXT NOT NULL,
  source_url TEXT,
  source_created_at TIMESTAMP WITH TIME ZONE,
  batch_id TEXT,
  enriched BOOLEAN DEFAULT false,
  enrichment_data JSONB,
  
  -- AI Analysis
  ai_summary TEXT,
  ai_insights JSONB,
  sentiment_score NUMERIC(3,2),
  growth_potential TEXT,
  risk_factors TEXT[],
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_queue_company UNIQUE(company_name, source)
);

-- Create queue_news table
CREATE TABLE IF NOT EXISTS queue_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  published_date TIMESTAMP WITH TIME ZONE,
  
  -- ACCELERATE Fields
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  confidence_score NUMERIC(3,2),
  
  -- Article Details
  author TEXT,
  publication TEXT,
  category TEXT,
  tags TEXT[],
  image_url TEXT,
  video_url TEXT,
  
  -- Company Relations
  company_name TEXT,
  company_id UUID,
  mentioned_companies TEXT[],
  
  -- Content Analysis
  summary TEXT,
  key_points TEXT[],
  sentiment TEXT,
  sentiment_score NUMERIC(3,2),
  relevance_score NUMERIC(3,2),
  
  -- Engagement Metrics
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  engagement_score NUMERIC(5,2),
  
  -- Source & Enrichment
  source TEXT NOT NULL,
  source_url TEXT,
  source_id TEXT,
  batch_id TEXT,
  enriched BOOLEAN DEFAULT false,
  enrichment_data JSONB,
  
  -- AI Analysis
  ai_summary TEXT,
  ai_insights JSONB,
  ai_keywords TEXT[],
  ai_entities JSONB,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_queue_news UNIQUE(title, source, published_date)
);

-- Create queue_investors table
CREATE TABLE IF NOT EXISTS queue_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  website TEXT,
  
  -- ACCELERATE Fields
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  confidence_score NUMERIC(3,2),
  
  -- Investment Profile
  investment_stage TEXT[],
  investment_size_min BIGINT,
  investment_size_max BIGINT,
  total_investments INTEGER,
  total_portfolio_value BIGINT,
  
  -- Focus Areas
  industry_focus TEXT[],
  geographic_focus TEXT[],
  technology_focus TEXT[],
  business_model_focus TEXT[],
  
  -- Portfolio
  portfolio_companies TEXT[],
  notable_investments JSONB,
  recent_investments JSONB,
  exits JSONB,
  
  -- Team
  partners JSONB,
  team_size INTEGER,
  founded_year INTEGER,
  headquarters TEXT,
  offices TEXT[],
  
  -- Contact
  contact_email TEXT,
  contact_phone TEXT,
  linkedin_url TEXT,
  twitter_url TEXT,
  
  -- Performance
  irr NUMERIC(5,2),
  multiple NUMERIC(5,2),
  success_rate NUMERIC(5,2),
  
  -- Source & Enrichment
  source TEXT NOT NULL,
  source_url TEXT,
  batch_id TEXT,
  enriched BOOLEAN DEFAULT false,
  enrichment_data JSONB,
  
  -- AI Analysis
  ai_summary TEXT,
  ai_insights JSONB,
  investment_thesis TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_queue_investor UNIQUE(name, type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_projects_accelerate ON queue_projects(accelerate_fit, accelerate_score);
CREATE INDEX IF NOT EXISTS idx_queue_projects_source ON queue_projects(source, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_news_accelerate ON queue_news(accelerate_fit, accelerate_score);
CREATE INDEX IF NOT EXISTS idx_queue_news_published ON queue_news(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_queue_investors_accelerate ON queue_investors(accelerate_fit, accelerate_score);
CREATE INDEX IF NOT EXISTS idx_queue_investors_type ON queue_investors(type);
  `;

  try {
    // Try Supabase Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('Management API Response:', error);
      
      // Try alternative endpoint
      console.log('\nTrying alternative endpoint...');
      const altResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });
      
      if (!altResponse.ok) {
        const altError = await altResponse.text();
        console.log('Alternative endpoint response:', altError);
        
        // Final attempt: Try the platform API
        console.log('\nTrying platform API...');
        const platformResponse = await fetch(`https://api.supabase.com/platform/v1/projects/${PROJECT_REF}/database/sql`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sql }),
        });
        
        if (!platformResponse.ok) {
          const platformError = await platformResponse.text();
          console.log('Platform API response:', platformError);
          throw new Error('All API attempts failed');
        }
        
        console.log('✅ Tables created via platform API!');
      } else {
        console.log('✅ Tables created via alternative endpoint!');
      }
    } else {
      const result = await response.json();
      console.log('✅ Tables created successfully!');
      console.log('Result:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    
    console.log('\n📝 The SQL has been prepared. Since the API endpoints are not accepting the request,');
    console.log('you need to run this SQL in the Supabase Dashboard:');
    console.log('https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
    console.log('\nThe SQL is saved in: create-robust-queue-tables.sql');
  }
}

executeSQL().catch(console.error);