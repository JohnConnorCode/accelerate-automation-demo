// Frontend-safe version of contentServiceV2
// This version doesn't use any Node.js specific features or process.env

import { supabase } from '../lib/supabase'

export type ContentCategory = 'projects' | 'funding' | 'resources' | 'builders';

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  category: ContentCategory;
  source_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'published';
  score?: number;
  enriched_data?: any;
  created_at: string;
  updated_at: string;
}

class ContentServiceV2Frontend {
  async getQueueItems(category?: ContentCategory) {
    try {
      let query = supabase
        .from('content_queue')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching queue items:', error);
      return [];
    }
  }

  async updateItemStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from('content_queue')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating item status:', error);
      return false;
    }
  }

  async deleteItem(id: string) {
    try {
      const { error } = await supabase
        .from('content_queue')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }

  async getStats() {
    try {
      const { data, error } = await supabase
        .from('content_queue')
        .select('status, category, score')
      
      if (error) throw error;
      
      const scores = data?.map(item => item.score || 0) || [];
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(item => item.status === 'pending').length || 0,
        approved: data?.filter(item => item.status === 'approved').length || 0,
        rejected: data?.filter(item => item.status === 'rejected').length || 0,
        published: data?.filter(item => item.status === 'published').length || 0,
        avgScore: Math.round(avgScore),
        scoreDistribution: {
          high: data?.filter(item => (item.score || 0) >= 80).length || 0,
          medium: data?.filter(item => (item.score || 0) >= 50 && (item.score || 0) < 80).length || 0,
          low: data?.filter(item => (item.score || 0) < 50).length || 0,
        },
        byCategory: {
          projects: data?.filter(item => item.category === 'projects').length || 0,
          funding: data?.filter(item => item.category === 'funding').length || 0,
          resources: data?.filter(item => item.category === 'resources').length || 0,
          builders: data?.filter(item => item.category === 'builders').length || 0,
        }
      };
      
      return stats;
    } catch (error) {
      console.error('Error fetching stats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        published: 0,
        avgScore: 0,
        scoreDistribution: {
          high: 0,
          medium: 0,
          low: 0,
        },
        byCategory: {
          projects: 0,
          funding: 0,
          resources: 0,
          builders: 0,
        }
      };
    }
  }
  
  // Alias methods for compatibility
  async getQueue() {
    return this.getQueueItems();
  }
  
  async approveContent(id: string) {
    return this.updateItemStatus(id, 'approved');
  }
  
  async rejectContent(id: string) {
    return this.updateItemStatus(id, 'rejected');
  }
  
  async validateContent(content: any) {
    // Basic validation for frontend
    if (!content || !content.title || !content.category) {
      return { valid: false, score: 0, error: 'Missing required fields' };
    }
    // Mock score for frontend
    return { valid: true, score: Math.floor(Math.random() * 40) + 60 };
  }

  // Placeholder methods for features that require backend
  async enrichContent(content: any) {
    console.warn('Content enrichment requires backend API');
    return content;
  }

  async assessWithAI(content: any) {
    console.warn('AI assessment requires backend API');
    return { score: 0, recommendation: 'Requires backend' };
  }

  async discoverContent() {
    console.warn('Content discovery requires backend API');
    return [];
  }
}

export const contentServiceV2 = new ContentServiceV2Frontend();