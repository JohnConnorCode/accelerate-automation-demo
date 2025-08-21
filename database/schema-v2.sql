-- Advanced Features Database Schema V2
-- Adds support for orchestration, prioritization, and control features

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(50) DEFAULT '1.0.0',
  steps JSONB NOT NULL,
  triggers JSONB,
  schedule VARCHAR(100),
  priority INTEGER DEFAULT 2,
  execution_mode VARCHAR(50) DEFAULT 'sequential',
  max_concurrency INTEGER DEFAULT 5,
  timeout INTEGER,
  metadata JSONB,
  tags TEXT[],
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(255) UNIQUE NOT NULL,
  workflow_id VARCHAR(255) REFERENCES workflows(id),
  event VARCHAR(50),
  status VARCHAR(50),
  metrics JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow step executions table
CREATE TABLE IF NOT EXISTS workflow_step_executions (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(255),
  step_id VARCHAR(255),
  status VARCHAR(50),
  attempts INTEGER DEFAULT 1,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  input JSONB,
  output JSONB,
  error TEXT,
  metrics JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content schedule table
CREATE TABLE IF NOT EXISTS content_schedule (
  id VARCHAR(255) PRIMARY KEY,
  content_id VARCHAR(255),
  scheduled_time TIMESTAMP NOT NULL,
  priority INTEGER DEFAULT 3,
  strategy VARCHAR(50),
  locked BOOLEAN DEFAULT false,
  metadata JSONB,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Priority rules table
CREATE TABLE IF NOT EXISTS priority_rules (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  condition JSONB NOT NULL,
  action JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Source reliability table
CREATE TABLE IF NOT EXISTS source_reliability (
  source VARCHAR(255) PRIMARY KEY,
  trust_score DECIMAL(3,2) CHECK (trust_score >= 0 AND trust_score <= 1),
  total_items INTEGER DEFAULT 0,
  approved_items INTEGER DEFAULT 0,
  rejected_items INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

-- Trending topics table
CREATE TABLE IF NOT EXISTS trending_topics (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(255) NOT NULL,
  trending_score DECIMAL(3,2) CHECK (trending_score >= 0 AND trending_score <= 1),
  mentions INTEGER DEFAULT 1,
  category VARCHAR(100),
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topic)
);

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level VARCHAR(20),
  service VARCHAR(100),
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring health checks table
CREATE TABLE IF NOT EXISTS monitoring_health_checks (
  id SERIAL PRIMARY KEY,
  service VARCHAR(100),
  status VARCHAR(20),
  message TEXT,
  metrics JSONB,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring alerts table
CREATE TABLE IF NOT EXISTS monitoring_alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255),
  severity VARCHAR(20),
  service VARCHAR(100),
  message TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring metrics table
CREATE TABLE IF NOT EXISTS monitoring_metrics (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  value DECIMAL,
  unit VARCHAR(50),
  tags JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup log table
CREATE TABLE IF NOT EXISTS backup_log (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(255) UNIQUE,
  backup_type VARCHAR(20),
  status VARCHAR(20),
  tables TEXT[],
  row_counts JSONB,
  size_bytes BIGINT,
  location TEXT,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backup restore log table
CREATE TABLE IF NOT EXISTS backup_restore_log (
  id SERIAL PRIMARY KEY,
  backup_id VARCHAR(255),
  restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tables_restored TEXT[],
  options JSONB,
  success BOOLEAN,
  error TEXT
);

-- Audit log table for compliance tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance cache table
CREATE TABLE IF NOT EXISTS performance_cache (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB,
  ttl INTEGER,
  hits INTEGER DEFAULT 0,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Task queue table for distributed processing
CREATE TABLE IF NOT EXISTS task_queue (
  id SERIAL PRIMARY KEY,
  task_id VARCHAR(255) UNIQUE NOT NULL,
  task_type VARCHAR(100),
  priority INTEGER DEFAULT 3,
  payload JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  result JSONB,
  worker_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Content enrichment results table
CREATE TABLE IF NOT EXISTS content_enrichment (
  id SERIAL PRIMARY KEY,
  content_id VARCHAR(255),
  enrichment_type VARCHAR(100),
  provider VARCHAR(100),
  data JSONB,
  confidence_score DECIMAL(3,2),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User feedback table for ML training
CREATE TABLE IF NOT EXISTS user_feedback (
  id SERIAL PRIMARY KEY,
  content_id VARCHAR(255),
  user_id VARCHAR(255),
  feedback_type VARCHAR(50),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  engagement_score DECIMAL(3,2),
  comments TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(active);
CREATE INDEX IF NOT EXISTS idx_workflows_schedule ON workflows(schedule);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_content_schedule_scheduled_time ON content_schedule(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_content_schedule_published ON content_schedule(published);
CREATE INDEX IF NOT EXISTS idx_priority_rules_active ON priority_rules(active);
CREATE INDEX IF NOT EXISTS idx_trending_topics_score ON trending_topics(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_resolved ON monitoring_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_name ON monitoring_metrics(name);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_cache_expires_at ON performance_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_task_queue_scheduled_at ON task_queue(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_content_enrichment_content_id ON content_enrichment(content_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_content_id ON user_feedback(content_id);

-- Create views for common queries
CREATE OR REPLACE VIEW workflow_execution_summary AS
SELECT 
  w.id,
  w.name,
  COUNT(DISTINCT we.execution_id) as total_executions,
  COUNT(DISTINCT CASE WHEN we.status = 'completed' THEN we.execution_id END) as completed,
  COUNT(DISTINCT CASE WHEN we.status = 'failed' THEN we.execution_id END) as failed,
  COUNT(DISTINCT CASE WHEN we.status = 'active' THEN we.execution_id END) as active,
  AVG(CASE WHEN we.metrics->>'totalDuration' IS NOT NULL 
      THEN (we.metrics->>'totalDuration')::INTEGER END) as avg_duration_ms
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name;

CREATE OR REPLACE VIEW content_priority_summary AS
SELECT 
  DATE(scheduled_time) as schedule_date,
  priority,
  COUNT(*) as count,
  COUNT(CASE WHEN published THEN 1 END) as published_count
FROM content_schedule
GROUP BY DATE(scheduled_time), priority
ORDER BY schedule_date, priority DESC;

CREATE OR REPLACE VIEW system_health_overview AS
SELECT 
  service,
  status,
  MAX(checked_at) as last_check,
  COUNT(*) FILTER (WHERE checked_at > NOW() - INTERVAL '1 hour') as checks_last_hour
FROM monitoring_health_checks
GROUP BY service, status;

-- Functions for advanced operations
CREATE OR REPLACE FUNCTION update_source_reliability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO source_reliability (source, approved_items, total_items, trust_score)
    VALUES (NEW.source, 1, 1, 0.5)
    ON CONFLICT (source) DO UPDATE
    SET approved_items = source_reliability.approved_items + 1,
        total_items = source_reliability.total_items + 1,
        trust_score = LEAST(1.0, source_reliability.approved_items::DECIMAL / GREATEST(source_reliability.total_items, 1)),
        last_updated = CURRENT_TIMESTAMP;
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO source_reliability (source, rejected_items, total_items, trust_score)
    VALUES (NEW.source, 1, 1, 0.5)
    ON CONFLICT (source) DO UPDATE
    SET rejected_items = source_reliability.rejected_items + 1,
        total_items = source_reliability.total_items + 1,
        trust_score = LEAST(1.0, source_reliability.approved_items::DECIMAL / GREATEST(source_reliability.total_items, 1)),
        last_updated = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update source reliability automatically
CREATE TRIGGER update_source_reliability_trigger
AFTER UPDATE OF status ON content_queue
FOR EACH ROW
WHEN (NEW.status IN ('approved', 'rejected'))
EXECUTE FUNCTION update_source_reliability();

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Delete old logs (older than 30 days)
  DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete old metrics (older than 7 days)
  DELETE FROM monitoring_metrics WHERE timestamp < NOW() - INTERVAL '7 days';
  
  -- Delete expired cache entries
  DELETE FROM performance_cache WHERE expires_at < NOW();
  
  -- Delete old completed tasks (older than 7 days)
  DELETE FROM task_queue 
  WHERE status IN ('completed', 'failed') 
  AND completed_at < NOW() - INTERVAL '7 days';
  
  -- Delete old health checks (keep only last 24 hours)
  DELETE FROM monitoring_health_checks WHERE checked_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your setup)
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;