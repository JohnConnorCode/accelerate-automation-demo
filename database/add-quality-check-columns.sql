-- Add quality check columns to all content tables
-- This enables storing automated quality check results

-- Add columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_checks JSONB,
ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add columns to funding_programs table
ALTER TABLE funding_programs
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_checks JSONB,
ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Add columns to resources table
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quality_checks JSONB,
ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approval_reason TEXT,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- Create indexes for quality score filtering
CREATE INDEX IF NOT EXISTS idx_projects_quality_score ON projects(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_funding_quality_score ON funding_programs(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_quality_score ON resources(quality_score DESC) WHERE quality_score IS NOT NULL;

-- Create indexes for review status
CREATE INDEX IF NOT EXISTS idx_projects_review ON projects(quality_score DESC) WHERE status = 'review';
CREATE INDEX IF NOT EXISTS idx_funding_review ON funding_programs(quality_score DESC) WHERE status = 'review';
CREATE INDEX IF NOT EXISTS idx_resources_review ON resources(quality_score DESC) WHERE status = 'review';

-- Create a view for items needing manual review
CREATE OR REPLACE VIEW items_for_review AS
SELECT 
  'project' as type,
  id,
  name as title,
  description,
  website_url as url,
  quality_score,
  quality_checks,
  review_notes,
  created_at
FROM projects
WHERE status = 'review'
  AND quality_score IS NOT NULL

UNION ALL

SELECT 
  'funding' as type,
  id,
  name as title,
  description,
  application_url as url,
  quality_score,
  quality_checks,
  review_notes,
  created_at
FROM funding_programs
WHERE status = 'review'
  AND quality_score IS NOT NULL

UNION ALL

SELECT 
  'resource' as type,
  id,
  title,
  description,
  url,
  quality_score,
  quality_checks,
  review_notes,
  created_at
FROM resources
WHERE status = 'review'
  AND quality_score IS NOT NULL

ORDER BY quality_score DESC, created_at DESC;

-- Create a view for quality metrics
CREATE OR REPLACE VIEW quality_metrics AS
WITH all_items AS (
  SELECT 
    'project' as type,
    status,
    quality_score,
    quality_checked_at
  FROM projects
  WHERE quality_score IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'funding' as type,
    status,
    quality_score,
    quality_checked_at
  FROM funding_programs
  WHERE quality_score IS NOT NULL
  
  UNION ALL
  
  SELECT 
    'resource' as type,
    status,
    quality_score,
    quality_checked_at
  FROM resources
  WHERE quality_score IS NOT NULL
)
SELECT 
  COUNT(*) as total_checked,
  AVG(quality_score) as avg_score,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN status = 'review' THEN 1 END) as review_count,
  COUNT(CASE WHEN quality_score >= 80 THEN 1 END) as excellent_count,
  COUNT(CASE WHEN quality_score >= 60 AND quality_score < 80 THEN 1 END) as good_count,
  COUNT(CASE WHEN quality_score >= 40 AND quality_score < 60 THEN 1 END) as fair_count,
  COUNT(CASE WHEN quality_score < 40 THEN 1 END) as poor_count,
  MAX(quality_checked_at) as last_check_time
FROM all_items;

-- Grant permissions
GRANT SELECT ON items_for_review TO authenticated;
GRANT SELECT ON quality_metrics TO authenticated;

-- Add comments
COMMENT ON VIEW items_for_review IS 'Content items flagged for manual review after automated quality checks';
COMMENT ON VIEW quality_metrics IS 'Aggregated quality check metrics across all content types';