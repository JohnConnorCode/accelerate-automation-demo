import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

/**
 * SUPABASE CLIENT FOR ACCELERATE PLATFORM
 * Connects to the Accelerate database to store qualified content
 */

// Load dotenv if we're in Node.js
if (typeof window === 'undefined' && typeof process !== 'undefined') {
  try {
    // Load .env.local first (takes precedence), then .env as fallback
    require('dotenv').config({ path: '.env.local' });
    require('dotenv').config(); // Load .env as fallback for any missing values
  } catch (e) {
    // dotenv might not be available in some environments
  }
}

// Get environment variables with fallbacks
// In browser, use import.meta.env for Vite
// In Node.js, use process.env
const supabaseUrl = typeof window !== 'undefined' 
  ? (import.meta as any).env?.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co'
  : process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';

// In browser: use VITE_SUPABASE_ANON_KEY
// In Node.js: prefer SERVICE_KEY for write operations, fallback to ANON_KEY
const supabaseKey = typeof window !== 'undefined'
  ? (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
  : (() => {
      // Check if SERVICE_KEY is valid (should start with 'eyJ' like JWT tokens)
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey && serviceKey.startsWith('eyJ')) {
        console.log('✅ Using Supabase service key for full access');
        return serviceKey;
      }
      
      // Fallback to anon key
      const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        console.log('⚠️ Using Supabase anon key (limited write access)');
        return anonKey;
      }
      
      // No key found - return empty string
      console.log('⚠️ Using default Supabase anon key - configure .env for production!');
      return '';
    })();

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
    // DISABLED: Table 'funding_programs' doesn't exist

    supabase.from('funding_programs').select('id', { count: 'exact', head: true }),
    // DISABLED: Table 'resources' doesn't exist

    supabase.from('resources').select('id', { count: 'exact', head: true }),
  ]) as any || { data: [], error: null } as any || { data: [], error: null };

  return {
    projects: projects.count || 0,
    funding_programs: funding.count || 0,
    resources: resources.count || 0,
    total: (projects.count || 0) + (funding.count || 0) + (resources.count || 0),
  };
}