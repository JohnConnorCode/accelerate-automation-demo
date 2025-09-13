/**
 * Central type definitions for the Accelerate Content Automation system
 */

export interface ContentItem {
  id?: string;
  source: string;
  type: 'resource' | 'project' | 'funding' | 'article' | 'tool' | 'blockchain' | 'analytics' | 'social';
  title: string;
  description: string;
  url: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  fetched_at?: Date;
  created_at?: string;
  updated_at?: string;
  score?: number;
  accelerate_fit?: boolean;
  accelerate_reason?: string;
}

export interface OrchestratorResult {
  success: boolean;
  fetched: number;
  validated: number;
  unique: number;
  inserted: number;
  errors: string[];
  duration: number;
}

export interface BatchResult {
  success: boolean;
  inserted: {
    projects: number;
    funding: number;
    resources: number;
  };
  errors: string[];
}

export * from './types/supabase';