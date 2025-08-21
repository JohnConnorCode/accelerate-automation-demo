-- Add AI assessment columns to all content tables
-- This enables storing AI quality assessments and scores

-- Add columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_assessment JSONB,
ADD COLUMN IF NOT EXISTS ai_assessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_scam_confidence INTEGER DEFAULT 0;

-- Add columns to funding_programs table
ALTER TABLE funding_programs
ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_assessment JSONB,
ADD COLUMN IF NOT EXISTS ai_assessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_scam_confidence INTEGER DEFAULT 0;

-- Add columns to resources table
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS ai_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_assessment JSONB,
ADD COLUMN IF NOT EXISTS ai_assessed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ai_scam_confidence INTEGER DEFAULT 0;

-- Create table for storing AI assessments history
CREATE TABLE IF NOT EXISTS ai_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_url TEXT NOT NULL,
  item_type TEXT NOT NULL,
  assessment JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_assessments_url ON ai_assessments(item_url);
CREATE INDEX IF NOT EXISTS idx_ai_assessments_created ON ai_assessments(created_at DESC);

-- Add OpenAI API key to system settings if not exists
INSERT INTO system_settings (key, value, created_at, updated_at)
VALUES ('openai_api_key', '', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Create indexes for AI score filtering
CREATE INDEX IF NOT EXISTS idx_projects_ai_score ON projects(ai_score DESC) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_funding_ai_score ON funding_programs(ai_score DESC) WHERE ai_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resources_ai_score ON resources(ai_score DESC) WHERE ai_score IS NOT NULL;

-- Create a view for high-quality AI-approved items
CREATE OR REPLACE VIEW ai_approved_content AS
SELECT 
  'project' as type,
  id,
  name as title,
  description,
  website_url as url,
  ai_score,
  ai_assessment,
  ai_assessed_at,
  created_at
FROM projects
WHERE ai_score >= 70
  AND status = 'approved'

UNION ALL

SELECT 
  'funding' as type,
  id,
  name as title,
  description,
  application_url as url,
  ai_score,
  ai_assessment,
  ai_assessed_at,
  created_at
FROM funding_programs
WHERE ai_score >= 70
  AND status IN ('approved', 'open')

UNION ALL

SELECT 
  'resource' as type,
  id,
  title,
  description,
  url,
  ai_score,
  ai_assessment,
  ai_assessed_at,
  created_at
FROM resources
WHERE ai_score >= 70
  AND status = 'approved'

ORDER BY ai_score DESC, created_at DESC;

-- Grant permissions
GRANT SELECT ON ai_approved_content TO authenticated;
GRANT ALL ON ai_assessments TO authenticated;

-- Add comment
COMMENT ON VIEW ai_approved_content IS 'High-quality content approved by both AI and human review';