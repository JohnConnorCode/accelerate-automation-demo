-- ============================================================
-- CREATE STAGING TABLES FOR UNAPPROVED CONTENT
-- Three separate staging tables for each content type
-- ============================================================

-- 1. STAGING TABLE FOR PROJECTS
DROP TABLE IF EXISTS public.queued_projects CASCADE;
CREATE TABLE public.queued_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 50),
  short_description TEXT,
  url TEXT UNIQUE NOT NULL,
  
  -- Stage Information
  launch_date DATE,
  funding_raised DECIMAL(15,2) DEFAULT 0,
  funding_round TEXT,
  team_size INTEGER,
  
  -- URLs
  website_url TEXT,
  github_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  
  -- Categories & Tags
  categories TEXT[],
  supported_chains TEXT[],
  project_needs TEXT[],
  
  -- Validation
  grant_participation TEXT[],
  incubator_participation TEXT[],
  traction_metrics JSONB,
  
  -- Activity
  last_activity DATE,
  development_status TEXT,
  
  -- Detailed Context
  problem_solving TEXT,
  unique_value_prop TEXT,
  target_market TEXT,
  roadmap_highlights TEXT[],
  
  -- Queue Management
  source TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_info')),
  ai_summary TEXT,
  metadata JSONB,
  
  -- Review Fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. STAGING TABLE FOR FUNDING PROGRAMS
DROP TABLE IF EXISTS public.queued_funding_programs CASCADE;
CREATE TABLE public.queued_funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 50),
  url TEXT UNIQUE NOT NULL,
  
  -- Funding Details
  funding_type TEXT CHECK (funding_type IN ('grant', 'accelerator', 'incubator', 'vc')),
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  equity_required BOOLEAN DEFAULT false,
  equity_percentage DECIMAL(5,2),
  
  -- Application Details
  application_url TEXT,
  application_deadline DATE,
  application_process TEXT,
  decision_timeline TEXT,
  
  -- Eligibility
  eligibility_criteria TEXT[],
  geographic_restrictions TEXT[],
  stage_preferences TEXT[],
  sector_focus TEXT[],
  
  -- Program Details
  program_duration TEXT,
  program_location TEXT,
  cohort_size INTEGER,
  
  -- Benefits
  benefits TEXT[],
  mentor_profiles TEXT[],
  alumni_companies TEXT[],
  
  -- Activity Verification
  last_investment_date DATE,
  recent_portfolio TEXT[],
  total_deployed_2025 DECIMAL(15,2),
  
  -- Queue Management
  source TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_info')),
  ai_summary TEXT,
  metadata JSONB,
  
  -- Review Fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. STAGING TABLE FOR RESOURCES
DROP TABLE IF EXISTS public.queued_resources CASCADE;
CREATE TABLE public.queued_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Info
  title TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 50),
  url TEXT UNIQUE NOT NULL,
  
  -- Type & Category
  resource_type TEXT CHECK (resource_type IN ('tool', 'course', 'community', 'infrastructure', 'documentation')),
  category TEXT,
  
  -- Accessibility
  price_type TEXT CHECK (price_type IN ('free', 'freemium', 'paid', 'subscription')),
  price_amount DECIMAL(10,2),
  trial_available BOOLEAN,
  
  -- Quality Indicators
  provider_name TEXT,
  provider_credibility TEXT,
  last_updated DATE,
  
  -- Usage Details
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'all_levels')),
  time_commitment TEXT,
  prerequisites TEXT[],
  
  -- Value Proposition
  key_benefits TEXT[],
  use_cases TEXT[],
  success_stories TEXT[],
  
  -- Queue Management
  source TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'needs_info')),
  ai_summary TEXT,
  metadata JSONB,
  
  -- Review Fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Indexes for queued_projects
CREATE INDEX idx_queued_projects_status ON public.queued_projects(status);
CREATE INDEX idx_queued_projects_score ON public.queued_projects(score DESC);
CREATE INDEX idx_queued_projects_created ON public.queued_projects(created_at DESC);
CREATE INDEX idx_queued_projects_source ON public.queued_projects(source);

-- Indexes for queued_funding_programs
CREATE INDEX idx_queued_funding_status ON public.queued_funding_programs(status);
CREATE INDEX idx_queued_funding_score ON public.queued_funding_programs(score DESC);
CREATE INDEX idx_queued_funding_created ON public.queued_funding_programs(created_at DESC);
CREATE INDEX idx_queued_funding_deadline ON public.queued_funding_programs(application_deadline);

-- Indexes for queued_resources
CREATE INDEX idx_queued_resources_status ON public.queued_resources(status);
CREATE INDEX idx_queued_resources_score ON public.queued_resources(score DESC);
CREATE INDEX idx_queued_resources_created ON public.queued_resources(created_at DESC);
CREATE INDEX idx_queued_resources_type ON public.queued_resources(resource_type);

-- ============================================================
-- PERMISSIONS
-- ============================================================

-- Grant permissions for queued_projects
GRANT ALL ON public.queued_projects TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.queued_projects TO anon;

-- Grant permissions for queued_funding_programs
GRANT ALL ON public.queued_funding_programs TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.queued_funding_programs TO anon;

-- Grant permissions for queued_resources
GRANT ALL ON public.queued_resources TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.queued_resources TO anon;

-- ============================================================
-- DISABLE RLS (for easier access)
-- ============================================================

ALTER TABLE public.queued_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queued_funding_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queued_resources DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check all tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('queued_projects', 'queued_funding_programs', 'queued_resources')
    THEN '✅ Created'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'queued_%'
ORDER BY table_name;

-- Final message
SELECT 
  '🎯 STAGING TABLES CREATED!' as message,
  'Three separate staging tables for unapproved content' as description;