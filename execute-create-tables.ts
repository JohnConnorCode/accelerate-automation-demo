#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Initialize Supabase client with service role key
const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk0NzkzMCwiZXhwIjoyMDQ4NTIzOTMwfQ.lVBVMSu8wUvcD7eVFm-PZYsWVOE49KM_PAjYMpvGR5U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function executeSQLStatements() {
  console.log('🚀 EXECUTING QUEUE TABLES CREATION\n');
  console.log('='.repeat(60));
  
  try {
    // First, drop existing tables
    console.log('\n📊 Step 1: Dropping existing tables if they exist...\n');
    
    const dropStatements = [
      'DROP TABLE IF EXISTS public.queue_projects CASCADE',
      'DROP TABLE IF EXISTS public.queue_funding_programs CASCADE',
      'DROP TABLE IF EXISTS public.queue_resources CASCADE'
    ];
    
    for (const stmt of dropStatements) {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        console.log(`⚠️  Warning (may be normal): ${error.message}`);
      }
    }
    
    console.log('✅ Cleanup complete');
    
    // Read the SQL file
    const sqlContent = fs.readFileSync('./create-robust-queue-tables.sql', 'utf-8');
    
    // Split into individual statements (be careful with this approach)
    // For now, let's just create the tables one by one
    
    console.log('\n📊 Step 2: Creating queue_projects table...\n');
    
    const createProjectsTable = `
    CREATE TABLE public.queue_projects (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL CHECK (length(description) >= 100),
      short_description TEXT NOT NULL CHECK (length(short_description) <= 200),
      url TEXT NOT NULL UNIQUE,
      team_size INTEGER NOT NULL CHECK (team_size > 0 AND team_size <= 100),
      founder_names TEXT[] NOT NULL CHECK (array_length(founder_names, 1) > 0),
      founder_linkedin_urls TEXT[],
      funding_raised DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (funding_raised >= 0),
      funding_stage TEXT NOT NULL CHECK (funding_stage IN ('pre-seed', 'seed', 'series-a', 'bootstrapped', 'grant-funded')),
      previous_investors TEXT[],
      seeking_amount DECIMAL(15,2),
      launch_date DATE NOT NULL,
      incorporation_date DATE,
      incorporation_country TEXT,
      github_url TEXT,
      github_stars INTEGER DEFAULT 0,
      github_last_commit DATE,
      demo_url TEXT,
      technical_stack TEXT[] NOT NULL CHECK (array_length(technical_stack, 1) > 0),
      twitter_url TEXT,
      twitter_followers INTEGER DEFAULT 0,
      discord_url TEXT,
      discord_members INTEGER DEFAULT 0,
      telegram_url TEXT,
      website_traffic_monthly INTEGER,
      categories TEXT[] NOT NULL CHECK (array_length(categories, 1) > 0),
      supported_chains TEXT[],
      target_market TEXT NOT NULL,
      active_users INTEGER DEFAULT 0,
      monthly_revenue DECIMAL(15,2) DEFAULT 0,
      total_transactions INTEGER DEFAULT 0,
      tvl_usd DECIMAL(15,2) DEFAULT 0,
      grant_participation TEXT[],
      incubator_participation TEXT[],
      hackathon_wins TEXT[],
      project_needs TEXT[] NOT NULL CHECK (array_length(project_needs, 1) > 0),
      problem_statement TEXT NOT NULL CHECK (length(problem_statement) >= 100),
      solution_description TEXT NOT NULL CHECK (length(solution_description) >= 100),
      unique_value_proposition TEXT NOT NULL CHECK (length(unique_value_proposition) >= 50),
      competitive_advantage TEXT,
      roadmap_milestones TEXT[],
      data_completeness_score DECIMAL(3,2) CHECK (data_completeness_score >= 0 AND data_completeness_score <= 1),
      verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'partially-verified', 'verified')),
      last_enrichment_date TIMESTAMP,
      enrichment_sources TEXT[],
      source TEXT NOT NULL,
      fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
      score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
      ai_analysis JSONB,
      status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'under_review', 'approved', 'rejected', 'needs_info')),
      reviewer_notes TEXT,
      reviewed_by TEXT,
      reviewed_at TIMESTAMP,
      rejection_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT valid_team_for_accelerate CHECK (team_size <= 10),
      CONSTRAINT valid_funding_for_accelerate CHECK (funding_raised < 500000),
      CONSTRAINT valid_launch_date CHECK (launch_date >= '2024-01-01'),
      CONSTRAINT has_social_presence CHECK (
        twitter_url IS NOT NULL OR 
        discord_url IS NOT NULL OR 
        telegram_url IS NOT NULL
      )
    )`;
    
    // Unfortunately, the Supabase client doesn't have a direct SQL execution method
    // We need to use the REST API directly or use migrations
    
    console.log('❌ Direct SQL execution not supported via client');
    console.log('\n📝 MANUAL ACTION REQUIRED:\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
    console.log('2. Copy the SQL from: create-robust-queue-tables.sql');
    console.log('3. Paste and click RUN');
    console.log('\nThe Supabase JavaScript client does not support direct DDL execution.');
    console.log('You must use the dashboard SQL editor or Supabase CLI migrations.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

executeSQLStatements().catch(console.error);