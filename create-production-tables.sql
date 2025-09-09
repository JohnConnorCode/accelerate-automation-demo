-- Create production tables for approved content
-- Run this in Supabase SQL Editor

-- 1. ACCELERATE STARTUPS (Approved Projects)
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

-- 2. FUNDING PROGRAMS (Approved Funding Opportunities)
CREATE TABLE IF NOT EXISTS public.funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  funding_type TEXT, -- grant, accelerator, incubator, vc
  min_amount DECIMAL(15,2),
  max_amount DECIMAL(15,2),
  currency TEXT DEFAULT 'USD',
  deadline DATE,
  eligibility_criteria TEXT[],
  focus_areas TEXT[],
  application_url TEXT,
  contact_info JSONB,
  success_rate DECIMAL(5,2),
  portfolio_companies TEXT[],
  metadata JSONB,
  score INTEGER DEFAULT 0,
  approved_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. RESOURCES (Approved Tools & Resources)
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  resource_type TEXT, -- tool, guide, tutorial, template, dataset
  category TEXT,
  tags TEXT[],
  price_type TEXT DEFAULT 'free', -- free, freemium, paid
  price_details JSONB,
  provider_name TEXT,
  provider_url TEXT,
  features TEXT[],
  requirements TEXT[],
  metadata JSONB,
  score INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  approved_at TIMESTAMP DEFAULT NOW(),
  approved_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_startups_score ON accelerate_startups(score DESC);
CREATE INDEX IF NOT EXISTS idx_startups_funding ON accelerate_startups(funding_raised);
CREATE INDEX IF NOT EXISTS idx_startups_categories ON accelerate_startups USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_startups_created ON accelerate_startups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_funding_deadline ON funding_programs(deadline);
CREATE INDEX IF NOT EXISTS idx_funding_amount ON funding_programs(max_amount);
CREATE INDEX IF NOT EXISTS idx_funding_type ON funding_programs(funding_type);
CREATE INDEX IF NOT EXISTS idx_funding_created ON funding_programs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);
CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resources_created ON resources(created_at DESC);

-- Enable Row Level Security
ALTER TABLE accelerate_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access" ON accelerate_startups FOR SELECT USING (true);
CREATE POLICY "Public read access" ON funding_programs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON resources FOR SELECT USING (true);

-- Create policies for authenticated write access (for admin)
CREATE POLICY "Authenticated write access" ON accelerate_startups FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON funding_programs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write access" ON resources FOR ALL USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT ON accelerate_startups TO anon;
GRANT SELECT ON funding_programs TO anon;
GRANT SELECT ON resources TO anon;

GRANT ALL ON accelerate_startups TO authenticated;
GRANT ALL ON funding_programs TO authenticated;
GRANT ALL ON resources TO authenticated;

-- Success message
SELECT 'Production tables created successfully!' as message;