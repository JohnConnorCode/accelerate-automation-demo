-- Add unique constraints to queue tables to prevent duplicates
-- Run this migration in Supabase SQL editor

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

-- 8. Create a scheduled job to run cleanup weekly (optional)
-- Note: This requires pg_cron extension to be enabled
-- SELECT cron.schedule('cleanup-rejected-items', '0 0 * * 0', 'SELECT cleanup_old_rejected_items();');

-- 9. Add helpful comments
COMMENT ON CONSTRAINT queue_projects_url_unique ON queue_projects IS 'Ensures no duplicate URLs in project queue';
COMMENT ON CONSTRAINT queue_investors_url_unique ON queue_investors IS 'Ensures no duplicate URLs in funding queue';
COMMENT ON CONSTRAINT queue_news_url_unique ON queue_news IS 'Ensures no duplicate URLs in resources queue';

-- Verification query - run this to check constraints were added
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('queue_projects', 'queue_investors', 'queue_news', 'projects', 'funding_programs', 'resources')
  AND tc.constraint_type = 'UNIQUE'
ORDER BY tc.table_name, tc.constraint_name;