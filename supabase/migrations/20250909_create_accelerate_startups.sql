-- Create the accelerate_startups table for approved projects
CREATE TABLE IF NOT EXISTS public.accelerate_startups (
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

-- Grant permissions
GRANT ALL ON public.accelerate_startups TO authenticated;
GRANT ALL ON public.accelerate_startups TO service_role;
GRANT SELECT ON public.accelerate_startups TO anon;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_url ON public.accelerate_startups(url);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_score ON public.accelerate_startups(score DESC);
CREATE INDEX IF NOT EXISTS idx_accelerate_startups_created ON public.accelerate_startups(created_at DESC);

-- Enable RLS
ALTER TABLE public.accelerate_startups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read access for all users" ON public.accelerate_startups
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON public.accelerate_startups
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Enable update for service role" ON public.accelerate_startups
  FOR UPDATE USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Enable delete for service role" ON public.accelerate_startups
  FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');