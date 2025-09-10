import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

/**
 * SUPABASE CLIENT FOR ACCELERATE PLATFORM
 * Connects to the Accelerate database to store qualified content
 */

// Get environment variables with fallbacks
// In browser, use import.meta.env for Vite
// In Node.js, use process.env
const supabaseUrl = typeof window !== 'undefined' 
  ? (import.meta as any).env?.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co'
  : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';

const supabaseKey = typeof window !== 'undefined'
  ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
  : process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

// Check if properly configured
export const isSupabaseConfigured = 
  !supabaseUrl.includes('placeholder') && 
  !supabaseKey.includes('placeholder');

if (!isSupabaseConfigured) {

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

    return false;
  }
  
  try {
    const { error } = await supabase
      .from('projects')
      .select('id')
      .limit(1);
    
    if (error) {

      return false;
    }

    return true;
  } catch (error) {

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