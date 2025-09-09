# 🚨 STAGING TABLES SETUP - MANUAL EXECUTION REQUIRED

## Summary
The staging tables for your content automation system need to be created manually in Supabase. Automated creation failed due to API limitations, but the solution is straightforward.

## Current Status
- ✅ Supabase connection working
- ✅ Service role key valid
- ❌ Tables exist but are not functional (likely empty views or permission issues)
- ❌ Insert operations failing

## Required Action: Execute SQL Manually

### Step 1: Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Navigate to your project: `eqpfvmwmdtsgddpsodsr`
3. Click on "SQL Editor" in the left sidebar

### Step 2: Execute the SQL Script
Copy and paste the contents of the file: `/Users/johnconnor/Desktop/claude-test-2/accelerate-content-automation/EXECUTE_IN_SUPABASE.sql`

Or copy this SQL directly:

```sql
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

-- 7. VERIFICATION MESSAGE
SELECT 
  '🎉 STAGING TABLES CREATED SUCCESSFULLY!' as status,
  'All three queue tables are ready for production use' as message,
  NOW() as created_at;
```

### Step 3: Verify Creation
After executing the SQL, run this verification command:

```bash
npx tsx verify-after-creation.ts
```

## What These Tables Do

### 1. `queue_projects` 
- **Purpose**: Stores startup/project submissions waiting for manual review
- **Key Fields**: name, description, url, source, score, team_size, funding_raised
- **Workflow**: Fetcher → Queue → Manual Review → Approve → Live Tables

### 2. `queue_funding_programs`
- **Purpose**: Stores funding opportunities waiting for manual review  
- **Key Fields**: name, organization, description, funding_type, min_amount, max_amount
- **Workflow**: Fetcher → Queue → Manual Review → Approve → Live Tables

### 3. `queue_resources`
- **Purpose**: Stores tools, courses, and resources waiting for manual review
- **Key Fields**: title, description, url, resource_type, category, price_type
- **Workflow**: Fetcher → Queue → Manual Review → Approve → Live Tables

## Expected Results After Setup
Once the SQL is executed successfully, you should see:

✅ All three staging tables created  
✅ Proper permissions set (no RLS restrictions)  
✅ Performance indexes created  
✅ Full CRUD operations working  
✅ Ready for production data ingestion  

## Troubleshooting

### If Tables Still Don't Work After SQL Execution:
1. Check if SQL ran without errors in Supabase dashboard
2. Verify you're in the correct project (`eqpfvmwmdtsgddpsodsr`)  
3. Try running the verification script again
4. Check Supabase logs for permission errors

### If Verification Script Shows Errors:
1. Make sure all SQL statements executed successfully
2. Check that RLS is disabled on all tables
3. Verify permissions are granted to service_role
4. Try refreshing your Supabase dashboard

## Files Created for This Setup

1. **`EXECUTE_IN_SUPABASE.sql`** - Complete SQL script to run in dashboard
2. **`verify-after-creation.ts`** - Verification script to confirm everything works
3. **`STAGING_TABLES_SETUP_INSTRUCTIONS.md`** - This instruction file

## Next Steps After Setup

Once tables are confirmed working:

1. **Test the complete pipeline**: Fetch → Queue → Approve workflow
2. **Run your content automation**: `npm run orchestrate:manual`
3. **Check the admin dashboard**: Verify queued items appear for review
4. **Test approval workflow**: Approve items and see them move to live tables

---

**🚨 IMPORTANT**: These tables are critical for your content automation system. Without them, the fetching pipeline cannot store items for manual review, and your approval workflow won't function.