-- ACCELERATE Content Automation Database Schema
-- Run this in Supabase SQL editor: https://app.supabase.com/project/[your-project]/sql/new

-- ============================================================================
-- QUEUE TABLES (for staging content before approval)
-- ============================================================================

-- Queue for projects
CREATE TABLE IF NOT EXISTS queue_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  accelerate_fit BOOLEAN,
  accelerate_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_queue_projects_url UNIQUE(url)
);

-- Queue for investors/funding
CREATE TABLE IF NOT EXISTS queue_investors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  accelerate_fit BOOLEAN,
  accelerate_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_queue_investors_url UNIQUE(url)
);

-- Queue for news/resources
CREATE TABLE IF NOT EXISTS queue_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  score NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  accelerate_fit BOOLEAN,
  accelerate_reason TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_queue_news_url UNIQUE(url)
);

-- ============================================================================
-- PRODUCTION TABLES (approved content)
-- ============================================================================

-- Main projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT NOT NULL,
  website_url TEXT NOT NULL,
  github_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  launch_date DATE NOT NULL,
  funding_raised NUMERIC DEFAULT 0,
  funding_round TEXT,
  team_size INTEGER DEFAULT 1,
  categories TEXT[] DEFAULT '{}',
  supported_chains TEXT[] DEFAULT '{}',
  project_status TEXT DEFAULT 'active',
  seeking_funding BOOLEAN DEFAULT false,
  seeking_cofounders BOOLEAN DEFAULT false,
  seeking_developers BOOLEAN DEFAULT false,
  accelerate_score NUMERIC,
  source TEXT,
  source_url TEXT,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  problem_statement TEXT,
  value_proposition TEXT,
  target_market TEXT,
  CONSTRAINT unique_projects_website_url UNIQUE(website_url)
);

-- Funding programs table
CREATE TABLE IF NOT EXISTS funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL,
  funding_type TEXT NOT NULL,
  min_amount NUMERIC DEFAULT 0,
  max_amount NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  equity_required BOOLEAN DEFAULT false,
  equity_percentage NUMERIC DEFAULT 0,
  application_url TEXT NOT NULL,
  application_deadline DATE,
  application_process TEXT,
  decision_timeline TEXT,
  eligibility_criteria TEXT[] DEFAULT '{}',
  geographic_restrictions TEXT[] DEFAULT '{}',
  stage_preferences TEXT[] DEFAULT '{}',
  sector_focus TEXT[] DEFAULT '{}',
  program_duration TEXT,
  program_location TEXT,
  cohort_size INTEGER,
  benefits TEXT[] DEFAULT '{}',
  mentor_profiles TEXT[] DEFAULT '{}',
  last_investment_date DATE,
  total_deployed_2025 NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  accelerate_score NUMERIC,
  source TEXT,
  source_url TEXT,
  CONSTRAINT unique_funding_programs_url UNIQUE(application_url)
);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  category TEXT NOT NULL,
  price_type TEXT DEFAULT 'free',
  price_amount NUMERIC DEFAULT 0,
  trial_available BOOLEAN DEFAULT false,
  provider_name TEXT NOT NULL,
  provider_credibility TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  difficulty_level TEXT DEFAULT 'beginner',
  time_commitment TEXT,
  prerequisites TEXT[] DEFAULT '{}',
  key_benefits TEXT[] DEFAULT '{}',
  use_cases TEXT[] DEFAULT '{}',
  accelerate_score NUMERIC,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  CONSTRAINT unique_resources_url UNIQUE(url)
);

-- ============================================================================
-- UTILITY TABLES
-- ============================================================================

-- API cache table
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_key TEXT NOT NULL,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT unique_api_cache_key UNIQUE(cache_key)
);

-- Content queue (legacy/fallback)
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  score NUMERIC DEFAULT 0,
  quality_score NUMERIC,
  raw_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by TEXT
);

-- API keys storage (encrypted)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  service TEXT NOT NULL,
  key_name TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  CONSTRAINT unique_api_keys_service UNIQUE(service, key_name)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Queue tables indexes
CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON queue_projects(status);
CREATE INDEX IF NOT EXISTS idx_queue_projects_source ON queue_projects(source);
CREATE INDEX IF NOT EXISTS idx_queue_projects_created ON queue_projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_investors_status ON queue_investors(status);
CREATE INDEX IF NOT EXISTS idx_queue_investors_source ON queue_investors(source);
CREATE INDEX IF NOT EXISTS idx_queue_investors_created ON queue_investors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_news_status ON queue_news(status);
CREATE INDEX IF NOT EXISTS idx_queue_news_source ON queue_news(source);
CREATE INDEX IF NOT EXISTS idx_queue_news_created ON queue_news(created_at DESC);

-- Production tables indexes
CREATE INDEX IF NOT EXISTS idx_projects_launch_date ON projects(launch_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_funding ON projects(funding_raised);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_seeking ON projects(seeking_funding, seeking_developers, seeking_cofounders);

CREATE INDEX IF NOT EXISTS idx_funding_programs_active ON funding_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_funding_programs_deadline ON funding_programs(application_deadline);
CREATE INDEX IF NOT EXISTS idx_funding_programs_amount ON funding_programs(max_amount);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type, category);
CREATE INDEX IF NOT EXISTS idx_resources_updated ON resources(last_updated DESC);

-- Utility indexes
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status, type);
CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_queue_projects_updated_at BEFORE UPDATE ON queue_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_investors_updated_at BEFORE UPDATE ON queue_investors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_queue_news_updated_at BEFORE UPDATE ON queue_news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_programs_updated_at BEFORE UPDATE ON funding_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_queue_updated_at BEFORE UPDATE ON content_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE queue_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Public read access for production tables
CREATE POLICY "Public read access" ON projects FOR SELECT USING (true);
CREATE POLICY "Public read access" ON funding_programs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON resources FOR SELECT USING (true);

-- Service role full access (for backend operations)
CREATE POLICY "Service role full access" ON queue_projects FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON queue_investors FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON queue_news FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON projects FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON funding_programs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON resources FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON api_cache FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON content_queue FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access" ON api_keys FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Anon key limited access (read queue, write to cache)
CREATE POLICY "Anon read queue" ON queue_projects FOR SELECT USING (auth.jwt() ->> 'role' = 'anon');
CREATE POLICY "Anon read queue" ON queue_investors FOR SELECT USING (auth.jwt() ->> 'role' = 'anon');
CREATE POLICY "Anon read queue" ON queue_news FOR SELECT USING (auth.jwt() ->> 'role' = 'anon');
CREATE POLICY "Anon cache access" ON api_cache FOR ALL USING (auth.jwt() ->> 'role' = 'anon');

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant permissions to anon role (limited)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT INSERT, UPDATE, DELETE ON api_cache TO anon;

-- Grant permissions to authenticated role (more access)
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant permissions to service_role (full access)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these to verify the schema is correct:
/*
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT table_name, column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
ORDER BY table_name, ordinal_position;

SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
*/