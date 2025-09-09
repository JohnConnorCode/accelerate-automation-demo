#!/usr/bin/env npx tsx

const SUPABASE_ACCESS_TOKEN = 'sbp_6e20e3edb22f4158328b31a0dec746fdd0cbaf2a';
const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';

async function createErrorLogsTables() {
  console.log('🚀 Creating Error Logging Tables...\n');

  const sql = `
CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_level TEXT NOT NULL,
  message TEXT NOT NULL,
  error_code TEXT,
  stack_trace TEXT,
  service TEXT NOT NULL,
  function_name TEXT,
  user_id TEXT,
  request_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(error_level);
CREATE INDEX IF NOT EXISTS idx_error_logs_service ON error_logs(service);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC,
  metric_unit TEXT,
  service TEXT NOT NULL,
  environment TEXT DEFAULT 'production',
  tags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_created ON system_metrics(created_at DESC);
  `;

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.log('API Response:', error);
      throw new Error('Failed to create tables');
    }

    console.log('✅ Error logging tables created successfully!');
    console.log('   - error_logs: For tracking all system errors');
    console.log('   - system_metrics: For performance tracking');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createErrorLogsTables().catch(console.error);