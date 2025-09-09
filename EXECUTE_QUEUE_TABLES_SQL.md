# Execute Queue Tables SQL in Supabase

## 🚨 MANDATORY: Execute this SQL to create queue tables

The queue tables are **required** for the application to function properly. Please execute the SQL manually in the Supabase dashboard.

## 📍 Step-by-Step Instructions

### 1. Open Supabase SQL Editor
- Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new
- Or navigate to your project → SQL Editor → New query

### 2. Copy and Execute the SQL

Copy this entire SQL block and paste it into the SQL Editor:

```sql
-- ============================================================
-- ROBUST QUEUE TABLES WITH COMPLETE FIELD REQUIREMENTS
-- Three separate tables with strict schema enforcement
-- ============================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS public.queue_projects CASCADE;
DROP TABLE IF EXISTS public.queue_funding_programs CASCADE;
DROP TABLE IF EXISTS public.queue_resources CASCADE;

-- ============================================================
-- 1. QUEUE_PROJECTS - For startup/project submissions
-- ============================================================
CREATE TABLE public.queue_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Information (REQUIRED)
  name TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 100),
  short_description TEXT NOT NULL CHECK (length(short_description) <= 200),
  url TEXT NOT NULL UNIQUE,
  
  -- Team Information (REQUIRED for ACCELERATE)
  team_size INTEGER NOT NULL CHECK (team_size > 0 AND team_size <= 100),
  founder_names TEXT[] NOT NULL CHECK (array_length(founder_names, 1) > 0),
  founder_linkedin_urls TEXT[],
  
  -- Funding Information (REQUIRED)
  funding_raised DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (funding_raised >= 0),
  funding_stage TEXT NOT NULL CHECK (funding_stage IN ('pre-seed', 'seed', 'series-a', 'bootstrapped', 'grant-funded')),
  previous_investors TEXT[],
  seeking_amount DECIMAL(15,2),
  
  -- Project Details (REQUIRED)
  launch_date DATE NOT NULL,
  incorporation_date DATE,
  incorporation_country TEXT,
  
  -- Technical Information
  github_url TEXT,
  github_stars INTEGER DEFAULT 0,
  github_last_commit DATE,
  demo_url TEXT,
  technical_stack TEXT[] NOT NULL CHECK (array_length(technical_stack, 1) > 0),
  
  -- Social Presence (At least one required)
  twitter_url TEXT,
  twitter_followers INTEGER DEFAULT 0,
  discord_url TEXT,
  discord_members INTEGER DEFAULT 0,
  telegram_url TEXT,
  website_traffic_monthly INTEGER,
  
  -- Categories and Focus
  categories TEXT[] NOT NULL CHECK (array_length(categories, 1) > 0),
  supported_chains TEXT[],
  target_market TEXT NOT NULL,
  
  -- Traction Metrics
  active_users INTEGER DEFAULT 0,
  monthly_revenue DECIMAL(15,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  tvl_usd DECIMAL(15,2) DEFAULT 0,
  
  -- Validation and Programs
  grant_participation TEXT[],
  incubator_participation TEXT[],
  hackathon_wins TEXT[],
  
  -- Project Needs (REQUIRED for matching)
  project_needs TEXT[] NOT NULL CHECK (array_length(project_needs, 1) > 0),
  
  -- Detailed Context (REQUIRED for evaluation)
  problem_statement TEXT NOT NULL CHECK (length(problem_statement) >= 100),
  solution_description TEXT NOT NULL CHECK (length(solution_description) >= 100),
  unique_value_proposition TEXT NOT NULL CHECK (length(unique_value_proposition) >= 50),
  competitive_advantage TEXT,
  roadmap_milestones TEXT[],
  
  -- Data Quality Fields
  data_completeness_score DECIMAL(3,2) CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'partially-verified', 'verified')),
  last_enrichment_date TIMESTAMP,
  enrichment_sources TEXT[],
  
  -- Queue Management
  source TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  ai_analysis JSONB,
  
  -- Review Status
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'approved', 'rejected', 'needs_info')),
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints to ensure data quality
  CONSTRAINT valid_team_for_accelerate CHECK (team_size <= 10),
  CONSTRAINT valid_funding_for_accelerate CHECK (funding_raised < 500000),
  CONSTRAINT valid_launch_date CHECK (launch_date >= '2024-01-01'),
  CONSTRAINT has_social_presence CHECK (
    twitter_url IS NOT NULL OR 
    discord_url IS NOT NULL OR 
    telegram_url IS NOT NULL
  )
);

-- ============================================================
-- 2. QUEUE_FUNDING_PROGRAMS - For grants/accelerators/VCs
-- ============================================================
CREATE TABLE public.queue_funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Information (REQUIRED)
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 100),
  url TEXT NOT NULL UNIQUE,
  
  -- Funding Details (REQUIRED)
  funding_type TEXT NOT NULL CHECK (funding_type IN ('grant', 'accelerator', 'incubator', 'vc', 'angel', 'dao')),
  min_amount DECIMAL(15,2) NOT NULL CHECK (min_amount >= 0),
  max_amount DECIMAL(15,2) NOT NULL CHECK (max_amount >= min_amount),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_fund_size DECIMAL(15,2),
  
  -- Investment Terms
  equity_required BOOLEAN NOT NULL DEFAULT false,
  equity_percentage_min DECIMAL(5,2) CHECK (equity_percentage_min >= 0 AND equity_percentage_min <= 100),
  equity_percentage_max DECIMAL(5,2) CHECK (equity_percentage_max >= equity_percentage_min AND equity_percentage_max <= 100),
  token_allocation BOOLEAN DEFAULT false,
  token_percentage DECIMAL(5,2),
  
  -- Application Details (REQUIRED)
  application_url TEXT NOT NULL,
  application_deadline DATE,
  application_process_description TEXT NOT NULL,
  decision_timeline_days INTEGER CHECK (decision_timeline_days > 0),
  next_cohort_start DATE,
  
  -- Eligibility (REQUIRED)
  eligibility_criteria TEXT[] NOT NULL CHECK (array_length(eligibility_criteria, 1) > 0),
  geographic_focus TEXT[],
  excluded_countries TEXT[],
  stage_preferences TEXT[] NOT NULL CHECK (array_length(stage_preferences, 1) > 0),
  sector_focus TEXT[] NOT NULL CHECK (array_length(sector_focus, 1) > 0),
  
  -- Program Details
  program_duration_weeks INTEGER CHECK (program_duration_weeks > 0),
  program_location TEXT,
  remote_friendly BOOLEAN DEFAULT false,
  cohort_size INTEGER CHECK (cohort_size > 0),
  acceptance_rate DECIMAL(5,2) CHECK (acceptance_rate >= 0 AND acceptance_rate <= 100),
  
  -- Benefits and Support (REQUIRED)
  benefits TEXT[] NOT NULL CHECK (array_length(benefits, 1) > 0),
  mentor_profiles TEXT[],
  partner_perks TEXT[],
  office_hours BOOLEAN DEFAULT false,
  demo_day BOOLEAN DEFAULT false,
  
  -- Track Record (REQUIRED for credibility)
  founded_year INTEGER CHECK (founded_year >= 1900 AND founded_year <= extract(year from now())),
  total_investments_made INTEGER DEFAULT 0 CHECK (total_investments_made >= 0),
  notable_portfolio_companies TEXT[],
  successful_exits TEXT[],
  
  -- Recent Activity (REQUIRED)
  last_investment_date DATE NOT NULL,
  recent_investments TEXT[] NOT NULL CHECK (array_length(recent_investments, 1) > 0),
  active_status BOOLEAN NOT NULL DEFAULT true,
  
  -- Contact Information
  contact_email TEXT,
  contact_name TEXT,
  contact_linkedin TEXT,
  twitter_url TEXT,
  
  -- Data Quality
  data_completeness_score DECIMAL(3,2) CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'partially-verified', 'verified')),
  last_enrichment_date TIMESTAMP,
  
  -- Queue Management
  source TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  ai_analysis JSONB,
  
  -- Review Status
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'approved', 'rejected', 'needs_info')),
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure it's currently active
  CONSTRAINT must_be_active CHECK (
    last_investment_date >= CURRENT_DATE - INTERVAL '6 months' OR
    application_deadline > CURRENT_DATE
  )
);

-- ============================================================
-- 3. QUEUE_RESOURCES - For tools/courses/communities
-- ============================================================
CREATE TABLE public.queue_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Basic Information (REQUIRED)
  title TEXT NOT NULL,
  description TEXT NOT NULL CHECK (length(description) >= 100),
  url TEXT NOT NULL UNIQUE,
  
  -- Resource Type and Category (REQUIRED)
  resource_type TEXT NOT NULL CHECK (resource_type IN ('tool', 'course', 'community', 'infrastructure', 'documentation', 'api', 'framework')),
  primary_category TEXT NOT NULL,
  sub_categories TEXT[],
  tags TEXT[] NOT NULL CHECK (array_length(tags, 1) > 0),
  
  -- Provider Information (REQUIRED)
  provider_name TEXT NOT NULL,
  provider_url TEXT NOT NULL,
  provider_type TEXT CHECK (provider_type IN ('company', 'individual', 'dao', 'open-source', 'academic')),
  provider_reputation_score DECIMAL(3,2) CHECK (provider_reputation_score >= 0 AND provider_reputation_score <= 5),
  
  -- Pricing (REQUIRED)
  price_type TEXT NOT NULL CHECK (price_type IN ('free', 'freemium', 'paid', 'subscription', 'one-time', 'usage-based')),
  price_amount_min DECIMAL(10,2) CHECK (price_amount_min >= 0),
  price_amount_max DECIMAL(10,2) CHECK (price_amount_max >= price_amount_min),
  price_currency TEXT DEFAULT 'USD',
  free_tier_limitations TEXT,
  trial_available BOOLEAN DEFAULT false,
  trial_duration_days INTEGER CHECK (trial_duration_days > 0),
  
  -- Quality Indicators (REQUIRED)
  last_updated DATE NOT NULL,
  update_frequency TEXT CHECK (update_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'as-needed')),
  version TEXT,
  stability_status TEXT CHECK (stability_status IN ('alpha', 'beta', 'stable', 'deprecated')),
  
  -- Usage Details
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert', 'all-levels')),
  time_to_implement_hours INTEGER CHECK (time_to_implement_hours > 0),
  prerequisites TEXT[],
  programming_languages TEXT[],
  
  -- Features and Benefits (REQUIRED)
  key_features TEXT[] NOT NULL CHECK (array_length(key_features, 1) > 0),
  use_cases TEXT[] NOT NULL CHECK (array_length(use_cases, 1) > 0),
  benefits TEXT[] NOT NULL CHECK (array_length(benefits, 1) > 0),
  limitations TEXT[],
  
  -- Documentation and Support
  documentation_url TEXT,
  documentation_quality TEXT CHECK (documentation_quality IN ('excellent', 'good', 'fair', 'poor', 'none')),
  support_channels TEXT[],
  response_time_hours INTEGER,
  
  -- Community and Adoption
  github_url TEXT,
  github_stars INTEGER DEFAULT 0 CHECK (github_stars >= 0),
  npm_downloads_monthly INTEGER CHECK (npm_downloads_monthly >= 0),
  active_users INTEGER CHECK (active_users >= 0),
  community_size INTEGER CHECK (community_size >= 0),
  
  -- Reviews and Ratings
  average_rating DECIMAL(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
  total_reviews INTEGER DEFAULT 0 CHECK (total_reviews >= 0),
  recommendation_score INTEGER CHECK (recommendation_score >= 0 AND recommendation_score <= 100),
  
  -- Alternatives and Comparisons
  direct_competitors TEXT[],
  unique_selling_points TEXT[],
  best_for_scenarios TEXT[],
  not_suitable_for TEXT[],
  
  -- Integration and Compatibility
  integrations TEXT[],
  supported_platforms TEXT[],
  system_requirements TEXT,
  
  -- Data Quality
  data_completeness_score DECIMAL(3,2) CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1),
  verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'partially-verified', 'verified')),
  last_enrichment_date TIMESTAMP,
  
  -- Queue Management
  source TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  ai_analysis JSONB,
  
  -- Review Status
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'approved', 'rejected', 'needs_info')),
  reviewer_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure resource is current
  CONSTRAINT resource_is_current CHECK (last_updated >= CURRENT_DATE - INTERVAL '6 months')
);

-- Create indexes for performance
CREATE INDEX idx_queue_projects_status ON queue_projects(status);
CREATE INDEX idx_queue_projects_score ON queue_projects(score DESC);
CREATE INDEX idx_queue_funding_status ON queue_funding_programs(status);
CREATE INDEX idx_queue_funding_score ON queue_funding_programs(score DESC);
CREATE INDEX idx_queue_resources_status ON queue_resources(status);
CREATE INDEX idx_queue_resources_score ON queue_resources(score DESC);

-- Grant permissions
GRANT ALL ON queue_projects TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON queue_projects TO anon;
GRANT ALL ON queue_funding_programs TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON queue_funding_programs TO anon;
GRANT ALL ON queue_resources TO postgres, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON queue_resources TO anon;

-- Enable RLS
ALTER TABLE queue_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_resources ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow read access" ON queue_projects FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON queue_funding_programs FOR SELECT USING (true);
CREATE POLICY "Allow read access" ON queue_resources FOR SELECT USING (true);
CREATE POLICY "Service role only" ON queue_projects FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON queue_funding_programs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON queue_resources FOR ALL USING (auth.role() = 'service_role');
```

### 3. Click "RUN" to execute

### 4. Verify Success
- You should see "SUCCESS" message
- Tables will be created: `queue_projects`, `queue_funding_programs`, `queue_resources`

### 5. Test with Verification Script
After executing the SQL, run this command to verify:
```bash
node verify_queue_tables.js
```

## 📋 What These Tables Do

### queue_projects
- Stores startup/project submissions before review
- Comprehensive fields for ACCELERATE criteria validation
- Scoring and AI analysis capabilities
- Manual review workflow support

### queue_funding_programs  
- Stores grants, accelerators, VC programs before review
- Investment terms and eligibility criteria
- Application deadlines and program details
- Track record validation

### queue_resources
- Stores tools, courses, communities before review  
- Pricing and feature information
- Quality indicators and user ratings
- Integration compatibility details

## 🚨 IMPORTANT
These tables are **mandatory** for the application to function. The queue system requires all three tables to be present with the exact schema defined above.

After creating the tables, the application will be able to:
1. Fetch data from various sources
2. Queue items for manual review  
3. Score and analyze content with AI
4. Approve/reject items for publication
5. Move approved content to live tables