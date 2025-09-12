-- Create Queue Tables for Staging Service
-- These tables are referenced in the code but missing from the database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Queue Projects Table
CREATE TABLE IF NOT EXISTS queue_projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  score DECIMAL(3, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  
  -- Project specific fields
  team_size INTEGER,
  funding_raised DECIMAL(15, 2),
  launch_date DATE,
  github_url TEXT,
  website_url TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Review fields
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  approved_at TIMESTAMP,
  approved_by TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Queue Investors/Funding Table
CREATE TABLE IF NOT EXISTS queue_investors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  score DECIMAL(3, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  
  -- Funding specific fields
  amount_min DECIMAL(15, 2),
  amount_max DECIMAL(15, 2),
  deadline TIMESTAMP,
  organization TEXT,
  eligibility_criteria JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Review fields
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  approved_at TIMESTAMP,
  approved_by TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Queue News/Resources Table
CREATE TABLE IF NOT EXISTS queue_news (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT,
  score DECIMAL(3, 2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  
  -- Resource specific fields
  category TEXT,
  author TEXT,
  published_date TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Review fields
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  approved_at TIMESTAMP,
  approved_by TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Now add the unique constraints from our migration
ALTER TABLE queue_projects 
ADD CONSTRAINT queue_projects_url_unique UNIQUE (url);

ALTER TABLE queue_investors
ADD CONSTRAINT queue_investors_url_unique UNIQUE (url);

ALTER TABLE queue_news
ADD CONSTRAINT queue_news_url_unique UNIQUE (url);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_queue_projects_created_at ON queue_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON queue_projects(status);
CREATE INDEX IF NOT EXISTS idx_queue_projects_score ON queue_projects(score DESC);

CREATE INDEX IF NOT EXISTS idx_queue_investors_created_at ON queue_investors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_investors_status ON queue_investors(status);
CREATE INDEX IF NOT EXISTS idx_queue_investors_score ON queue_investors(score DESC);

CREATE INDEX IF NOT EXISTS idx_queue_news_created_at ON queue_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_news_status ON queue_news(status);
CREATE INDEX IF NOT EXISTS idx_queue_news_score ON queue_news(score DESC);

-- 6. Add composite indexes
CREATE INDEX IF NOT EXISTS idx_queue_projects_status_score ON queue_projects(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_investors_status_score ON queue_investors(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_news_status_score ON queue_news(status, score DESC);

-- 7. Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_queue_projects_updated_at BEFORE UPDATE ON queue_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_investors_updated_at BEFORE UPDATE ON queue_investors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_news_updated_at BEFORE UPDATE ON queue_news
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Verification query
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN ('queue_projects', 'queue_investors', 'queue_news')
ORDER BY table_name, ordinal_position;