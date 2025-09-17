/**
 * Supabase helper functions with proper typing
 * Use these instead of direct supabase calls to ensure type safety
 */

import { supabase } from './typed-supabase';
import { Database } from '../types/supabase';

type Tables = Database['public']['Tables'];

/**
 * Generic select helper with proper typing
 */
export async function selectFrom<T extends keyof Tables>(
  table: T,
  query?: {
    columns?: string;
    filter?: { column: string; value: any };
    single?: boolean;
  }
): Promise<{
  data: Tables[T]['Row'][] | Tables[T]['Row'] | null;
  error: any;
}> {
  let q = supabase.from(table).select(query?.columns || '*');
  
  if (query?.filter) {
    q = q.eq(query.filter.column, query.filter.value);
  }
  
  if (query?.single) {
    return q.single() as any;
  }
  
  return q as any;
}

/**
 * Generic insert helper with proper typing
 */
export async function insertInto<T extends keyof Tables>(
  table: T,
  data: Tables[T]['Insert'] | Tables[T]['Insert'][]
): Promise<{
  data: Tables[T]['Row'][] | null;
  error: any;
}> {
  return supabase.from(table).insert(data as any).select() as any;
}

/**
 * Generic update helper with proper typing
 */
export async function updateIn<T extends keyof Tables>(
  table: T,
  updates: Tables[T]['Update'],
  filter: { column: string; value: any }
): Promise<{
  data: Tables[T]['Row'][] | null;
  error: any;
}> {
  return supabase
    .from(table)
    .update(updates as any)
    .eq(filter.column, filter.value)
    .select() as any;
}

/**
 * Generic upsert helper with proper typing
 */
export async function upsertInto<T extends keyof Tables>(
  table: T,
  data: Tables[T]['Insert'] | Tables[T]['Insert'][],
  onConflict?: string
): Promise<{
  data: Tables[T]['Row'][] | null;
  error: any;
}> {
  return supabase
    .from(table)
    .upsert(data as any, { onConflict })
    .select() as any;
}

/**
 * Generic delete helper with proper typing
 */
export async function deleteFrom<T extends keyof Tables>(
  table: T,
  filter: { column: string; value: any }
): Promise<{
  data: Tables[T]['Row'][] | null;
  error: any;
}> {
  return supabase
    .from(table)
    .delete()
    .eq(filter.column, filter.value)
    .select() as any;
}

// Export specific table operations for convenience
export const tables = {
  projects: {
    select: (query?: any) => selectFrom('projects', query),
    insert: (data: Tables['projects']['Insert'] | Tables['projects']['Insert'][]) => 
      insertInto('projects', data),
    update: (updates: Tables['projects']['Update'], filter: { column: string; value: any }) =>
      updateIn('projects', updates, filter),
    upsert: (data: Tables['projects']['Insert'] | Tables['projects']['Insert'][], onConflict?: string) =>
      upsertInto('projects', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('projects', filter)
  },
  content_queue: {
    select: (query?: any) => selectFrom('content_queue', query),
    insert: (data: Tables['content_queue']['Insert'] | Tables['content_queue']['Insert'][]) => 
      insertInto('content_queue', data),
    update: (updates: Tables['content_queue']['Update'], filter: { column: string; value: any }) =>
      updateIn('content_queue', updates, filter),
    upsert: (data: Tables['content_queue']['Insert'] | Tables['content_queue']['Insert'][], onConflict?: string) =>
      upsertInto('content_queue', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('content_queue', filter)
  },
  queue_projects: {
    select: (query?: any) => selectFrom('queue_projects', query),
    insert: (data: Tables['queue_projects']['Insert'] | Tables['queue_projects']['Insert'][]) => 
      insertInto('queue_projects', data),
    update: (updates: Tables['queue_projects']['Update'], filter: { column: string; value: any }) =>
      updateIn('queue_projects', updates, filter),
    upsert: (data: Tables['queue_projects']['Insert'] | Tables['queue_projects']['Insert'][], onConflict?: string) =>
      upsertInto('queue_projects', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('queue_projects', filter)
  },
  queue_investors: {
    select: (query?: any) => selectFrom('queue_investors', query),
    insert: (data: Tables['queue_investors']['Insert'] | Tables['queue_investors']['Insert'][]) => 
      insertInto('queue_investors', data),
    update: (updates: Tables['queue_investors']['Update'], filter: { column: string; value: any }) =>
      updateIn('queue_investors', updates, filter),
    upsert: (data: Tables['queue_investors']['Insert'] | Tables['queue_investors']['Insert'][], onConflict?: string) =>
      upsertInto('queue_investors', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('queue_investors', filter)
  },
  queue_news: {
    select: (query?: any) => selectFrom('queue_news', query),
    insert: (data: Tables['queue_news']['Insert'] | Tables['queue_news']['Insert'][]) => 
      insertInto('queue_news', data),
    update: (updates: Tables['queue_news']['Update'], filter: { column: string; value: any }) =>
      updateIn('queue_news', updates, filter),
    upsert: (data: Tables['queue_news']['Insert'] | Tables['queue_news']['Insert'][], onConflict?: string) =>
      upsertInto('queue_news', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('queue_news', filter)
  },
  api_cache: {
    select: (query?: any) => selectFrom('api_cache', query),
    insert: (data: Tables['api_cache']['Insert'] | Tables['api_cache']['Insert'][]) => 
      insertInto('api_cache', data),
    update: (updates: Tables['api_cache']['Update'], filter: { column: string; value: any }) =>
      updateIn('api_cache', updates, filter),
    upsert: (data: Tables['api_cache']['Insert'] | Tables['api_cache']['Insert'][], onConflict?: string) =>
      upsertInto('api_cache', data, onConflict),
    delete: (filter: { column: string; value: any }) => deleteFrom('api_cache', filter)
  }
};