-- Fix database constraint that's blocking insertions
ALTER TABLE content_queue 
DROP CONSTRAINT IF EXISTS content_queue_description_check;

-- Also ensure description can accept empty strings
ALTER TABLE content_queue 
ALTER COLUMN description DROP NOT NULL;