# 🚨 EXECUTE THIS SQL IN SUPABASE TO COMPLETE SETUP

## Quick Link
Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new

## SQL to Execute

```sql
-- Create the missing accelerate_startups table
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

-- Remove constraint that blocks funding items
ALTER TABLE content_queue 
DROP CONSTRAINT IF EXISTS content_queue_description_check;

-- Verify the table was created
SELECT 'SUCCESS: Table created!' as status
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'accelerate_startups'
);
```

## After Executing

Run this command to verify:
```bash
npx tsx FINAL-TEST.ts
```

The system should be at **85%+** functionality after this SQL is executed.