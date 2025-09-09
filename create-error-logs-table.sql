-- Create error logging table for system monitoring
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Error details
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  error_code TEXT,
  stack_trace TEXT,
  
  -- Context
  service TEXT NOT NULL,
  function_name TEXT,
  user_id TEXT,
  request_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexing for queries
  INDEX idx_error_logs_level (level),
  INDEX idx_error_logs_service (service),
  INDEX idx_error_logs_created (created_at DESC)
);

-- Create system metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Metric details
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  metric_unit TEXT,
  
  -- Context
  service TEXT NOT NULL,
  environment TEXT DEFAULT 'production',
  
  -- Metadata
  tags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexing
  INDEX idx_metrics_name (metric_name),
  INDEX idx_metrics_created (created_at DESC)
);