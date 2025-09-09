-- ============================================================
-- URGENT: CREATE STAGING TABLES - THEY DON'T EXIST!
-- Run this in Supabase SQL Editor NOW
-- ============================================================

-- 1. CREATE queue_projects TABLE
CREATE TABLE IF NOT EXISTS public.queue_projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review',
  metadata JSONB,
  ai_summary TEXT,
  
  -- Project specific fields
  team_size INTEGER,
  funding_raised DECIMAL,
  launch_date DATE,
  github_url TEXT,
  twitter_url TEXT,
  categories TEXT[],
  project_needs TEXT[],
  
  -- Review fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CREATE queue_funding_programs TABLE  
CREATE TABLE IF NOT EXISTS public.queue_funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  organization TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review',
  metadata JSONB,
  ai_summary TEXT,
  
  -- Funding specific fields
  funding_type TEXT,
  min_amount DECIMAL,
  max_amount DECIMAL,
  application_deadline DATE,
  eligibility_criteria TEXT[],
  
  -- Review fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. CREATE queue_resources TABLE
CREATE TABLE IF NOT EXISTS public.queue_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  description TEXT,
  url TEXT,
  source TEXT,
  score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending_review',
  metadata JSONB,
  ai_summary TEXT,
  
  -- Resource specific fields
  resource_type TEXT,
  category TEXT,
  price_type TEXT,
  provider_name TEXT,
  
  -- Review fields
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,
  reviewer_notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. GRANT PERMISSIONS
GRANT ALL ON public.queue_projects TO postgres, authenticated, service_role, anon;
GRANT ALL ON public.queue_funding_programs TO postgres, authenticated, service_role, anon;
GRANT ALL ON public.queue_resources TO postgres, authenticated, service_role, anon;

-- 5. DISABLE RLS
ALTER TABLE public.queue_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_funding_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_resources DISABLE ROW LEVEL SECURITY;

-- 6. CREATE INDEXES
CREATE INDEX idx_queue_projects_status ON queue_projects(status);
CREATE INDEX idx_queue_projects_score ON queue_projects(score DESC);
CREATE INDEX idx_queue_funding_status ON queue_funding_programs(status);
CREATE INDEX idx_queue_funding_score ON queue_funding_programs(score DESC);
CREATE INDEX idx_queue_resources_status ON queue_resources(status);
CREATE INDEX idx_queue_resources_score ON queue_resources(score DESC);

-- 7. TEST INSERTIONS
INSERT INTO queue_projects (name, description, url, source) 
VALUES ('Test Project', 'Test', 'https://test1.com', 'test');

INSERT INTO queue_funding_programs (name, organization, description, url, source) 
VALUES ('Test Grant', 'Org', 'Test', 'https://test2.com', 'test');

INSERT INTO queue_resources (title, description, url, source) 
VALUES ('Test Resource', 'Test', 'https://test3.com', 'test');

-- 8. VERIFY
SELECT 'queue_projects' as table_name, COUNT(*) as count FROM queue_projects
UNION ALL
SELECT 'queue_funding_programs', COUNT(*) FROM queue_funding_programs
UNION ALL
SELECT 'queue_resources', COUNT(*) FROM queue_resources;

-- 9. CLEAN UP TEST DATA
DELETE FROM queue_projects WHERE source = 'test';
DELETE FROM queue_funding_programs WHERE source = 'test';
DELETE FROM queue_resources WHERE source = 'test';

-- 10. FINAL MESSAGE
SELECT '🎉 STAGING TABLES CREATED SUCCESSFULLY!' as message,
       'System is now ready for full integration' as status;