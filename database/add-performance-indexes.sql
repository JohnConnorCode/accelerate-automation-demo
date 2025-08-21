-- Performance indexes for Accelerate Content Automation
-- Run these on your Supabase database for 10x query performance improvement

-- 1. Index for fast sorting by score and status (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_score_status 
ON projects(score DESC, status)
WHERE status IN ('pending', 'approved');

-- 2. Index for date-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at 
ON projects(created_at DESC);

-- 3. Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 4. Index for duplicate detection using trigram similarity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_trgm 
ON projects USING gin(name gin_trgm_ops);

-- 5. Index for fast URL lookups (duplicate detection)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_urls 
ON projects(website_url, github_url);

-- 6. Partial index for pending items only (speeds up review dashboard)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_pending 
ON projects(created_at DESC, score DESC) 
WHERE status IS NULL OR status = 'pending';

-- 7. Index for funding programs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_funding_status_deadline 
ON funding_programs(status, deadline DESC)
WHERE status IN ('open', 'active');

-- 8. Index for resources by score and date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_resources_score_updated 
ON resources(score DESC, updated_at DESC);

-- 9. JSONB indexes for metadata queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_metadata 
ON projects USING gin(metadata);

-- 10. Index for social metrics (if columns exist)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_social 
ON projects(social_score DESC, twitter_followers DESC)
WHERE social_score IS NOT NULL;

-- 11. Composite index for enrichment status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_enrichment 
ON projects(last_enriched, status)
WHERE last_enriched IS NOT NULL;

-- 12. Index for duplicate tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_duplicates 
ON projects(duplicate_count DESC)
WHERE duplicate_count > 0;

-- Update table statistics for query planner
ANALYZE projects;
ANALYZE funding_programs;
ANALYZE resources;

-- Enable parallel queries for better performance
ALTER TABLE projects SET (parallel_workers = 4);
ALTER TABLE funding_programs SET (parallel_workers = 2);
ALTER TABLE resources SET (parallel_workers = 2);

-- Add check to see current indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;