#!/usr/bin/env npx tsx

/**
 * Create tables using direct API calls to Supabase
 * This approach bypasses the client limitations
 */

import dotenv from 'dotenv';
import fs from 'fs';

// Load environment
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

async function createTablesViaAPI() {
  console.log('🚀 Creating tables via Supabase API...\n');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log('❌ Missing Supabase credentials');
    return;
  }

  const sql = fs.readFileSync('./scripts/create-essential-tables.sql', 'utf-8');

  // Split into individual table creation statements
  const tableStatements = [
    // 1. API Cache
    `CREATE TABLE IF NOT EXISTS api_cache (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      cache_key VARCHAR(255) UNIQUE NOT NULL,
      cache_value JSONB NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 2. Search Analytics
    `CREATE TABLE IF NOT EXISTS search_analytics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      query TEXT NOT NULL,
      results_count INTEGER DEFAULT 0,
      response_time INTEGER,
      user_id UUID,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 3. Monitoring Metrics
    `CREATE TABLE IF NOT EXISTS monitoring_metrics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      value NUMERIC NOT NULL,
      unit VARCHAR(50),
      tags JSONB,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 4. Rate Limit Violations
    `CREATE TABLE IF NOT EXISTS rate_limit_violations (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      ip_address INET NOT NULL,
      endpoint VARCHAR(255),
      violation_count INTEGER DEFAULT 1,
      violation_type VARCHAR(50),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 5. Webhook Endpoints
    `CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      url TEXT NOT NULL,
      events TEXT[] NOT NULL,
      secret VARCHAR(255),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 6. Webhook Deliveries
    `CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      endpoint_id UUID REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      event_type VARCHAR(100),
      payload JSONB,
      status VARCHAR(50) DEFAULT 'pending',
      response_code INTEGER,
      delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 7. Queue Resources (if not exists)
    `CREATE TABLE IF NOT EXISTS queue_resources (
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
    );`,

    // 8. Queue Funding Programs (if not exists)
    `CREATE TABLE IF NOT EXISTS queue_funding_programs (
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
    );`,

    // 9. Error Logs
    `CREATE TABLE IF NOT EXISTS error_logs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      error_type VARCHAR(100),
      error_message TEXT,
      stack_trace TEXT,
      context JSONB,
      severity VARCHAR(20),
      service VARCHAR(100),
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 10. Fetch History
    `CREATE TABLE IF NOT EXISTS fetch_history (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      source VARCHAR(100) NOT NULL,
      items_fetched INTEGER DEFAULT 0,
      items_validated INTEGER DEFAULT 0,
      items_scored INTEGER DEFAULT 0,
      items_inserted INTEGER DEFAULT 0,
      success BOOLEAN DEFAULT true,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 11. Monitoring Alerts
    `CREATE TABLE IF NOT EXISTS monitoring_alerts (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      alert_id VARCHAR(255) UNIQUE NOT NULL,
      severity VARCHAR(20) NOT NULL,
      service VARCHAR(100),
      message TEXT,
      details JSONB,
      resolved BOOLEAN DEFAULT false,
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`,

    // 12. Tags
    `CREATE TABLE IF NOT EXISTS tags (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      count INTEGER DEFAULT 0,
      category VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );`
  ];

  let created = 0;
  let failed = 0;

  for (let i = 0; i < tableStatements.length; i++) {
    const statement = tableStatements[i];
    const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `table_${i}`;

    try {
      console.log(`Creating ${tableName}...`);

      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ sql: statement })
      });

      if (response.ok) {
        console.log(`✅ ${tableName} created`);
        created++;
      } else {
        const error = await response.text();
        console.log(`❌ ${tableName} failed: ${error}`);
        failed++;
      }
    } catch (error: any) {
      console.log(`❌ ${tableName} error: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${failed} failed`);

  console.log('\n🔗 Manual creation URL:');
  console.log('https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql');
}

createTablesViaAPI().catch(console.error);