import { createClient } from '@supabase/supabase-js'

// Using the same Supabase instance as the main Accelerate app
const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'

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