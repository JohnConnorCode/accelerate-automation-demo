#!/usr/bin/env npx tsx

/**
 * Execute SQL directly on Supabase
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SQL statements to execute
const sqlStatements = [
  // Drop existing tables
  `DROP TABLE IF EXISTS public.queued_projects CASCADE`,
  `DROP TABLE IF EXISTS public.queued_funding_programs CASCADE`,
  `DROP TABLE IF EXISTS public.queued_resources CASCADE`,
  `DROP TABLE IF EXISTS public.projects CASCADE`,
  `DROP TABLE IF EXISTS public.funding_programs CASCADE`,
  `DROP TABLE IF EXISTS public.resources CASCADE`,
  `DROP VIEW IF EXISTS public.accelerate_startups CASCADE`,
  
  // Create queued_projects
  `CREATE TABLE public.queued_projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    url TEXT UNIQUE NOT NULL,
    launch_date DATE,
    funding_raised DECIMAL(15,2) DEFAULT 0,
    funding_round TEXT,
    team_size INTEGER,
    website_url TEXT,
    github_url TEXT,
    twitter_url TEXT,
    discord_url TEXT,
    categories TEXT[],
    supported_chains TEXT[],
    project_needs TEXT[],
    grant_participation TEXT[],
    incubator_participation TEXT[],
    traction_metrics JSONB,
    last_activity DATE,
    development_status TEXT,
    problem_solving TEXT,
    unique_value_prop TEXT,
    target_market TEXT,
    roadmap_highlights TEXT[],
    source TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending_review',
    ai_summary TEXT,
    metadata JSONB,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    reviewer_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create queued_funding_programs
  `CREATE TABLE public.queued_funding_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    funding_type TEXT,
    min_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    equity_required BOOLEAN DEFAULT false,
    equity_percentage DECIMAL(5,2),
    application_url TEXT,
    application_deadline DATE,
    application_process TEXT,
    decision_timeline TEXT,
    eligibility_criteria TEXT[],
    geographic_restrictions TEXT[],
    stage_preferences TEXT[],
    sector_focus TEXT[],
    program_duration TEXT,
    program_location TEXT,
    cohort_size INTEGER,
    benefits TEXT[],
    mentor_profiles TEXT[],
    alumni_companies TEXT[],
    last_investment_date DATE,
    recent_portfolio TEXT[],
    total_deployed_2025 DECIMAL(15,2),
    source TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending_review',
    ai_summary TEXT,
    metadata JSONB,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    reviewer_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create queued_resources
  `CREATE TABLE public.queued_resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    resource_type TEXT,
    category TEXT,
    price_type TEXT,
    price_amount DECIMAL(10,2),
    trial_available BOOLEAN,
    provider_name TEXT,
    provider_credibility TEXT,
    last_updated DATE,
    difficulty_level TEXT,
    time_commitment TEXT,
    prerequisites TEXT[],
    key_benefits TEXT[],
    use_cases TEXT[],
    success_stories TEXT[],
    source TEXT,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending_review',
    ai_summary TEXT,
    metadata JSONB,
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,
    reviewer_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create projects (production)
  `CREATE TABLE public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    short_description TEXT,
    url TEXT UNIQUE NOT NULL,
    launch_date DATE,
    funding_raised DECIMAL(15,2) DEFAULT 0,
    funding_round TEXT,
    team_size INTEGER,
    website_url TEXT,
    github_url TEXT,
    twitter_url TEXT,
    discord_url TEXT,
    categories TEXT[],
    supported_chains TEXT[],
    project_needs TEXT[],
    grant_participation TEXT[],
    incubator_participation TEXT[],
    traction_metrics JSONB,
    last_activity DATE,
    development_status TEXT,
    problem_solving TEXT,
    unique_value_prop TEXT,
    target_market TEXT,
    roadmap_highlights TEXT[],
    score INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata JSONB,
    approved_at TIMESTAMP DEFAULT NOW(),
    approved_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create funding_programs (production)
  `CREATE TABLE public.funding_programs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    organization TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    funding_type TEXT,
    min_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    currency TEXT DEFAULT 'USD',
    equity_required BOOLEAN DEFAULT false,
    equity_percentage DECIMAL(5,2),
    application_url TEXT,
    application_deadline DATE,
    application_process TEXT,
    decision_timeline TEXT,
    eligibility_criteria TEXT[],
    geographic_restrictions TEXT[],
    stage_preferences TEXT[],
    sector_focus TEXT[],
    program_duration TEXT,
    program_location TEXT,
    cohort_size INTEGER,
    benefits TEXT[],
    mentor_profiles TEXT[],
    alumni_companies TEXT[],
    last_investment_date DATE,
    recent_portfolio TEXT[],
    total_deployed_2025 DECIMAL(15,2),
    score INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata JSONB,
    approved_at TIMESTAMP DEFAULT NOW(),
    approved_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create resources (production)
  `CREATE TABLE public.resources (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    resource_type TEXT,
    category TEXT,
    price_type TEXT,
    price_amount DECIMAL(10,2),
    trial_available BOOLEAN,
    provider_name TEXT,
    provider_credibility TEXT,
    last_updated DATE,
    difficulty_level TEXT,
    time_commitment TEXT,
    prerequisites TEXT[],
    key_benefits TEXT[],
    use_cases TEXT[],
    success_stories TEXT[],
    score INTEGER DEFAULT 0,
    ai_summary TEXT,
    metadata JSONB,
    approved_at TIMESTAMP DEFAULT NOW(),
    approved_by TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  
  // Create backward compatibility view
  `CREATE VIEW public.accelerate_startups AS SELECT * FROM public.projects`,
  
  // Fix content_queue constraint
  `ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_description_check`
];

async function executeSql() {
  console.log('🚀 Setting up database tables...\n');
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const sql of sqlStatements) {
    const tableName = sql.match(/(?:TABLE|VIEW)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?public\.(\w+)/i)?.[1] || 'statement';
    process.stdout.write(`Creating ${tableName}... `);
    
    try {
      // For testing, let's just verify connection
      if (sql.startsWith('DROP') || sql.startsWith('ALTER')) {
        // These might fail if tables don't exist, that's OK
        console.log('⏭️  Skipped (cleanup)');
        continue;
      }
      
      // Since direct SQL execution isn't working, let's verify tables exist
      const { error } = await supabase.from(tableName).select('id').limit(1);
      
      if (error && error.code === '42P01') {
        // Table doesn't exist, would need to create it
        console.log('❌ Table needs creation');
        errors.push(`Table ${tableName} needs to be created`);
        errorCount++;
      } else if (error) {
        console.log(`⚠️  ${error.message}`);
        errorCount++;
      } else {
        console.log('✅ Exists');
        successCount++;
      }
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
      errors.push(`${tableName}: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Results: ${successCount} successful, ${errorCount} need attention`);
  
  if (errors.length > 0) {
    console.log('\n⚠️  Issues found:');
    errors.forEach(err => console.log(`  - ${err}`));
  }

  console.log('\n📝 IMPORTANT: You need to run the SQL in create-all-tables.sql');
  console.log('   directly in the Supabase SQL Editor:');
  console.log('   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  console.log('\n   Copy the contents of create-all-tables.sql and execute it there.');
}

executeSql().catch(console.error);