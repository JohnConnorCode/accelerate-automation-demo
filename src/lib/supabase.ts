import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials - handle both Node.js and browser environments
const supabaseUrl = typeof window !== 'undefined' 
  ? ((import.meta as any).env?.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co')
  : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co')

const supabaseAnonKey = typeof window !== 'undefined'
  ? ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '')
  : (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')

// Log warning if no key is provided
if (!supabaseAnonKey) {
  console.warn('⚠️ Using default Supabase anon key - configure .env for production!');
  // Use a placeholder key to avoid breaking the app in development
  const defaultKey = 'placeholder-key-configure-env';
  // Only create client if we have a real key
  if (supabaseAnonKey !== defaultKey) {
    console.error('❌ Missing SUPABASE_ANON_KEY - Supabase client will not work');
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder')

// Content automation specific tables
export const TABLES = {
  CONTENT_QUEUE: 'content_queue',
  CONTENT_CATEGORIES: 'content_categories',
  ENRICHMENT_LOGS: 'enrichment_logs',
  AUTOMATION_SETTINGS: 'automation_settings',
  PROJECTS: 'projects',
  FUNDING_OPPORTUNITIES: 'funding_opportunities',
  RESOURCES: 'resources'
}