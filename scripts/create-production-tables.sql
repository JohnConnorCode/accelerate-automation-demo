-- CREATE MISSING PRODUCTION TABLES FOR APPROVAL WORKFLOW
-- These are the target tables that approved items move to from queue tables
-- Run this in Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. ACCELERATE_STARTUPS TABLE (for approved projects)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accelerate_startups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core fields (CRITICAL: uses 'name' not 'company_name')
  name TEXT NOT NULL,
  description TEXT,
  website TEXT,

  -- Team & Location
  founders TEXT[] DEFAULT ARRAY[]::TEXT[],
  team_size INTEGER,
  location TEXT,
  country TEXT,

  -- Funding
  funding_amount DECIMAL(15,2),
  funding_round TEXT,
  funding_investors TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Technology
  technology_stack TEXT[] DEFAULT ARRAY[]::TEXT[],
  industry_tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Metadata
  source TEXT,
  source_url TEXT,

  -- ACCELERATE fields
  accelerate_fit BOOLEAN DEFAULT true,
  accelerate_reason TEXT,
  accelerate_score DECIMAL(3,2) DEFAULT 0,

  -- Approval tracking
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by TEXT DEFAULT 'admin',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 2. ACCELERATE_INVESTORS TABLE (for approved investors)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accelerate_investors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core fields (from queue_investors structure)
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,

  -- Funding specific fields
  amount_min DECIMAL(15,2),
  amount_max DECIMAL(15,2),
  deadline TIMESTAMP WITH TIME ZONE,
  organization TEXT,
  eligibility_criteria JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- ACCELERATE fields
  accelerate_fit BOOLEAN DEFAULT true,
  accelerate_reason TEXT,
  accelerate_score DECIMAL(3,2) DEFAULT 0,

  -- Approval tracking
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by TEXT DEFAULT 'admin',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- 3. ACCELERATE_NEWS TABLE (for approved news)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.accelerate_news (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core fields (from queue_news structure)
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,

  -- News specific fields
  category TEXT,
  author TEXT,
  published_date TIMESTAMP WITH TIME ZONE,

  -- Metadata
  source TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- ACCELERATE fields
  accelerate_fit BOOLEAN DEFAULT true,
  accelerate_reason TEXT,
  accelerate_score DECIMAL(3,2) DEFAULT 0,

  -- Approval tracking
  approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by TEXT DEFAULT 'admin',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Accelerate Startups indexes
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_name ON accelerate_startups(name);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_created_at ON accelerate_startups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_score ON accelerate_startups(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_approved_at ON accelerate_startups(approved_at DESC);

-- Accelerate Investors indexes
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_url ON accelerate_investors(url);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_organization ON accelerate_investors(organization);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_created_at ON accelerate_investors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_score ON accelerate_investors(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_investors_deadline ON accelerate_investors(deadline);

-- Accelerate News indexes
CREATE INDEX IF NOT EXISTS idx_accelerate_news_url ON accelerate_news(url);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_category ON accelerate_news(category);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_created_at ON accelerate_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_score ON accelerate_news(accelerate_score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_news_published_date ON accelerate_news(published_date DESC);

-- =============================================================================
-- UPDATE TRIGGERS
-- =============================================================================

-- Create or replace the update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers for all three tables
CREATE TRIGGER update_accelerate_startups_updated_at
  BEFORE UPDATE ON accelerate_startups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accelerate_investors_updated_at
  BEFORE UPDATE ON accelerate_investors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accelerate_news_updated_at
  BEFORE UPDATE ON accelerate_news
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- PERMISSIONS
-- =============================================================================

-- Grant permissions to authenticated users
GRANT ALL ON public.accelerate_startups TO authenticated;
GRANT ALL ON public.accelerate_investors TO authenticated;
GRANT ALL ON public.accelerate_news TO authenticated;

-- Grant permissions to service role
GRANT ALL ON public.accelerate_startups TO service_role;
GRANT ALL ON public.accelerate_investors TO service_role;
GRANT ALL ON public.accelerate_news TO service_role;

-- Grant read access to anonymous users (for public API)
GRANT SELECT ON public.accelerate_startups TO anon;
GRANT SELECT ON public.accelerate_investors TO anon;
GRANT SELECT ON public.accelerate_news TO anon;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================

-- Verify all tables were created successfully
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('accelerate_startups', 'accelerate_investors', 'accelerate_news')
ORDER BY table_name, ordinal_position;

-- Check table existence
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('accelerate_startups', 'accelerate_investors', 'accelerate_news');

-- =============================================================================
-- SUMMARY
-- =============================================================================

-- This script creates the three missing production tables that the approval
-- service expects to exist:
--
-- 1. accelerate_startups - for approved Web3 projects (queue_projects → here)
-- 2. accelerate_investors - for approved funding opportunities (queue_investors → here)
-- 3. accelerate_news - for approved news/resources (queue_news → here)
--
-- The approval workflow will now work: Fetch → Queue → Approve → Production
--
-- CRITICAL NOTES:
-- - accelerate_startups uses 'name' column, not 'company_name'
-- - All tables have proper indexes for performance
-- - Update triggers maintain updated_at timestamps
-- - Permissions are set for all user roles
-- - Unique constraints on URLs prevent duplicates