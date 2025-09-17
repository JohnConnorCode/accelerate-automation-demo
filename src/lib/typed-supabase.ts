/**
 * Fully typed Supabase client wrapper
 * Ensures all database operations have proper type safety
 */

import { supabase } from './supabase-client';
import { Database } from '../types/supabase';

// Export the typed client
export const typedSupabase = supabase;

// Type helpers for common operations
export type Tables = Database['public']['Tables'];
export type TableName = keyof Tables;

// Row types for each table
export type ProjectRow = Tables['projects']['Row'];
export type FundingProgramRow = Tables['funding_programs']['Row'];
export type ResourceRow = Tables['resources']['Row'];
export type ContentQueueRow = Tables['content_queue']['Row'];
export type QueueProjectRow = Tables['queue_projects']['Row'];
export type QueueInvestorRow = Tables['queue_investors']['Row'];
export type QueueNewsRow = Tables['queue_news']['Row'];
export type ApiCacheRow = Tables['api_cache']['Row'];
export type ApiKeyRow = Tables['api_keys']['Row'];

// Insert types for each table
export type ProjectInsert = Tables['projects']['Insert'];
export type FundingProgramInsert = Tables['funding_programs']['Insert'];
export type ResourceInsert = Tables['resources']['Insert'];
export type ContentQueueInsert = Tables['content_queue']['Insert'];
export type QueueProjectInsert = Tables['queue_projects']['Insert'];
export type QueueInvestorInsert = Tables['queue_investors']['Insert'];
export type QueueNewsInsert = Tables['queue_news']['Insert'];

// Update types for each table
export type ProjectUpdate = Tables['projects']['Update'];
export type FundingProgramUpdate = Tables['funding_programs']['Update'];
export type ResourceUpdate = Tables['resources']['Update'];
export type ContentQueueUpdate = Tables['content_queue']['Update'];
export type QueueProjectUpdate = Tables['queue_projects']['Update'];
export type QueueInvestorUpdate = Tables['queue_investors']['Update'];
export type QueueNewsUpdate = Tables['queue_news']['Update'];

// Helper function to ensure type safety
export function getTypedTable<T extends TableName>(tableName: T) {
  return typedSupabase.from(tableName);
}

// Re-export the original supabase for backward compatibility
export { typedSupabase as supabase };