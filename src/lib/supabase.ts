import { createClient } from '@supabase/supabase-js';

// Use placeholders if not configured
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'placeholder-key';

export const isConfigured = !supabaseUrl.includes('placeholder');

if (!isConfigured) {
  console.warn('⚠️ Supabase not configured. Using placeholder values.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Types for our content
export interface BaseContent {
  id?: string;
  url: string;
  title: string;
  description: string;
  source_data: Record<string, any>;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  ai_score: number | null;
  ai_reasoning: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Resource extends BaseContent {
  content_type: 'resource';
  resource_source: 'producthunt' | 'devto' | 'github_tools';
  resource_category: 'tools' | 'guides' | 'tutorials' | 'documentation' | 'articles';
  author?: string;
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
}

export interface Project extends BaseContent {
  content_type: 'project';
  project_source: 'github_repos' | 'devpost' | 'web3_directory' | 'web3_directories' | 'ecosystem_lists';
  project_category: 'defi' | 'nft' | 'infrastructure' | 'gaming' | 'social';
  github_url?: string;
  website_url?: string;
  team_size?: number;
  funding_raised?: number;
  launch_date?: string;
  blockchain?: string[];
  token_symbol?: string;
}

export interface FundingProgram extends BaseContent {
  content_type: 'funding';
  funding_source: 'gitcoin' | 'foundation_registry' | 'accelerators' | 'web3_grants' | 'ecosystem_programs' | 'chain_specific';
  funding_category: 'grant' | 'accelerator' | 'bounty' | 'hackathon' | 'incubator';
  funding_amount_min?: number;
  funding_amount_max?: number;
  deadline?: string;
  eligibility_criteria?: string[];
  application_url?: string;
  organization?: string;
  funding_type?: 'equity' | 'grant' | 'token' | 'hybrid';
}

export type ContentItem = Resource | Project | FundingProgram;