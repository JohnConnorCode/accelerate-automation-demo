-- Accelerate Content Automation Database Schema
-- PostgreSQL/Supabase

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text searching

-- Content Queue Table (stores all fetched content for review)
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('resource', 'project', 'funding')),
  
  -- Resource specific fields
  resource_source TEXT,
  resource_category TEXT,
  
  -- Project specific fields
  project_source TEXT,
  project_category TEXT,
  github_url TEXT,
  website_url TEXT,
  team_size INTEGER,
  
  -- Funding specific fields
  funding_source TEXT,
  funding_category TEXT,
  funding_amount_min DECIMAL(10, 2),
  funding_amount_max DECIMAL(10, 2),
  deadline TIMESTAMP,
  organization TEXT,
  application_url TEXT,
  eligibility_criteria JSONB DEFAULT '[]'::jsonb,
  
  -- Common fields
  source_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  author TEXT,
  
  -- AI scoring fields
  ai_score DECIMAL(3, 2) CHECK (ai_score >= 0 AND ai_score <= 1),
  ai_reasoning TEXT,
  ai_categories JSONB DEFAULT '[]'::jsonb,
  ai_sentiment TEXT CHECK (ai_sentiment IN ('positive', 'neutral', 'negative')),
  ai_quality_score DECIMAL(3, 2),
  ai_relevance_score DECIMAL(3, 2),
  ai_urgency_score DECIMAL(3, 2),
  
  -- Review fields
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES auth.users(id),
  review_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fetch_source TEXT,
  fetch_batch_id UUID
);

-- Approved Resources Table
CREATE TABLE IF NOT EXISTS resources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  queue_id UUID REFERENCES content_queue(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  resource_source TEXT NOT NULL,
  resource_category TEXT NOT NULL,
  author TEXT,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  
  source_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Engagement metrics
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  
  -- AI fields
  ai_score DECIMAL(3, 2),
  ai_summary TEXT,
  ai_key_points JSONB DEFAULT '[]'::jsonb,
  
  -- Publishing
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMP,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approved Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  queue_id UUID REFERENCES content_queue(id),
  url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  project_source TEXT NOT NULL,
  project_category TEXT NOT NULL,
  
  github_url TEXT,
  website_url TEXT,
  demo_url TEXT,
  documentation_url TEXT,
  
  team_size INTEGER,
  funding_raised DECIMAL(12, 2),
  launch_date DATE,
  blockchain TEXT[],
  token_symbol TEXT,
  
  source_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Metrics
  github_stars INTEGER,
  github_forks INTEGER,
  weekly_active_users INTEGER,
  total_value_locked DECIMAL(15, 2),
  
  -- Engagement
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  application_count INTEGER DEFAULT 0,
  
  -- AI fields
  ai_score DECIMAL(3, 2),
  ai_analysis JSONB,
  
  -- Publishing
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMP,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Approved Funding Programs Table
CREATE TABLE IF NOT EXISTS funding_programs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  queue_id UUID REFERENCES content_queue(id),
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  funding_source TEXT NOT NULL,
  funding_category TEXT NOT NULL,
  
  funding_amount_min DECIMAL(10, 2),
  funding_amount_max DECIMAL(10, 2),
  funding_currency TEXT DEFAULT 'USD',
  
  deadline TIMESTAMP,
  application_url TEXT,
  organization TEXT NOT NULL,
  contact_email TEXT,
  
  eligibility_criteria JSONB DEFAULT '[]'::jsonb,
  required_documents JSONB DEFAULT '[]'::jsonb,
  evaluation_criteria JSONB DEFAULT '[]'::jsonb,
  
  source_data JSONB DEFAULT '{}'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Stats
  application_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3, 2),
  avg_funding_amount DECIMAL(10, 2),
  
  -- Engagement
  view_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  inquiry_count INTEGER DEFAULT 0,
  
  -- AI fields
  ai_score DECIMAL(3, 2),
  ai_match_criteria JSONB,
  
  -- Publishing
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fetch History Table
CREATE TABLE IF NOT EXISTS fetch_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  batch_id UUID NOT NULL,
  fetcher_name TEXT NOT NULL,
  fetch_type TEXT NOT NULL CHECK (fetch_type IN ('scheduled', 'manual', 'webhook')),
  
  items_fetched INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_duplicate INTEGER DEFAULT 0,
  items_error INTEGER DEFAULT 0,
  
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  error_details JSONB,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Processing Log
CREATE TABLE IF NOT EXISTS ai_processing_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  
  model_name TEXT NOT NULL,
  model_version TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  
  processing_time_ms INTEGER,
  
  input_data JSONB,
  output_data JSONB,
  
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Interactions Table
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'view', 'click', 'bookmark', 'share', 'apply', 'inquiry', 'feedback'
  )),
  
  interaction_data JSONB DEFAULT '{}'::jsonb,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Reports Table (for user-reported issues)
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  reporter_id UUID REFERENCES auth.users(id),
  
  report_type TEXT NOT NULL CHECK (report_type IN (
    'duplicate', 'spam', 'outdated', 'broken_link', 'inappropriate', 'other'
  )),
  
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP,
  resolution_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics Aggregates Table (for performance)
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Fetch metrics
  total_fetched INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  
  -- Content metrics by type
  resources_added INTEGER DEFAULT 0,
  projects_added INTEGER DEFAULT 0,
  funding_added INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_views INTEGER DEFAULT 0,
  total_clicks INTEGER DEFAULT 0,
  total_applications INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  
  -- AI metrics
  ai_processing_count INTEGER DEFAULT 0,
  ai_tokens_used INTEGER DEFAULT 0,
  avg_ai_score DECIMAL(3, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

-- Create indexes for performance
CREATE INDEX idx_content_queue_status ON content_queue(status);
CREATE INDEX idx_content_queue_created ON content_queue(created_at DESC);
CREATE INDEX idx_content_queue_ai_score ON content_queue(ai_score DESC) WHERE ai_score IS NOT NULL;
CREATE INDEX idx_content_queue_url_hash ON content_queue(md5(url));

CREATE INDEX idx_resources_published ON resources(published, published_at DESC);
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);
CREATE INDEX idx_resources_source ON resources(resource_source, resource_category);

CREATE INDEX idx_projects_published ON projects(published, published_at DESC);
CREATE INDEX idx_projects_tags ON projects USING GIN(tags);
CREATE INDEX idx_projects_category ON projects(project_category);

CREATE INDEX idx_funding_active ON funding_programs(active, deadline DESC);
CREATE INDEX idx_funding_tags ON funding_programs USING GIN(tags);
CREATE INDEX idx_funding_amount ON funding_programs(funding_amount_min, funding_amount_max);

CREATE INDEX idx_fetch_history_batch ON fetch_history(batch_id);
CREATE INDEX idx_fetch_history_date ON fetch_history(started_at DESC);

CREATE INDEX idx_interactions_user ON user_interactions(user_id, created_at DESC);
CREATE INDEX idx_interactions_content ON user_interactions(content_id, content_type);

-- Full text search indexes
CREATE INDEX idx_content_queue_search ON content_queue USING GIN(
  to_tsvector('english', title || ' ' || description)
);

CREATE INDEX idx_resources_search ON resources USING GIN(
  to_tsvector('english', title || ' ' || description)
);

CREATE INDEX idx_projects_search ON projects USING GIN(
  to_tsvector('english', title || ' ' || description)
);

CREATE INDEX idx_funding_search ON funding_programs USING GIN(
  to_tsvector('english', title || ' ' || description || ' ' || organization)
);

-- Row Level Security (RLS) Policies
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Public read access for published content
CREATE POLICY "Public can view published resources" ON resources
  FOR SELECT USING (published = true);

CREATE POLICY "Public can view published projects" ON projects
  FOR SELECT USING (published = true);

CREATE POLICY "Public can view active funding" ON funding_programs
  FOR SELECT USING (published = true AND active = true);

-- Authenticated users can create interactions
CREATE POLICY "Users can create their own interactions" ON user_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own interactions" ON user_interactions
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can report content
CREATE POLICY "Users can report content" ON content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Admin policies (requires admin role)
CREATE POLICY "Admins can manage content queue" ON content_queue
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_queue_updated_at BEFORE UPDATE ON content_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_programs_updated_at BEFORE UPDATE ON funding_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate similarity between texts (for deduplication)
CREATE OR REPLACE FUNCTION calculate_similarity(text1 TEXT, text2 TEXT)
RETURNS FLOAT AS $$
BEGIN
  RETURN similarity(text1, text2);
END;
$$ LANGUAGE plpgsql;

-- Function to find similar content
CREATE OR REPLACE FUNCTION find_similar_content(
  p_title TEXT,
  p_description TEXT,
  p_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  url TEXT,
  title TEXT,
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cq.id,
    cq.url,
    cq.title,
    GREATEST(
      similarity(cq.title, p_title),
      similarity(cq.description, p_description)
    ) as similarity_score
  FROM content_queue cq
  WHERE 
    similarity(cq.title, p_title) > p_threshold
    OR similarity(cq.description, p_description) > p_threshold
  ORDER BY similarity_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Webhook tables
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id VARCHAR(50) PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  secret TEXT,
  headers JSONB,
  retry_count INTEGER DEFAULT 3,
  retry_delay INTEGER DEFAULT 1000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id VARCHAR(50) REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  delivery_id VARCHAR(50) UNIQUE NOT NULL,
  event VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  status VARCHAR(20) NOT NULL,
  error TEXT,
  attempts INTEGER DEFAULT 1,
  delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_receipts (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  content_id UUID REFERENCES content_queue(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  headers JSONB,
  processed BOOLEAN DEFAULT false,
  error TEXT,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook indexes
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_receipts_source ON webhook_receipts(source);
CREATE INDEX idx_webhook_receipts_processed ON webhook_receipts(processed);

-- Monitoring tables
CREATE TABLE IF NOT EXISTS monitoring_health_checks (
  id SERIAL PRIMARY KEY,
  service VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  service VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  acknowledgement_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  value DECIMAL(20, 4) NOT NULL,
  unit VARCHAR(20),
  tags JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS error_logs (
  id SERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  stack TEXT,
  status_code INTEGER,
  context JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring indexes
CREATE INDEX idx_health_checks_service ON monitoring_health_checks(service, checked_at DESC);
CREATE INDEX idx_alerts_service ON monitoring_alerts(service, created_at DESC);
CREATE INDEX idx_alerts_severity ON monitoring_alerts(severity, resolved);
CREATE INDEX idx_metrics_name ON monitoring_metrics(name, timestamp DESC);
CREATE INDEX idx_error_logs_timestamp ON error_logs(timestamp DESC);
CREATE INDEX idx_error_logs_status ON error_logs(status_code);

-- Backup and recovery tables
CREATE TABLE IF NOT EXISTS backup_log (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(100) NOT NULL,
  backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('full', 'incremental')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  tables TEXT[],
  row_counts JSONB,
  size_bytes BIGINT,
  location TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_restore_log (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(100) NOT NULL,
  restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tables_restored TEXT[],
  options JSONB,
  success BOOLEAN DEFAULT false,
  error TEXT
);

-- Backup indexes
CREATE INDEX idx_backup_log_status ON backup_log(status, created_at DESC);
CREATE INDEX idx_backup_log_type ON backup_log(backup_type, created_at DESC);
CREATE INDEX idx_restore_log_backup ON backup_restore_log(backup_id, restored_at DESC);