# Database Migration Execution Guide

## Migration: Add Unique Constraints to Queue Tables

**Date**: September 12, 2025  
**Purpose**: Add unique constraints on URL columns and performance indexes  
**Database**: Accelerate Alpha Supabase Project (eqpfvmwmdtsgddpsodsr)

## Quick Execution Steps

### Option 1: Manual Execution via Supabase Dashboard (RECOMMENDED)

1. **Go to Supabase SQL Editor**
   ```
   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/editor
   ```

2. **Copy and paste the SQL below** and execute it:

```sql
-- Add unique constraints to queue tables to prevent duplicates
-- 1. Queue Projects - Add unique constraint on URL
ALTER TABLE queue_projects 
ADD CONSTRAINT queue_projects_url_unique UNIQUE (url);

-- 2. Queue Investors/Funding - Add unique constraint on URL  
ALTER TABLE queue_investors
ADD CONSTRAINT queue_investors_url_unique UNIQUE (url);

-- 3. Queue News/Resources - Add unique constraint on URL
ALTER TABLE queue_news
ADD CONSTRAINT queue_news_url_unique UNIQUE (url);

-- 4. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_queue_projects_created_at ON queue_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON queue_projects(status);
CREATE INDEX IF NOT EXISTS idx_queue_projects_score ON queue_projects(score DESC);

CREATE INDEX IF NOT EXISTS idx_queue_investors_created_at ON queue_investors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_investors_status ON queue_investors(status);
CREATE INDEX IF NOT EXISTS idx_queue_investors_score ON queue_investors(score DESC);

CREATE INDEX IF NOT EXISTS idx_queue_news_created_at ON queue_news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_news_status ON queue_news(status);
CREATE INDEX IF NOT EXISTS idx_queue_news_score ON queue_news(score DESC);

-- 5. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_queue_projects_status_score ON queue_projects(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_investors_status_score ON queue_investors(status, score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_news_status_score ON queue_news(status, score DESC);

-- 6. Production tables - ensure unique constraints exist
ALTER TABLE projects 
ADD CONSTRAINT IF NOT EXISTS projects_url_unique UNIQUE (url);

ALTER TABLE funding_programs
ADD CONSTRAINT IF NOT EXISTS funding_programs_url_unique UNIQUE (url);

ALTER TABLE resources
ADD CONSTRAINT IF NOT EXISTS resources_url_unique UNIQUE (url);

-- 7. Add cleanup policy for old rejected items (optional)
-- This creates a function to delete rejected items older than 30 days
CREATE OR REPLACE FUNCTION cleanup_old_rejected_items()
RETURNS void AS $$
BEGIN
  DELETE FROM queue_projects 
  WHERE status = 'rejected' 
  AND created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM queue_investors 
  WHERE status = 'rejected' 
  AND created_at < NOW() - INTERVAL '30 days';
  
  DELETE FROM queue_news 
  WHERE status = 'rejected' 
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 8. Add helpful comments
COMMENT ON CONSTRAINT queue_projects_url_unique ON queue_projects IS 'Ensures no duplicate URLs in project queue';
COMMENT ON CONSTRAINT queue_investors_url_unique ON queue_investors IS 'Ensures no duplicate URLs in funding queue';
COMMENT ON CONSTRAINT queue_news_url_unique ON queue_news IS 'Ensures no duplicate URLs in resources queue';
```

3. **Verification Query** - Run this to confirm constraints were added:
```sql
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('queue_projects', 'queue_investors', 'queue_news', 'projects', 'funding_programs', 'resources')
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name;
```

### Option 2: Command Line (if configured)

If you have proper database credentials:

```bash
# Execute migration file directly
psql "postgresql://postgres:YOUR_PASSWORD@eqpfvmwmdtsgddpsodsr.supabase.co:5432/postgres" -f database/add-unique-constraints.sql
```

## Expected Results

After successful execution, you should see:

1. **Unique Constraints Added:**
   - `queue_projects_url_unique` on `queue_projects(url)`
   - `queue_investors_url_unique` on `queue_investors(url)`  
   - `queue_news_url_unique` on `queue_news(url)`
   - `projects_url_unique` on `projects(url)`
   - `funding_programs_url_unique` on `funding_programs(url)`
   - `resources_url_unique` on `resources(url)`

2. **Performance Indexes Added:**
   - Individual indexes on `created_at`, `status`, `score` columns
   - Composite indexes on `(status, score)` for optimized queries

3. **Cleanup Function Created:**
   - `cleanup_old_rejected_items()` function for maintenance

## Troubleshooting

### If you get "constraint already exists" errors:
- **This is normal** - the `IF NOT EXISTS` clauses should prevent errors
- Continue with remaining statements

### If you get "relation does not exist" errors:
- Check that the table names match your schema
- Verify you're connected to the correct database

### If constraints fail due to existing duplicate data:
1. First, identify duplicates:
   ```sql
   SELECT url, COUNT(*) FROM queue_projects GROUP BY url HAVING COUNT(*) > 1;
   ```

2. Clean up duplicates before adding constraints:
   ```sql
   DELETE FROM queue_projects 
   WHERE id NOT IN (
     SELECT MIN(id) FROM queue_projects GROUP BY url
   );
   ```

## Files Referenced

- **Migration Source**: `/database/add-unique-constraints.sql`
- **Execution Scripts**: `/scripts/execute-migration.ts`, `/scripts/run-migration.ts`

## Post-Migration Testing

After migration, test the duplicate prevention:

```sql
-- This should succeed (first insert)
INSERT INTO queue_projects (url, title, source) VALUES ('https://test-unique.com', 'Test', 'manual');

-- This should fail with unique constraint violation
INSERT INTO queue_projects (url, title, source) VALUES ('https://test-unique.com', 'Test 2', 'manual');
```

## Notes

- Migration is **idempotent** - safe to run multiple times
- Uses `IF NOT EXISTS` clauses to prevent errors on re-runs
- All indexes use `IF NOT EXISTS` for safety
- Cleanup function is optional and can be customized

---

**Status**: Ready for execution  
**Risk Level**: Low (non-destructive, adds constraints only)  
**Estimated Time**: 2-5 minutes