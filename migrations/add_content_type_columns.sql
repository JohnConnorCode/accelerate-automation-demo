-- Add content type columns to content_curated table
ALTER TABLE content_curated 
ADD COLUMN IF NOT EXISTS content_type TEXT CHECK (content_type IN ('project', 'funding', 'resource')),
ADD COLUMN IF NOT EXISTS type_confidence DECIMAL(3,2) CHECK (type_confidence >= 0 AND type_confidence <= 1);

-- Create index for faster filtering by content type
CREATE INDEX IF NOT EXISTS idx_content_curated_type ON content_curated(content_type);

-- Update existing records to have a content type based on source
UPDATE content_curated 
SET content_type = CASE 
    WHEN source IN ('producthunt', 'github') THEN 'project'
    WHEN source = 'defilama' OR description ILIKE '%funding%' OR description ILIKE '%grant%' THEN 'funding'
    ELSE 'resource'
END,
type_confidence = 0.7
WHERE content_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN content_curated.content_type IS 'Type of content: project (startups/apps), funding (grants/VCs), or resource (tools/guides)';
COMMENT ON COLUMN content_curated.type_confidence IS 'Confidence score (0-1) in the content type detection';