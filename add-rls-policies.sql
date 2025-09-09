-- Row Level Security Policies for Queue and Live Tables
-- Since this is an internal tool, we'll use simple public access
-- In production, you'd want to add proper user authentication

-- Enable RLS on queue tables
ALTER TABLE queue_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_investors ENABLE ROW LEVEL SECURITY;

-- Enable RLS on live tables
ALTER TABLE accelerate_startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE accelerate_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE accelerate_investors ENABLE ROW LEVEL SECURITY;

-- Queue tables: Allow all operations (internal tool)
CREATE POLICY "Allow public access to queue_projects" ON queue_projects
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to queue_news" ON queue_news
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to queue_investors" ON queue_investors
  FOR ALL USING (true) WITH CHECK (true);

-- Live tables: Read-only for public, write requires auth
-- For now, allow all since it's internal
CREATE POLICY "Allow public access to accelerate_startups" ON accelerate_startups
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to accelerate_news" ON accelerate_news
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public access to accelerate_investors" ON accelerate_investors
  FOR ALL USING (true) WITH CHECK (true);

-- Note: In production, you would use more restrictive policies like:
-- CREATE POLICY "Users can read approved content" ON accelerate_news
--   FOR SELECT USING (status = 'approved');
-- CREATE POLICY "Admins can write content" ON accelerate_news
--   FOR ALL USING (auth.jwt() ->> 'role' = 'admin');