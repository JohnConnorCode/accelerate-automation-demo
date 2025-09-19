// DEPRECATED: This file is kept for backward compatibility
// All new code should import from './supabase-client' directly
export { supabase, isSupabaseConfigured, testConnection, getDatabaseStats } from './supabase-client';
export type { Database } from '../types/supabase';

// Table names constants
export const TABLES = {
  CONTENT_QUEUE: 'content_queue',
  PROJECTS: 'projects',
  QUEUE_PROJECTS: 'queue_projects',
  FUNDING_PROGRAMS: 'funding_programs',
  QUEUE_FUNDING_PROGRAMS: 'queue_funding_programs',
  RESOURCES: 'resources',
  QUEUE_RESOURCES: 'queue_resources',
  API_CACHE: 'api_cache',
  SYSTEM_SETTINGS: 'system_settings',
  ERROR_LOGS: 'error_logs',
  FETCH_HISTORY: 'fetch_history'
} as const;