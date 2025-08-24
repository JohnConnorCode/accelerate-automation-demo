import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials - use import.meta.env for Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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