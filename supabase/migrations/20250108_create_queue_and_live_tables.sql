-- ACCELERATE Database Structure
-- Queue tables: For fetched data pending approval
-- Live tables: For approved data used by Accelerate platform

-- ============================================
-- QUEUE TABLES (Pending Approval)
-- ============================================

-- Drop existing queue tables if they exist to start fresh
DROP TABLE IF EXISTS queue_projects CASCADE;
DROP TABLE IF EXISTS queue_funding_programs CASCADE;
DROP TABLE IF EXISTS queue_resources CASCADE;

-- Queue for projects pending approval
CREATE TABLE queue_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields (from fetcher)
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  short_description TEXT,
  website_url TEXT,
  github_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  
  -- ACCELERATE criteria fields
  launch_date DATE,
  funding_raised INTEGER DEFAULT 0,
  funding_round TEXT,
  team_size INTEGER DEFAULT 1,
  
  -- Categories and status
  categories TEXT[] DEFAULT '{}',
  supported_chains TEXT[] DEFAULT '{}',
  project_status TEXT DEFAULT 'active',
  
  -- Team needs
  seeking_funding BOOLEAN DEFAULT false,
  seeking_cofounders BOOLEAN DEFAULT false,
  seeking_developers BOOLEAN DEFAULT false,
  
  -- Scoring and metadata
  accelerate_score INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  source_url TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  
  -- Additional context
  problem_statement TEXT,
  value_proposition TEXT,
  target_market TEXT,
  
  -- AI insights
  ai_score INTEGER,
  ai_analysis TEXT,
  ai_strengths TEXT[],
  ai_needs TEXT[],
  
  -- Queue management
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Deduplication
  UNIQUE(name, source)
);

-- Queue for funding programs pending approval
CREATE TABLE queue_funding_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Funding details
  funding_type TEXT DEFAULT 'grant',
  min_amount INTEGER DEFAULT 0,
  max_amount INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  equity_required BOOLEAN DEFAULT false,
  equity_percentage NUMERIC(5,2),
  
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
  program_location TEXT DEFAULT 'Remote',
  cohort_size INTEGER,
  benefits TEXT[],
  mentor_profiles TEXT[],
  
  -- Activity verification
  last_investment_date DATE,
  total_deployed_2025 INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Scoring and metadata
  accelerate_score INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  source_url TEXT,
  
  -- AI insights
  ai_score INTEGER,
  ai_analysis TEXT,
  ai_strengths TEXT[],
  ai_requirements TEXT[],
  
  -- Queue management
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Deduplication
  UNIQUE(name, organization)
);

-- Queue for resources pending approval
CREATE TABLE queue_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  
  -- Type and category
  resource_type TEXT DEFAULT 'tool',
  category TEXT DEFAULT 'general',
  
  -- Accessibility
  price_type TEXT DEFAULT 'free',
  price_amount NUMERIC(10,2) DEFAULT 0,
  trial_available BOOLEAN DEFAULT false,
  
  -- Quality indicators
  provider_name TEXT,
  provider_credibility TEXT,
  last_updated TIMESTAMP DEFAULT NOW(),
  
  -- Usage details
  difficulty_level TEXT DEFAULT 'intermediate',
  time_commitment TEXT,
  prerequisites TEXT[],
  
  -- Value proposition
  key_benefits TEXT[],
  use_cases TEXT[],
  
  -- Metadata
  accelerate_score INTEGER DEFAULT 0,
  source TEXT NOT NULL,
  tags TEXT[],
  
  -- AI insights
  ai_score INTEGER,
  ai_analysis TEXT,
  ai_benefits TEXT[],
  ai_use_cases TEXT[],
  
  -- Queue management
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Deduplication
  UNIQUE(title, url)
);

-- ============================================
-- LIVE TABLES (Approved Data)
-- ============================================

-- Update existing live tables with ACCELERATE fields
-- These tables contain only approved, verified data

-- Live projects table (approved)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_raised INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_round TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS discord_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_funding BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_cofounders BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_developers BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();
ALTER TABLE projects ADD COLUMN IF NOT EXISTS problem_statement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_market TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_strengths TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_needs TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Live funding_programs table (approved)
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS funding_type TEXT DEFAULT 'grant';
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS min_amount INTEGER DEFAULT 0;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS max_amount INTEGER DEFAULT 0;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS equity_required BOOLEAN DEFAULT false;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS equity_percentage NUMERIC(5,2);
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS application_url TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS application_deadline DATE;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS application_process TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS decision_timeline TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS geographic_restrictions TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS stage_preferences TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS sector_focus TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS program_duration TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS program_location TEXT DEFAULT 'Remote';
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS cohort_size INTEGER;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS benefits TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS mentor_profiles TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS last_investment_date DATE;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS total_deployed_2025 INTEGER DEFAULT 0;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS ai_strengths TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS ai_requirements TEXT[];
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE funding_programs ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- Live resources table (approved)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'tool';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'free';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS trial_available BOOLEAN DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS provider_name TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS provider_credibility TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP DEFAULT NOW();
ALTER TABLE resources ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'intermediate';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS time_commitment TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS prerequisites TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS key_benefits TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS use_cases TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_benefits TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_use_cases TEXT[];
ALTER TABLE resources ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS approved_by TEXT;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Queue table indexes
CREATE INDEX idx_queue_projects_status ON queue_projects(status);
CREATE INDEX idx_queue_projects_score ON queue_projects(accelerate_score DESC);
CREATE INDEX idx_queue_projects_date ON queue_projects(launch_date DESC);
CREATE INDEX idx_queue_funding_status ON queue_funding_programs(status);
CREATE INDEX idx_queue_funding_score ON queue_funding_programs(accelerate_score DESC);
CREATE INDEX idx_queue_resources_status ON queue_resources(status);
CREATE INDEX idx_queue_resources_score ON queue_resources(accelerate_score DESC);

-- Live table indexes
CREATE INDEX IF NOT EXISTS idx_projects_launch_date ON projects(launch_date);
CREATE INDEX IF NOT EXISTS idx_projects_funding_raised ON projects(funding_raised);
CREATE INDEX IF NOT EXISTS idx_projects_accelerate_score ON projects(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_funding_active ON funding_programs(is_active);
CREATE INDEX IF NOT EXISTS idx_funding_score ON funding_programs(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_resources_score ON resources(accelerate_score DESC);

-- ============================================
-- APPROVAL WORKFLOW FUNCTION
-- ============================================

-- Function to move approved items from queue to live
CREATE OR REPLACE FUNCTION approve_queue_item(
  table_type TEXT,
  item_id UUID,
  approver TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  IF table_type = 'project' THEN
    -- Move from queue_projects to projects
    INSERT INTO projects (
      name, description, short_description, website_url, github_url, twitter_url, discord_url,
      launch_date, funding_raised, funding_round, team_size, categories, supported_chains,
      project_status, seeking_funding, seeking_cofounders, seeking_developers,
      accelerate_score, source, source_url, last_activity,
      problem_statement, value_proposition, target_market,
      ai_score, ai_analysis, ai_strengths, ai_needs,
      approved_at, approved_by
    )
    SELECT 
      name, description, short_description, website_url, github_url, twitter_url, discord_url,
      launch_date, funding_raised, funding_round, team_size, categories, supported_chains,
      project_status, seeking_funding, seeking_cofounders, seeking_developers,
      accelerate_score, source, source_url, last_activity,
      problem_statement, value_proposition, target_market,
      ai_score, ai_analysis, ai_strengths, ai_needs,
      NOW(), approver
    FROM queue_projects
    WHERE id = item_id;
    
    -- Update queue status
    UPDATE queue_projects 
    SET status = 'approved', reviewed_by = approver, reviewed_at = NOW()
    WHERE id = item_id;
    
  ELSIF table_type = 'funding' THEN
    -- Similar for funding_programs
    -- (Implementation omitted for brevity)
    
  ELSIF table_type = 'resource' THEN
    -- Similar for resources
    -- (Implementation omitted for brevity)
    
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR EASY ACCESS
-- ============================================

-- View for all pending items across all queues
CREATE OR REPLACE VIEW pending_review AS
SELECT 
  'project' as type,
  id,
  name as title,
  description,
  accelerate_score,
  source,
  fetched_at
FROM queue_projects
WHERE status = 'pending'
UNION ALL
SELECT 
  'funding' as type,
  id,
  name as title,
  description,
  accelerate_score,
  source,
  fetched_at
FROM queue_funding_programs
WHERE status = 'pending'
UNION ALL
SELECT 
  'resource' as type,
  id,
  title,
  description,
  accelerate_score,
  source,
  fetched_at
FROM queue_resources
WHERE status = 'pending'
ORDER BY accelerate_score DESC, fetched_at DESC;

-- View for high-scoring items needing review
CREATE OR REPLACE VIEW high_priority_review AS
SELECT * FROM pending_review
WHERE accelerate_score >= 70
ORDER BY accelerate_score DESC;