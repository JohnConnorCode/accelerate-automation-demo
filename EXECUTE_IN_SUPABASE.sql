-- ===================================================================
-- STAGING TABLES CREATION SCRIPT
-- Execute this in Supabase SQL Editor Dashboard
-- ===================================================================

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

-- 4. DISABLE ROW LEVEL SECURITY (for ease of access)
ALTER TABLE public.queue_projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_funding_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_resources DISABLE ROW LEVEL SECURITY;

-- 5. GRANT PERMISSIONS
GRANT ALL ON public.queue_projects TO postgres, authenticated, service_role, anon;
GRANT ALL ON public.queue_funding_programs TO postgres, authenticated, service_role, anon;
GRANT ALL ON public.queue_resources TO postgres, authenticated, service_role, anon;

-- 6. CREATE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON public.queue_projects(status);
CREATE INDEX IF NOT EXISTS idx_queue_projects_score ON public.queue_projects(score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_projects_source ON public.queue_projects(source);
CREATE INDEX IF NOT EXISTS idx_queue_projects_created ON public.queue_projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_funding_status ON public.queue_funding_programs(status);
CREATE INDEX IF NOT EXISTS idx_queue_funding_score ON public.queue_funding_programs(score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_funding_source ON public.queue_funding_programs(source);
CREATE INDEX IF NOT EXISTS idx_queue_funding_created ON public.queue_funding_programs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_resources_status ON public.queue_resources(status);
CREATE INDEX IF NOT EXISTS idx_queue_resources_score ON public.queue_resources(score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_resources_source ON public.queue_resources(source);
CREATE INDEX IF NOT EXISTS idx_queue_resources_created ON public.queue_resources(created_at DESC);

-- 7. INSERT TEST DATA TO VERIFY TABLES WORK
INSERT INTO public.queue_projects (name, description, url, source, score) 
VALUES 
  ('Test Project 1', 'First test project', 'https://test1.com', 'sql-test', 85),
  ('Test Project 2', 'Second test project', 'https://test2.com', 'sql-test', 92);

INSERT INTO public.queue_funding_programs (name, organization, description, url, source, score) 
VALUES 
  ('Test Grant Program', 'Test Organization', 'A test grant program', 'https://testgrant.com', 'sql-test', 88),
  ('Test Accelerator', 'Test Ventures', 'A test accelerator program', 'https://testaccel.com', 'sql-test', 95);

INSERT INTO public.queue_resources (title, description, url, source, score) 
VALUES 
  ('Test Development Tool', 'A useful development tool', 'https://testtool.com', 'sql-test', 78),
  ('Test Learning Resource', 'An educational resource', 'https://testlearn.com', 'sql-test', 82);

-- 8. VERIFY TABLE CREATION AND DATA
SELECT 'VERIFICATION RESULTS' as message;

SELECT 
  'queue_projects' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN source = 'sql-test' THEN 1 END) as test_rows
FROM public.queue_projects

UNION ALL

SELECT 
  'queue_funding_programs' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN source = 'sql-test' THEN 1 END) as test_rows
FROM public.queue_funding_programs

UNION ALL

SELECT 
  'queue_resources' as table_name,
  COUNT(*) as total_rows,
  COUNT(CASE WHEN source = 'sql-test' THEN 1 END) as test_rows
FROM public.queue_resources;

-- 9. CLEAN UP TEST DATA (optional - remove if you want to keep test data)
DELETE FROM public.queue_projects WHERE source = 'sql-test';
DELETE FROM public.queue_funding_programs WHERE source = 'sql-test';
DELETE FROM public.queue_resources WHERE source = 'sql-test';

-- 10. FINAL STATUS MESSAGE
SELECT 
  '🎉 STAGING TABLES CREATED SUCCESSFULLY!' as status,
  'All three queue tables are ready for production use' as message,
  NOW() as created_at;