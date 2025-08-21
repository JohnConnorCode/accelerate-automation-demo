-- Add scheduling tables for CEO-controlled content updates

-- Create scheduler history table
CREATE TABLE IF NOT EXISTS scheduler_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_type TEXT NOT NULL CHECK (run_type IN ('manual', 'automatic')),
  items_fetched INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_approved INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  config JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add schedule configuration to system settings (if not exists)
INSERT INTO system_settings (key, value, created_at, updated_at)
VALUES (
  'schedule_config',
  jsonb_build_object(
    'enabled', true,
    'intervalHours', 24,  -- DEFAULT: 24 hours
    'lastRun', null,
    'nextRun', null,
    'manualOnly', false,  -- DEFAULT: Allow automatic runs
    'autoQualityChecks', true,
    'autoAIAssessment', true,
    'notifyOnComplete', true,
    'maxItemsPerRun', 500
  ),
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduler_history_created ON scheduler_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduler_history_type ON scheduler_history(run_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(created_at DESC) WHERE read_at IS NULL;

-- Create view for schedule analytics
CREATE OR REPLACE VIEW schedule_analytics AS
WITH daily_stats AS (
  SELECT 
    DATE(created_at) as run_date,
    COUNT(*) as runs_count,
    SUM(items_fetched) as total_fetched,
    SUM(items_processed) as total_processed,
    SUM(items_approved) as total_approved,
    SUM(items_rejected) as total_rejected,
    AVG(duration_seconds) as avg_duration,
    SUM(CASE WHEN run_type = 'manual' THEN 1 ELSE 0 END) as manual_runs,
    SUM(CASE WHEN run_type = 'automatic' THEN 1 ELSE 0 END) as auto_runs
  FROM scheduler_history
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at)
)
SELECT 
  run_date,
  runs_count,
  total_fetched,
  total_processed,
  total_approved,
  total_rejected,
  ROUND(avg_duration::numeric, 1) as avg_duration_seconds,
  manual_runs,
  auto_runs,
  CASE 
    WHEN total_processed > 0 
    THEN ROUND(100.0 * total_approved / total_processed, 1) 
    ELSE 0 
  END as approval_rate
FROM daily_stats
ORDER BY run_date DESC;

-- Grant permissions
GRANT SELECT ON scheduler_history TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT SELECT ON schedule_analytics TO authenticated;

-- Add comments
COMMENT ON TABLE scheduler_history IS 'History of all scheduled and manual content update runs';
COMMENT ON TABLE notifications IS 'System notifications for admin dashboard';
COMMENT ON VIEW schedule_analytics IS 'Daily analytics for content update schedule performance';