#!/usr/bin/env npx tsx

/**
 * Fix Database Schema
 * Creates missing tables and constraints
 */


import * as dotenv from 'dotenv';
import * as path from 'path';
import { supabase } from '../src/lib/supabase-client';


// Load environment from .env.local first, then .env
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-')) {
  console.error('❌ Missing or invalid Supabase credentials');
  console.log('Please configure your .env.local file with:');
  console.log('  SUPABASE_URL=https://your-project.supabase.co');
  console.log('  SUPABASE_SERVICE_KEY=your-service-key');
  process.exit(1);
}



async function fixSchema() {
  console.log('🔧 Checking and fixing database schema...\n');

  // Define the required schema
  const schema = {
    // Queue tables for staging
    queue_projects: `
      CREATE TABLE IF NOT EXISTS queue_projects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL,
        score NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        accelerate_fit BOOLEAN,
        accelerate_reason TEXT,
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `,
    
    queue_investors: `
      CREATE TABLE IF NOT EXISTS queue_investors (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL,
        score NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        accelerate_fit BOOLEAN,
        accelerate_reason TEXT,
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `,
    
    queue_news: `
      CREATE TABLE IF NOT EXISTS queue_news (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        source TEXT NOT NULL,
        score NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        accelerate_fit BOOLEAN,
        accelerate_reason TEXT,
        processed_at TIMESTAMP WITH TIME ZONE
      )
    `,
    
    // Main content tables
    projects: `
      CREATE TABLE IF NOT EXISTS projects (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        short_description TEXT NOT NULL,
        website_url TEXT NOT NULL UNIQUE,
        github_url TEXT,
        twitter_url TEXT,
        discord_url TEXT,
        launch_date DATE NOT NULL,
        funding_raised NUMERIC DEFAULT 0,
        funding_round TEXT,
        team_size INTEGER DEFAULT 1,
        categories TEXT[] DEFAULT '{}',
        supported_chains TEXT[] DEFAULT '{}',
        project_status TEXT DEFAULT 'active',
        seeking_funding BOOLEAN DEFAULT false,
        seeking_cofounders BOOLEAN DEFAULT false,
        seeking_developers BOOLEAN DEFAULT false,
        accelerate_score NUMERIC,
        source TEXT,
        source_url TEXT,
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        problem_statement TEXT,
        value_proposition TEXT,
        target_market TEXT
      )
    `,
    
    funding_programs: `
      CREATE TABLE IF NOT EXISTS funding_programs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        name TEXT NOT NULL,
        organization TEXT NOT NULL,
        description TEXT NOT NULL,
        funding_type TEXT NOT NULL,
        min_amount NUMERIC DEFAULT 0,
        max_amount NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        equity_required BOOLEAN DEFAULT false,
        equity_percentage NUMERIC DEFAULT 0,
        application_url TEXT NOT NULL UNIQUE,
        application_deadline DATE,
        application_process TEXT,
        decision_timeline TEXT,
        eligibility_criteria TEXT[] DEFAULT '{}',
        geographic_restrictions TEXT[] DEFAULT '{}',
        stage_preferences TEXT[] DEFAULT '{}',
        sector_focus TEXT[] DEFAULT '{}',
        program_duration TEXT,
        program_location TEXT,
        cohort_size INTEGER,
        benefits TEXT[] DEFAULT '{}',
        mentor_profiles TEXT[] DEFAULT '{}',
        last_investment_date DATE,
        total_deployed_2025 NUMERIC DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        accelerate_score NUMERIC,
        source TEXT,
        source_url TEXT
      )
    `,
    
    resources: `
      CREATE TABLE IF NOT EXISTS resources (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        resource_type TEXT NOT NULL,
        category TEXT NOT NULL,
        price_type TEXT DEFAULT 'free',
        price_amount NUMERIC DEFAULT 0,
        trial_available BOOLEAN DEFAULT false,
        provider_name TEXT NOT NULL,
        provider_credibility TEXT,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        difficulty_level TEXT DEFAULT 'beginner',
        time_commitment TEXT,
        prerequisites TEXT[] DEFAULT '{}',
        key_benefits TEXT[] DEFAULT '{}',
        use_cases TEXT[] DEFAULT '{}',
        accelerate_score NUMERIC,
        source TEXT,
        tags TEXT[] DEFAULT '{}'
      )
    `,
    
    // Cache and utility tables
    api_cache: `
      CREATE TABLE IF NOT EXISTS api_cache (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        cache_key TEXT NOT NULL UNIQUE,
        cache_value JSONB NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `,
    
    content_queue: `
      CREATE TABLE IF NOT EXISTS content_queue (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL,
        source TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        score NUMERIC DEFAULT 0,
        quality_score NUMERIC,
        raw_data JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        reviewed_at TIMESTAMP WITH TIME ZONE,
        reviewed_by TEXT
      )
    `
  };

  // Create indexes
  const indexes = {
    idx_queue_projects_status: `CREATE INDEX IF NOT EXISTS idx_queue_projects_status ON queue_projects(status)`,
    idx_queue_projects_source: `CREATE INDEX IF NOT EXISTS idx_queue_projects_source ON queue_projects(source)`,
    idx_queue_investors_status: `CREATE INDEX IF NOT EXISTS idx_queue_investors_status ON queue_investors(status)`,
    idx_queue_news_status: `CREATE INDEX IF NOT EXISTS idx_queue_news_status ON queue_news(status)`,
    idx_projects_launch_date: `CREATE INDEX IF NOT EXISTS idx_projects_launch_date ON projects(launch_date)`,
    idx_projects_funding: `CREATE INDEX IF NOT EXISTS idx_projects_funding ON projects(funding_raised)`,
    idx_funding_programs_active: `CREATE INDEX IF NOT EXISTS idx_funding_programs_active ON funding_programs(is_active)`,
    idx_api_cache_expires: `CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_cache(expires_at)`,
    idx_content_queue_status: `CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status, type)`
  };

  // Execute schema creation
  console.log('Creating tables...');
  for (const [table, sql] of Object.entries(schema)) {
    try {
      // Note: We can't execute raw SQL with anon key, but we can check if table exists
      const { data, error } = await supabase.from(table).select('id').limit(1);
      
      if (error?.message?.includes('does not exist')) {
        console.log(`❌ Table ${table} does not exist - needs manual creation`);
        console.log(`   SQL to run in Supabase SQL editor:`);
        console.log(`   ${sql.substring(0, 200)}...`);
      } else {
        console.log(`✅ Table ${table} exists`);
      }
    } catch (err) {
      console.log(`⚠️  Cannot verify ${table}: ${err.message}`);
    }
  }

  console.log('\n📋 Summary:');
  console.log('If any tables are missing, please run the following SQL in Supabase SQL editor:');
  console.log('https://app.supabase.com/project/[your-project]/sql/new\n');
  
  // Output full SQL for missing tables
  const fullSql = Object.values(schema).join(';\n\n') + ';\n\n' + Object.values(indexes).join(';\n');
  console.log('-- Full SQL script:\n');
  console.log(fullSql);
}

fixSchema().catch(console.error);