-- ESSENTIAL TABLES FOR ACCELERATE CONTENT AUTOMATION
-- Run this in your Supabase SQL editor

-- 1. API Cache (for performance)
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

-- 2. Search Analytics (for improving search)
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  response_time INTEGER, -- milliseconds
  user_id UUID,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_analytics_query ON search_analytics(query);
CREATE INDEX idx_search_analytics_timestamp ON search_analytics(timestamp);

-- 3. Monitoring Metrics (for system health)
CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  value NUMERIC NOT NULL,
  unit VARCHAR(50),
  tags JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_monitoring_metrics_name ON monitoring_metrics(name);
CREATE INDEX idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);

-- 4. Rate Limit Violations (for security)
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255),
  violation_count INTEGER DEFAULT 1,
  violation_type VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_ip ON rate_limit_violations(ip_address);
CREATE INDEX idx_rate_limit_timestamp ON rate_limit_violations(timestamp);

-- 5. Webhook Endpoints (for integrations)
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Webhook Deliveries (for tracking)
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(100),
  payload JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  response_code INTEGER,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);

-- 7. Resources table (for educational content)
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  resource_type VARCHAR(50),
  category VARCHAR(100),
  tags TEXT[],
  price_type VARCHAR(20),
  price_amount NUMERIC,
  provider VARCHAR(255),
  difficulty_level VARCHAR(20),
  accelerate_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_resources_url ON resources(url);
CREATE INDEX idx_resources_type ON resources(resource_type);

-- 8. Queue Resources (for approval workflow)
CREATE TABLE IF NOT EXISTS queue_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT UNIQUE NOT NULL,
  resource_type VARCHAR(50),
  category VARCHAR(100),
  tags TEXT[],
  price_type VARCHAR(20),
  price_amount NUMERIC,
  provider VARCHAR(255),
  difficulty_level VARCHAR(20),
  accelerate_score NUMERIC,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Funding Programs (for grants/accelerators)
CREATE TABLE IF NOT EXISTS funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  description TEXT,
  url TEXT,
  application_url TEXT,
  funding_type VARCHAR(50),
  min_amount NUMERIC,
  max_amount NUMERIC,
  equity_required BOOLEAN DEFAULT false,
  equity_percentage NUMERIC,
  deadline DATE,
  status VARCHAR(20) DEFAULT 'active',
  accelerate_score NUMERIC,
  last_investment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Queue Funding Programs (for approval)
CREATE TABLE IF NOT EXISTS queue_funding_programs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  description TEXT,
  url TEXT,
  funding_type VARCHAR(50),
  min_amount NUMERIC,
  max_amount NUMERIC,
  equity_required BOOLEAN DEFAULT false,
  equity_percentage NUMERIC,
  deadline DATE,
  status VARCHAR(20) DEFAULT 'pending',
  accelerate_score NUMERIC,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Error Logs (for debugging)
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type VARCHAR(100),
  error_message TEXT,
  stack_trace TEXT,
  context JSONB,
  severity VARCHAR(20),
  service VARCHAR(100),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);

-- 12. System Settings (for configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
  ('openai_model', '"gpt-4"', 'OpenAI model to use for scoring'),
  ('auto_approve_threshold', '0.85', 'Score threshold for auto-approval'),
  ('rate_limit_max', '100', 'Max requests per window'),
  ('cache_ttl', '3600', 'Cache TTL in seconds')
ON CONFLICT (key) DO NOTHING;

-- 13. Fetch History (for tracking)
CREATE TABLE IF NOT EXISTS fetch_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  items_fetched INTEGER DEFAULT 0,
  items_validated INTEGER DEFAULT 0,
  items_scored INTEGER DEFAULT 0,
  items_inserted INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fetch_history_source ON fetch_history(source);
CREATE INDEX idx_fetch_history_created ON fetch_history(created_at);

-- 14. Monitoring Alerts (for notifications)
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id VARCHAR(255) UNIQUE NOT NULL,
  severity VARCHAR(20) NOT NULL,
  service VARCHAR(100),
  message TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX idx_monitoring_alerts_resolved ON monitoring_alerts(resolved);

-- 15. Tags (for categorization)
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  count INTEGER DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_count ON tags(count);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Enable RLS on sensitive tables
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Enable read for authenticated users" ON webhook_endpoints
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON webhook_endpoints
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for all users" ON system_settings
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "Enable write for authenticated users" ON system_settings
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable insert for all" ON error_logs
  FOR INSERT TO authenticated, anon WITH CHECK (true);

CREATE POLICY "Enable read for authenticated" ON error_logs
  FOR SELECT TO authenticated USING (true);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_api_cache_updated_at BEFORE UPDATE ON api_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_programs_updated_at BEFORE UPDATE ON funding_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();