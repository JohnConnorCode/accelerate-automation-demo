-- Create content_curated table for Accelerate Content Automation
CREATE TABLE IF NOT EXISTS content_curated (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  source TEXT NOT NULL,
  score DECIMAL(4,1),
  confidence DECIMAL(3,2),
  factors JSONB,
  recommendation TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_score ON content_curated(score DESC);
CREATE INDEX IF NOT EXISTS idx_content_created ON content_curated(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_source ON content_curated(source);

-- Create content_raw table for unprocessed data
CREATE TABLE IF NOT EXISTS content_raw (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE content_curated ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_raw ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (adjust as needed)
CREATE POLICY "Enable read access for all users" ON content_curated
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON content_curated
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON content_raw
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for service role" ON content_raw
  FOR INSERT WITH CHECK (true);