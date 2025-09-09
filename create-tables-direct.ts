#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk0NzkzMCwiZXhwIjoyMDQ4NTIzOTMwfQ.lVBVMSu8wUvcD7eVFm-PZYsWVOE49KM_PAjYMpvGR5U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTables() {
  console.log('🚀 Creating Queue Tables Directly...\n');

  // Create queue_projects table
  const createQueueProjects = `
    CREATE TABLE IF NOT EXISTS queue_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Core Fields
      company_name TEXT NOT NULL,
      description TEXT,
      website TEXT,
      founded_year INTEGER,
      
      -- ACCELERATE Fields (Required)
      accelerate_fit BOOLEAN DEFAULT false,
      accelerate_reason TEXT,
      accelerate_score NUMERIC(3,2),
      confidence_score NUMERIC(3,2),
      
      -- Location & Team
      location TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      founders TEXT[],
      team_size INTEGER,
      employee_count INTEGER,
      
      -- Funding & Business
      funding_amount BIGINT,
      funding_round TEXT,
      funding_investors TEXT[],
      last_funding_date DATE,
      total_funding BIGINT,
      valuation BIGINT,
      revenue BIGINT,
      business_model TEXT,
      
      -- Technology & Industry
      technology_stack TEXT[],
      industry_tags TEXT[],
      market_category TEXT,
      target_market TEXT,
      competitive_advantage TEXT,
      
      -- Source & Enrichment
      source TEXT NOT NULL,
      source_url TEXT,
      source_created_at TIMESTAMP WITH TIME ZONE,
      batch_id TEXT,
      enriched BOOLEAN DEFAULT false,
      enrichment_data JSONB,
      
      -- AI Analysis
      ai_summary TEXT,
      ai_insights JSONB,
      sentiment_score NUMERIC(3,2),
      growth_potential TEXT,
      risk_factors TEXT[],
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Prevent duplicates
      CONSTRAINT unique_queue_company UNIQUE(company_name, source)
    );
  `;

  // Create queue_news table
  const createQueueNews = `
    CREATE TABLE IF NOT EXISTS queue_news (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Core Fields
      title TEXT NOT NULL,
      content TEXT,
      url TEXT,
      published_date TIMESTAMP WITH TIME ZONE,
      
      -- ACCELERATE Fields
      accelerate_fit BOOLEAN DEFAULT false,
      accelerate_reason TEXT,
      accelerate_score NUMERIC(3,2),
      confidence_score NUMERIC(3,2),
      
      -- Article Details
      author TEXT,
      publication TEXT,
      category TEXT,
      tags TEXT[],
      image_url TEXT,
      video_url TEXT,
      
      -- Company Relations
      company_name TEXT,
      company_id UUID,
      mentioned_companies TEXT[],
      
      -- Content Analysis
      summary TEXT,
      key_points TEXT[],
      sentiment TEXT,
      sentiment_score NUMERIC(3,2),
      relevance_score NUMERIC(3,2),
      
      -- Engagement Metrics
      views INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      engagement_score NUMERIC(5,2),
      
      -- Source & Enrichment
      source TEXT NOT NULL,
      source_url TEXT,
      source_id TEXT,
      batch_id TEXT,
      enriched BOOLEAN DEFAULT false,
      enrichment_data JSONB,
      
      -- AI Analysis
      ai_summary TEXT,
      ai_insights JSONB,
      ai_keywords TEXT[],
      ai_entities JSONB,
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Prevent duplicates
      CONSTRAINT unique_queue_news UNIQUE(title, source, published_date)
    );
  `;

  // Create queue_investors table
  const createQueueInvestors = `
    CREATE TABLE IF NOT EXISTS queue_investors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- Core Fields
      name TEXT NOT NULL,
      type TEXT,
      description TEXT,
      website TEXT,
      
      -- ACCELERATE Fields
      accelerate_fit BOOLEAN DEFAULT false,
      accelerate_reason TEXT,
      accelerate_score NUMERIC(3,2),
      confidence_score NUMERIC(3,2),
      
      -- Investment Profile
      investment_stage TEXT[],
      investment_size_min BIGINT,
      investment_size_max BIGINT,
      total_investments INTEGER,
      total_portfolio_value BIGINT,
      
      -- Focus Areas
      industry_focus TEXT[],
      geographic_focus TEXT[],
      technology_focus TEXT[],
      business_model_focus TEXT[],
      
      -- Portfolio
      portfolio_companies TEXT[],
      notable_investments JSONB,
      recent_investments JSONB,
      exits JSONB,
      
      -- Team
      partners JSONB,
      team_size INTEGER,
      founded_year INTEGER,
      headquarters TEXT,
      offices TEXT[],
      
      -- Contact
      contact_email TEXT,
      contact_phone TEXT,
      linkedin_url TEXT,
      twitter_url TEXT,
      
      -- Performance
      irr NUMERIC(5,2),
      multiple NUMERIC(5,2),
      success_rate NUMERIC(5,2),
      
      -- Source & Enrichment
      source TEXT NOT NULL,
      source_url TEXT,
      batch_id TEXT,
      enriched BOOLEAN DEFAULT false,
      enrichment_data JSONB,
      
      -- AI Analysis
      ai_summary TEXT,
      ai_insights JSONB,
      investment_thesis TEXT,
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Prevent duplicates
      CONSTRAINT unique_queue_investor UNIQUE(name, type)
    );
  `;

  try {
    // Execute each CREATE TABLE statement
    console.log('Creating queue_projects...');
    const { error: error1 } = await supabase.rpc('exec_sql', { sql: createQueueProjects });
    if (error1) throw error1;
    
    console.log('Creating queue_news...');
    const { error: error2 } = await supabase.rpc('exec_sql', { sql: createQueueNews });
    if (error2) throw error2;
    
    console.log('Creating queue_investors...');
    const { error: error3 } = await supabase.rpc('exec_sql', { sql: createQueueInvestors });
    if (error3) throw error3;
    
    console.log('\n✅ All tables created successfully!');
    
    // Verify tables exist
    const { data, error } = await supabase
      .from('queue_projects')
      .select('count');
    
    if (!error) {
      console.log('✅ Verified: Tables are accessible via Supabase client');
    }
    
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    
    // Alternative: Try direct SQL through a different method
    console.log('\nTrying alternative approach...');
    
    // Try using raw SQL via the SQL editor endpoint
    const queries = [createQueueProjects, createQueueNews, createQueueInvestors];
    
    for (const query of queries) {
      try {
        // This approach uses the underlying PostgreSQL connection
        const { data, error } = await supabase.rpc('query', { 
          query_text: query 
        });
        
        if (error) {
          console.log('RPC query not available, trying direct execution...');
          
          // Final attempt: Use the admin API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: query })
          });
          
          if (!response.ok) {
            console.log('Admin API not available either.');
          }
        }
      } catch (e) {
        // Continue to next approach
      }
    }
  }
}

// Run the script
createTables().catch(console.error);