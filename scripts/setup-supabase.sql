-- ACCELERATE CONTENT AUTOMATION DATABASE SETUP
-- Run this entire script in your Supabase SQL editor
-- https://app.supabase.com/project/_/sql/new

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  source TEXT,
  author TEXT,
  type TEXT CHECK (type IN ('article', 'tool', 'resource', 'tutorial', 'documentation')),
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0,
  credibility_score INTEGER DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  website_url TEXT,
  github_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  source TEXT,
  launch_date DATE,
  team_size INTEGER,
  funding_raised DECIMAL,
  funding_round TEXT,
  categories TEXT[],
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  
  -- Scores and verification
  score INTEGER DEFAULT 0,
  credibility_score INTEGER DEFAULT 0,
  social_score INTEGER DEFAULT 0,
  team_credibility_score INTEGER DEFAULT 0,
  final_credibility_score INTEGER DEFAULT 0,
  
  -- Verification flags
  verified BOOLEAN DEFAULT FALSE,
  has_verified_social BOOLEAN DEFAULT FALSE,
  has_verified_team BOOLEAN DEFAULT FALSE,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  
  -- Metrics
  tvl_current DECIMAL,
  user_count INTEGER,
  transaction_count INTEGER,
  github_stars INTEGER,
  twitter_followers INTEGER,
  discord_members INTEGER,
  
  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create funding_programs table
CREATE TABLE IF NOT EXISTS public.funding_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT,
  funding_type TEXT CHECK (funding_type IN ('grant', 'accelerator', 'incubator', 'bounty', 'retroactive', 'quadratic')),
  
  -- Funding details
  min_amount DECIMAL,
  max_amount DECIMAL,
  currency TEXT,
  equity_required BOOLEAN DEFAULT FALSE,
  equity_percentage DECIMAL,
  
  -- Application details
  application_url TEXT,
  application_deadline DATE,
  application_process TEXT,
  decision_timeline TEXT,
  
  -- Eligibility
  eligibility_criteria TEXT[],
  geographic_restrictions TEXT[],
  stage_preferences TEXT[],
  sector_focus TEXT[],
  
  -- Program details
  program_duration TEXT,
  program_location TEXT,
  benefits TEXT[],
  mentor_profiles JSONB DEFAULT '[]',
  alumni_companies TEXT[],
  
  -- Activity verification
  last_investment_date DATE,
  total_deployed_2025 DECIMAL,
  recent_portfolio TEXT[],
  
  -- Metadata
  source TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0,
  credibility_score INTEGER DEFAULT 0,
  status TEXT CHECK (status IN ('open', 'closed', 'upcoming', 'ongoing')),
  
  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create social_metrics cache table
CREATE TABLE IF NOT EXISTS public.social_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_url TEXT UNIQUE NOT NULL,
  content_type TEXT,
  metrics JSONB DEFAULT '{}',
  social_score INTEGER,
  credibility_score INTEGER,
  enriched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create fetch_history table for tracking
CREATE TABLE IF NOT EXISTS public.fetch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fetcher_name TEXT NOT NULL,
  items_fetched INTEGER DEFAULT 0,
  items_qualified INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,
  average_score DECIMAL,
  errors TEXT[],
  duration_ms INTEGER,
  success BOOLEAN DEFAULT TRUE,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cache table for API responses
CREATE TABLE IF NOT EXISTS public.api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resources_score ON resources(score DESC);
CREATE INDEX IF NOT EXISTS idx_resources_source ON resources(source);
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type);
CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_score ON projects(score DESC);
CREATE INDEX IF NOT EXISTS idx_projects_verified ON projects(verified);
CREATE INDEX IF NOT EXISTS idx_projects_risk ON projects(risk_level);
CREATE INDEX IF NOT EXISTS idx_projects_credibility ON projects(final_credibility_score DESC);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_funding_status ON funding_programs(status);
CREATE INDEX IF NOT EXISTS idx_funding_deadline ON funding_programs(application_deadline);
CREATE INDEX IF NOT EXISTS idx_funding_type ON funding_programs(funding_type);
CREATE INDEX IF NOT EXISTS idx_funding_created ON funding_programs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cache_key ON api_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache(expires_at);

-- Row Level Security (RLS)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE fetch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (read-only)
CREATE POLICY "Allow anonymous read access" ON resources FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON projects FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON funding_programs FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON social_metrics FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read access" ON fetch_history FOR SELECT USING (true);

-- Create policies for service role (full access)
CREATE POLICY "Service role full access" ON resources USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON projects USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON funding_programs USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON social_metrics USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON fetch_history USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON api_cache USING (auth.role() = 'service_role');

-- Create views for easy querying
CREATE OR REPLACE VIEW verified_projects AS
SELECT * FROM projects 
WHERE verified = TRUE 
  AND final_credibility_score > 60
  AND risk_level != 'high'
ORDER BY score DESC, final_credibility_score DESC;

CREATE OR REPLACE VIEW active_funding AS
SELECT * FROM funding_programs 
WHERE status IN ('open', 'ongoing')
  AND (application_deadline IS NULL OR application_deadline > CURRENT_DATE)
ORDER BY score DESC, application_deadline ASC;

CREATE OR REPLACE VIEW top_resources AS
SELECT * FROM resources 
WHERE score > 70
ORDER BY score DESC, created_at DESC;

-- Function to clean old cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM api_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get stats
CREATE OR REPLACE FUNCTION get_content_stats()
RETURNS TABLE(
  total_resources BIGINT,
  total_projects BIGINT,
  total_funding BIGINT,
  verified_projects BIGINT,
  active_funding BIGINT,
  avg_project_credibility NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM resources) as total_resources,
    (SELECT COUNT(*) FROM projects) as total_projects,
    (SELECT COUNT(*) FROM funding_programs) as total_funding,
    (SELECT COUNT(*) FROM projects WHERE verified = TRUE) as verified_projects,
    (SELECT COUNT(*) FROM funding_programs WHERE status IN ('open', 'ongoing')) as active_funding,
    (SELECT AVG(final_credibility_score) FROM projects WHERE final_credibility_score IS NOT NULL) as avg_project_credibility;
END;
$$ LANGUAGE plpgsql;

-- Create cron job to clean cache (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled:
-- SELECT cron.schedule('clean-cache', '0 * * * *', 'SELECT clean_expired_cache();');

-- Grant permissions for anon users (read-only)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Accelerate database setup completed successfully!';
  RAISE NOTICE 'Tables created: resources, projects, funding_programs, social_metrics, fetch_history, api_cache';
  RAISE NOTICE 'Views created: verified_projects, active_funding, top_resources';
  RAISE NOTICE 'Run SELECT * FROM get_content_stats(); to see current statistics';
END $$;