import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';
import * as dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

/**
 * SUPABASE CLIENT FOR ACCELERATE PLATFORM
 * Connects to the Accelerate database to store qualified content
 */

// Get environment variables with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder-key';

// Check if properly configured
export const isSupabaseConfigured = 
  !supabaseUrl.includes('placeholder') && 
  !supabaseKey.includes('placeholder');

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase not configured. Database features disabled.');
  console.warn('   To enable: Set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  console.warn('   Get from: https://app.supabase.com/project/_/settings/api');
}

// Create Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false, // Server-side, no need for session persistence
  },
  global: {
    headers: {
      'x-application': 'accelerate-content-automation',
    },
  },
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] Skipping connection test - not configured');
    return false;
  }
  
  try {
    const { error } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('[Supabase] Connection test failed:', error);
      return false;
    }
    
    console.log('[Supabase] Connection successful');
    return true;
  } catch (error) {
    console.error('[Supabase] Connection test error:', error);
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  projects: number;
  funding_programs: number;
  resources: number;
  total: number;
}> {
  const [projects, funding, resources] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }),
    supabase.from('funding_programs').select('id', { count: 'exact', head: true }),
    supabase.from('resources').select('id', { count: 'exact', head: true }),
  ]);

  return {
    projects: projects.count || 0,
    funding_programs: funding.count || 0,
    resources: resources.count || 0,
    total: (projects.count || 0) + (funding.count || 0) + (resources.count || 0),
  };
}