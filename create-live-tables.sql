-- Create live tables for approved content

-- Live table for approved startups
CREATE TABLE IF NOT EXISTS accelerate_startups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,
  founded_year INTEGER,
  
  -- Location
  location TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  
  -- Team
  founders TEXT[],
  team_size INTEGER,
  employee_count INTEGER,
  
  -- Funding
  funding_amount BIGINT,
  funding_round TEXT,
  funding_investors TEXT[],
  last_funding_date DATE,
  total_funding BIGINT,
  valuation BIGINT,
  revenue BIGINT,
  
  -- Technology
  technology_stack TEXT[],
  industry_tags TEXT[],
  market_category TEXT,
  business_model TEXT,
  
  -- ACCELERATE
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  
  -- Source
  source TEXT,
  source_url TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_startup_name UNIQUE(name)
);

-- Live table for approved news
CREATE TABLE IF NOT EXISTS accelerate_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  title TEXT NOT NULL,
  content TEXT,
  url TEXT,
  published_date TIMESTAMP WITH TIME ZONE,
  
  -- Article Details
  author TEXT,
  publication TEXT,
  category TEXT,
  tags TEXT[],
  
  -- ACCELERATE
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  
  -- Metrics
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Source
  source TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_news_url UNIQUE(url)
);

-- Live table for approved investors
CREATE TABLE IF NOT EXISTS accelerate_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Fields
  name TEXT NOT NULL,
  type TEXT,
  description TEXT,
  website TEXT,
  
  -- Investment Profile
  investment_stage TEXT[],
  investment_size_min BIGINT,
  investment_size_max BIGINT,
  industry_focus TEXT[],
  geographic_focus TEXT[],
  
  -- Portfolio
  portfolio_companies TEXT[],
  notable_investments JSONB,
  
  -- ACCELERATE
  accelerate_fit BOOLEAN DEFAULT false,
  accelerate_reason TEXT,
  accelerate_score NUMERIC(3,2),
  
  -- Source
  source TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Prevent duplicates
  CONSTRAINT unique_investor_name UNIQUE(name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_score ON accelerate_startups(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_approved ON accelerate_startups(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_score ON accelerate_news(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_published ON accelerate_news(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_score ON accelerate_investors(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_type ON accelerate_investors(type);