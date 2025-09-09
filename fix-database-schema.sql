-- Fix missing columns in content_queue table
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT DEFAULT 'review';

-- Ensure all required columns exist
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS ai_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS platform VARCHAR(100);

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS enrichment_data JSONB;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_score ON content_queue(score);
CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'content_queue'
ORDER BY ordinal_position;