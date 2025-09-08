-- Add ACCELERATE criteria fields to projects table
-- These fields are REQUIRED for proper ACCELERATE functionality

-- Core ACCELERATE criteria fields
ALTER TABLE projects ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_raised INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS funding_round TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS team_size INTEGER DEFAULT 1;

-- Categories and status
ALTER TABLE projects ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_status TEXT DEFAULT 'active';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS discord_url TEXT;

-- Team needs (ACCELERATE specific)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_funding BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_cofounders BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS seeking_developers BOOLEAN DEFAULT false;

-- Scoring and metadata
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accelerate_score INTEGER DEFAULT 0;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP DEFAULT NOW();

-- Additional context
ALTER TABLE projects ADD COLUMN IF NOT EXISTS problem_statement TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS value_proposition TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_market TEXT;

-- AI-generated insights
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_score INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_analysis TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_strengths TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_needs TEXT[];

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_launch_date ON projects(launch_date);
CREATE INDEX IF NOT EXISTS idx_projects_funding_raised ON projects(funding_raised);
CREATE INDEX IF NOT EXISTS idx_projects_team_size ON projects(team_size);
CREATE INDEX IF NOT EXISTS idx_projects_accelerate_score ON projects(accelerate_score);
CREATE INDEX IF NOT EXISTS idx_projects_source ON projects(source);

-- Add constraints to enforce ACCELERATE criteria
ALTER TABLE projects ADD CONSTRAINT check_team_size CHECK (team_size >= 1 AND team_size <= 100);
ALTER TABLE projects ADD CONSTRAINT check_funding_raised CHECK (funding_raised >= 0);
ALTER TABLE projects ADD CONSTRAINT check_accelerate_score CHECK (accelerate_score >= 0 AND accelerate_score <= 100);

-- Create similar structure for funding_programs table
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

-- Create similar structure for resources table
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

-- Create content_sources table if it doesn't exist
CREATE TABLE IF NOT EXISTS content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_identifier TEXT,
  accelerate_score INTEGER,
  fetched_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(url, table_name)
);