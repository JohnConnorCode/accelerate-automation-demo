#!/usr/bin/env node
/**
 * Create a new table for unified startup profiles
 * This table will store the enriched, multi-source data
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';

config();

async function createUnifiedTable() {
  console.log('🔧 Creating unified_startups table...\n');
  
  try {
    // First, let's create the table using Supabase's SQL editor approach
    // Since we can't run DDL directly, we'll insert test data to verify schema
    
    // Test if table exists by trying to query it
    const { data: existing, error: checkError } = await supabase
      .from('unified_startups')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Table unified_startups already exists');
      
      // Get count
      const { count } = await supabase
        .from('unified_startups')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Current records: ${count}`);
      return true;
    }
    
    console.log('❌ Table does not exist yet');
    console.log('\n📝 Please create the table with this SQL in Supabase dashboard:\n');
    
    const createTableSQL = `
-- Create unified_startups table for multi-source enriched data
CREATE TABLE IF NOT EXISTS public.unified_startups (
  -- Identity
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  aliases TEXT[],
  description TEXT,
  
  -- Identifiers for cross-platform matching
  domain VARCHAR(255),
  github_org VARCHAR(255),
  twitter_handle VARCHAR(100),
  linkedin_slug VARCHAR(255),
  product_hunt_slug VARCHAR(255),
  
  -- Company details
  founded_date DATE,
  location_city VARCHAR(100),
  location_country VARCHAR(100),
  is_remote BOOLEAN DEFAULT false,
  industry TEXT[],
  tags TEXT[],
  stage VARCHAR(50),
  
  -- Team
  founders JSONB,
  team_size INTEGER,
  team_size_range VARCHAR(20),
  
  -- Funding
  funding_total_raised BIGINT,
  funding_last_round JSONB,
  funding_rounds JSONB[],
  investors TEXT[],
  valuation BIGINT,
  
  -- Metrics
  metrics JSONB,
  
  -- Content
  news_articles JSONB[],
  launches JSONB[],
  social_posts JSONB[],
  
  -- Data quality
  sources TEXT[] NOT NULL,
  source_urls JSONB,
  data_completeness INTEGER DEFAULT 0,
  data_confidence INTEGER DEFAULT 0,
  verification_level VARCHAR(20) DEFAULT 'none',
  match_confidence JSONB,
  
  -- ACCELERATE scoring
  accelerate_score INTEGER DEFAULT 0,
  accelerate_eligible BOOLEAN DEFAULT false,
  accelerate_criteria JSONB,
  accelerate_recommendation VARCHAR(20),
  
  -- Timestamps
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  last_enriched_at TIMESTAMP,
  
  -- Indexes for performance
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_unified_startups_canonical_name ON public.unified_startups(canonical_name);
CREATE INDEX idx_unified_startups_domain ON public.unified_startups(domain);
CREATE INDEX idx_unified_startups_stage ON public.unified_startups(stage);
CREATE INDEX idx_unified_startups_accelerate_score ON public.unified_startups(accelerate_score DESC);
CREATE INDEX idx_unified_startups_data_completeness ON public.unified_startups(data_completeness DESC);
CREATE INDEX idx_unified_startups_sources ON public.unified_startups USING GIN(sources);
CREATE INDEX idx_unified_startups_tags ON public.unified_startups USING GIN(tags);

-- Enable RLS (but with permissive policy for testing)
ALTER TABLE public.unified_startups ENABLE ROW LEVEL SECURITY;

-- Create permissive policy for authenticated users
CREATE POLICY "Enable all for authenticated" ON public.unified_startups
  FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON public.unified_startups TO authenticated;
GRANT ALL ON public.unified_startups TO anon;
`;
    
    console.log(createTableSQL);
    
    console.log('\n🎯 After creating the table, run this script again to test it.');
    
    return false;
    
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Run
createUnifiedTable().then(success => {
  if (success) {
    console.log('\n✅ Table is ready for use');
  } else {
    console.log('\n⚠️ Please create the table in Supabase dashboard first');
  }
  process.exit(success ? 0 : 1);
});