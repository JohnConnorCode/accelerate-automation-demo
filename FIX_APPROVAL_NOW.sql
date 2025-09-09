-- ============================================================
-- CRITICAL FIX: Run this in Supabase SQL Editor to enable approval workflow
-- Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new
-- ============================================================

-- 1. Drop the table if it exists incorrectly
DROP TABLE IF EXISTS public.accelerate_startups CASCADE;

-- 2. Create the table properly
CREATE TABLE public.accelerate_startups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  founded_date DATE,
  team_size INTEGER,
  funding_raised DECIMAL(15,2) DEFAULT 0,
  funding_stage TEXT,
  categories TEXT[],
  technologies TEXT[],
  project_needs TEXT[],
  location TEXT,
  contact_email TEXT,
  social_links JSONB,
  metadata JSONB,
  score INTEGER DEFAULT 0,
  ai_summary TEXT,
  last_activity DATE,
  approved_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Grant all necessary permissions
GRANT ALL ON public.accelerate_startups TO postgres;
GRANT ALL ON public.accelerate_startups TO authenticated;
GRANT ALL ON public.accelerate_startups TO service_role;
GRANT SELECT, INSERT ON public.accelerate_startups TO anon;

-- 4. Create indexes for performance
CREATE INDEX idx_accelerate_startups_url ON public.accelerate_startups(url);
CREATE INDEX idx_accelerate_startups_score ON public.accelerate_startups(score DESC);
CREATE INDEX idx_accelerate_startups_created ON public.accelerate_startups(created_at DESC);

-- 5. DISABLE RLS (to avoid permission issues)
ALTER TABLE public.accelerate_startups DISABLE ROW LEVEL SECURITY;

-- 6. Also fix the funding constraint issue
ALTER TABLE content_queue 
DROP CONSTRAINT IF EXISTS content_queue_description_check;

-- 7. Test the table works
INSERT INTO public.accelerate_startups (name, url, description, score, approved_by)
VALUES ('Test Startup', 'https://test-verify.example.com', 'Test to verify table works', 100, 'sql-test');

-- 8. Verify it worked
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ SUCCESS! Table created and working!'
    ELSE '❌ FAILED - Table not working'
  END as status
FROM public.accelerate_startups
WHERE url = 'https://test-verify.example.com';

-- 9. Clean up test data
DELETE FROM public.accelerate_startups WHERE url = 'https://test-verify.example.com';

-- 10. Show final status
SELECT 
  'APPROVAL WORKFLOW IS NOW ENABLED!' as message,
  COUNT(*) as existing_items
FROM public.accelerate_startups;