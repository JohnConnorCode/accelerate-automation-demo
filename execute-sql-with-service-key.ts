#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk0NzkzMCwiZXhwIjoyMDQ4NTIzOTMwfQ.lVBVMSu8wUvcD7eVFm-PZYsWVOE49KM_PAjYMpvGR5U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTables() {
  console.log('🚀 Creating Queue Tables with Service Key...\n');

  // Split into individual statements for better error handling
  const statements = [
    // Create queue_projects table
    `CREATE TABLE IF NOT EXISTS public.queue_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id VARCHAR(255) NOT NULL UNIQUE,
      project_name VARCHAR(255) NOT NULL,
      founder_names VARCHAR(255),
      one_liner TEXT,
      description TEXT,
      logo_url TEXT,
      website_url TEXT,
      pitch_deck_url TEXT,
      demo_video_url TEXT,
      launch_date DATE,
      tags TEXT[],
      industry VARCHAR(100),
      business_model VARCHAR(100),
      funding_amount DECIMAL(15, 2),
      funding_round VARCHAR(50),
      investors TEXT[],
      team_size INTEGER,
      location VARCHAR(255),
      accelerator_batch VARCHAR(100),
      news_mentions TEXT[],
      source VARCHAR(100) NOT NULL,
      source_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      extracted_at TIMESTAMP WITH TIME ZONE NOT NULL,
      score DECIMAL(3, 2),
      score_explanation TEXT,
      is_processed BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMP WITH TIME ZONE,
      processed_by VARCHAR(255),
      processing_notes TEXT,
      quality_check JSONB,
      engagement_metrics JSONB,
      social_links JSONB,
      additional_metadata JSONB,
      CONSTRAINT queue_projects_project_id_unique UNIQUE(project_id),
      CONSTRAINT queue_projects_score_check CHECK (score >= 0 AND score <= 10),
      CONSTRAINT queue_projects_team_size_check CHECK (team_size >= 0),
      CONSTRAINT queue_projects_funding_amount_check CHECK (funding_amount >= 0)
    )`,

    // Create queue_funding_programs table
    `CREATE TABLE IF NOT EXISTS public.queue_funding_programs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      program_id VARCHAR(255) NOT NULL UNIQUE,
      program_name VARCHAR(255) NOT NULL,
      organization_name VARCHAR(255) NOT NULL,
      program_type VARCHAR(100),
      description TEXT,
      eligibility_criteria TEXT,
      funding_amount_min DECIMAL(15, 2),
      funding_amount_max DECIMAL(15, 2),
      equity_percentage DECIMAL(5, 2),
      application_deadline DATE,
      program_start_date DATE,
      program_end_date DATE,
      duration_weeks INTEGER,
      location VARCHAR(255),
      remote_friendly BOOLEAN DEFAULT FALSE,
      industries_focus TEXT[],
      stage_focus VARCHAR(100),
      notable_alumni TEXT[],
      success_rate DECIMAL(5, 2),
      total_portfolio_value DECIMAL(18, 2),
      website_url TEXT,
      application_url TEXT,
      contact_email VARCHAR(255),
      benefits TEXT[],
      requirements TEXT[],
      selection_process TEXT,
      mentor_network_size INTEGER,
      funding_terms TEXT,
      source VARCHAR(100) NOT NULL,
      source_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      extracted_at TIMESTAMP WITH TIME ZONE NOT NULL,
      score DECIMAL(3, 2),
      score_explanation TEXT,
      is_processed BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMP WITH TIME ZONE,
      processed_by VARCHAR(255),
      processing_notes TEXT,
      quality_metrics JSONB,
      alumni_outcomes JSONB,
      program_statistics JSONB,
      additional_metadata JSONB,
      CONSTRAINT queue_funding_programs_program_id_unique UNIQUE(program_id),
      CONSTRAINT queue_funding_programs_score_check CHECK (score >= 0 AND score <= 10),
      CONSTRAINT queue_funding_programs_equity_check CHECK (equity_percentage >= 0 AND equity_percentage <= 100),
      CONSTRAINT queue_funding_programs_success_rate_check CHECK (success_rate >= 0 AND success_rate <= 100),
      CONSTRAINT queue_funding_programs_duration_check CHECK (duration_weeks > 0)
    )`,

    // Create queue_resources table
    `CREATE TABLE IF NOT EXISTS public.queue_resources (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      resource_id VARCHAR(255) NOT NULL UNIQUE,
      resource_name VARCHAR(255) NOT NULL,
      resource_type VARCHAR(100) NOT NULL,
      category VARCHAR(100),
      subcategory VARCHAR(100),
      description TEXT,
      content_format VARCHAR(50),
      access_type VARCHAR(50),
      pricing_model VARCHAR(50),
      price_amount DECIMAL(10, 2),
      currency VARCHAR(10) DEFAULT 'USD',
      website_url TEXT,
      direct_link TEXT,
      author_name VARCHAR(255),
      author_credentials TEXT,
      organization VARCHAR(255),
      publication_date DATE,
      last_updated DATE,
      difficulty_level VARCHAR(50),
      time_to_complete VARCHAR(100),
      prerequisites TEXT[],
      learning_objectives TEXT[],
      key_takeaways TEXT[],
      target_audience TEXT[],
      industries_applicable TEXT[],
      tools_mentioned TEXT[],
      ratings_average DECIMAL(3, 2),
      ratings_count INTEGER,
      review_summary TEXT,
      usage_count INTEGER,
      completion_rate DECIMAL(5, 2),
      testimonials TEXT[],
      source VARCHAR(100) NOT NULL,
      source_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      extracted_at TIMESTAMP WITH TIME ZONE NOT NULL,
      score DECIMAL(3, 2),
      score_explanation TEXT,
      is_processed BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMP WITH TIME ZONE,
      processed_by VARCHAR(255),
      processing_notes TEXT,
      content_quality JSONB,
      engagement_data JSONB,
      related_resources JSONB,
      additional_metadata JSONB,
      CONSTRAINT queue_resources_resource_id_unique UNIQUE(resource_id),
      CONSTRAINT queue_resources_score_check CHECK (score >= 0 AND score <= 10),
      CONSTRAINT queue_resources_price_check CHECK (price_amount >= 0),
      CONSTRAINT queue_resources_ratings_check CHECK (ratings_average >= 0 AND ratings_average <= 5),
      CONSTRAINT queue_resources_completion_rate_check CHECK (completion_rate >= 0 AND completion_rate <= 100)
    )`
  ];

  // Create indexes
  const indexStatements = [
    'CREATE INDEX IF NOT EXISTS idx_queue_projects_created_at ON queue_projects(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_projects_score ON queue_projects(score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_projects_is_processed ON queue_projects(is_processed)',
    'CREATE INDEX IF NOT EXISTS idx_queue_projects_source ON queue_projects(source)',
    'CREATE INDEX IF NOT EXISTS idx_queue_funding_programs_created_at ON queue_funding_programs(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_funding_programs_score ON queue_funding_programs(score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_funding_programs_is_processed ON queue_funding_programs(is_processed)',
    'CREATE INDEX IF NOT EXISTS idx_queue_funding_programs_application_deadline ON queue_funding_programs(application_deadline)',
    'CREATE INDEX IF NOT EXISTS idx_queue_resources_created_at ON queue_resources(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_resources_score ON queue_resources(score DESC)',
    'CREATE INDEX IF NOT EXISTS idx_queue_resources_is_processed ON queue_resources(is_processed)',
    'CREATE INDEX IF NOT EXISTS idx_queue_resources_resource_type ON queue_resources(resource_type)'
  ];

  try {
    // Try to use RPC to execute SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: statements.join('; ')
    });

    if (error) {
      console.log('RPC method not available, trying alternative approach...');
      
      // Alternative: Try direct fetch with service key
      for (const sql of [...statements, ...indexStatements]) {
        const tableName = sql.match(/CREATE TABLE.*?public\.(\w+)/)?.[1] || 
                         sql.match(/CREATE INDEX.*?ON (\w+)/)?.[1] || 
                         'unknown';
        
        console.log(`Creating ${tableName}...`);
        
        // Unfortunately, Supabase JS SDK doesn't support DDL
        // The only way is through dashboard or migrations
      }
      
      console.log('\n⚠️  Tables cannot be created via JavaScript SDK');
      console.log('📝 Please execute the SQL in one of these ways:');
      console.log('\n1. Supabase Dashboard (Recommended):');
      console.log('   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
      console.log('   Copy and paste the SQL from: create-robust-queue-tables.sql');
      console.log('\n2. Supabase CLI Migration:');
      console.log('   npx supabase migration new create_queue_tables');
      console.log('   Copy SQL to the migration file');
      console.log('   npx supabase db push');
      
      return;
    }

    console.log('✅ All tables created successfully!');
  } catch (err) {
    console.error('Error:', err);
    console.log('\n📝 SQL is ready in: create-robust-queue-tables.sql');
    console.log('Execute it at: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  }
}

createTables();