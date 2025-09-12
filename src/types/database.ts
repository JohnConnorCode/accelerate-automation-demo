// Database type definitions for Supabase operations

export interface ContentQueueItem {
  id: string;
  title: string;
  description?: string;
  url?: string;
  source?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at?: string;
  metadata?: any;
  type?: string;
  [key: string]: any; // Allow additional properties
}

export interface ProjectItem {
  id?: string;
  name: string;
  description?: string;
  url?: string;
  team_size?: number;
  funding_raised?: number;
  launch_date?: string;
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  approved_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  metadata?: any;
  [key: string]: any;
}

export interface FundingItem {
  id?: string;
  name: string;
  description?: string;
  url?: string;
  amount?: number;
  deadline?: string;
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  approved_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  metadata?: any;
  [key: string]: any;
}

export interface ResourceItem {
  id?: string;
  title: string;
  description?: string;
  url?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  approved_at?: string;
  approved_by?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  metadata?: any;
  [key: string]: any;
}

export type DatabaseItem = ContentQueueItem | ProjectItem | FundingItem | ResourceItem;