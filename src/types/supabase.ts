/**
 * SUPABASE DATABASE TYPES FOR ACCELERATE PLATFORM
 * These types match the Accelerate database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          description: string
          short_description: string
          website_url: string
          github_url: string | null
          twitter_url: string | null
          discord_url: string | null
          launch_date: string
          funding_raised: number
          funding_round: string | null
          team_size: number
          categories: string[]
          supported_chains: string[]
          project_status: string
          seeking_funding: boolean
          seeking_cofounders: boolean
          seeking_developers: boolean
          accelerate_score: number | null
          source: string | null
          source_url: string | null
          last_activity: string
          problem_statement: string | null
          value_proposition: string | null
          target_market: string | null
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      funding_programs: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          organization: string
          description: string
          funding_type: string
          min_amount: number
          max_amount: number
          currency: string
          equity_required: boolean
          equity_percentage: number
          application_url: string
          application_deadline: string | null
          application_process: string | null
          decision_timeline: string | null
          eligibility_criteria: string[]
          geographic_restrictions: string[]
          stage_preferences: string[]
          sector_focus: string[]
          program_duration: string | null
          program_location: string | null
          cohort_size: number | null
          benefits: string[]
          mentor_profiles: string[]
          last_investment_date: string | null
          total_deployed_2025: number
          is_active: boolean
          accelerate_score: number | null
          source: string | null
          source_url: string | null
        }
        Insert: Omit<Database['public']['Tables']['funding_programs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['funding_programs']['Insert']>
      }
      resources: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string
          url: string
          resource_type: string
          category: string
          price_type: string
          price_amount: number
          trial_available: boolean
          provider_name: string
          provider_credibility: string | null
          last_updated: string
          difficulty_level: string
          time_commitment: string | null
          prerequisites: string[]
          key_benefits: string[]
          use_cases: string[]
          accelerate_score: number | null
          source: string | null
          tags: string[]
        }
        Insert: Omit<Database['public']['Tables']['resources']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['resources']['Insert']>
      }
      content_sources: {
        Row: {
          id: string
          created_at: string
          url: string
          source: string
          type: string
          table_name: string
          record_identifier: string
          accelerate_score: number | null
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_sources']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['content_sources']['Insert']>
      }
      content_metrics: {
        Row: {
          id: string
          timestamp: string
          total_processed: number
          total_inserted: number
          total_updated: number
          total_rejected: number
          average_score: number
          qualified_count: number
          by_type: Json
          errors: string[]
        }
        Insert: Omit<Database['public']['Tables']['content_metrics']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['content_metrics']['Insert']>
      }
      content_curated: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string
          url: string
          source: string
          type: string
          score: number
          confidence: number
          factors: Json
          recommendation: string
          content_hash: string | null
          raw_data: Json
          metadata: Json
          tags: string[]
        }
        Insert: Omit<Database['public']['Tables']['content_curated']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['content_curated']['Insert']>
      }
      content_raw: {
        Row: {
          id: string
          created_at: string
          source: string
          data: Json
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['content_raw']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['content_raw']['Insert']>
      }
      api_cache: {
        Row: {
          id: string
          created_at: string
          cache_key: string
          cache_value: Json
          expires_at: string
        }
        Insert: Omit<Database['public']['Tables']['api_cache']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['api_cache']['Insert']>
      }
      api_keys: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          service: string
          key_name: string
          encrypted_key: string
          is_active: boolean
          last_used: string | null
          usage_count: number
        }
        Insert: Omit<Database['public']['Tables']['api_keys']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['api_keys']['Insert']>
      }
      content_queue: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string
          url: string
          source: string
          type: string
          status: string
          score: number
          quality_score: number | null
          raw_data: Json
          metadata: Json
          tags: string[]
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['content_queue']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['content_queue']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          role: string
          preferences: Json
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      search_analytics: {
        Row: {
          id: string
          created_at: string
          query: string
          results_count: number
          response_time: number
          timestamp: string
        }
        Insert: Omit<Database['public']['Tables']['search_analytics']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['search_analytics']['Insert']>
      }
      social_metrics: {
        Row: {
          id: string
          created_at: string
          content_url: string
          content_type: string
          metrics: Json
          social_score: number
          credibility_score: number
          enriched_at: string
        }
        Insert: Omit<Database['public']['Tables']['social_metrics']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['social_metrics']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          created_at: string
          type: string
          title: string
          message: string
          metadata: Json
          read: boolean
          user_id: string | null
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      test: {
        Row: {
          id: string
          created_at: string
          [key: string]: any
        }
        Insert: any
        Update: any
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}