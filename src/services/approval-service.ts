/**
 * Approval Service - Handles approval/rejection of queue items
 * Moves approved items from queue tables to production tables
 */

import { supabase } from '../lib/supabase-client';
import { logger } from './logger';

export interface ApprovalRequest {
  id: number;
  type: 'projects' | 'investors' | 'news';
  action: 'approve' | 'reject';
  reviewerNotes?: string;
  reviewedBy?: string;
}

export interface ApprovalResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class ApprovalService {
  /**
   * Process approval/rejection for a queued item
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    // Input validation
    if (!request || typeof request !== 'object') {
      return {
        success: false,
        message: 'Invalid request',
        error: 'Request must be an object'
      };
    }
    
    const { id, type, action, reviewerNotes, reviewedBy = 'admin' } = request;
    
    // Validate required fields
    if (!id || !type || !action) {
      return {
        success: false,
        message: 'Missing required fields',
        error: 'id, type, and action are required'
      };
    }
    
    // Validate type
    if (!['projects', 'investors', 'news'].includes(type)) {
      return {
        success: false,
        message: 'Invalid type',
        error: 'Type must be projects, investors, or news'
      };
    }
    
    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return {
        success: false,
        message: 'Invalid action',
        error: 'Action must be approve or reject'
      };
    }
    
    // Determine source and target tables
    const queueTable = `queue_${type}`;
    const productionTable = type === 'investors' 
      ? 'accelerate_investors'
      : type === 'news' 
      ? 'accelerate_news'
      : 'accelerate_startups';
    
    try {
      // 1. Get item from queue with error handling
      const { data: queueItem, error: fetchError } = await supabase
        .from(queueTable)
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        logger.error('Failed to fetch queue item', { error: fetchError, id, type });
        return {
          success: false,
          message: `Failed to fetch item from ${queueTable}`,
          error: fetchError.message || 'Database error'
        };
      }
      
      if (!queueItem) {
        return {
          success: false,
          message: `Item not found in ${queueTable}`,
          error: `No item with id ${id} exists in queue. It may have already been processed.`
        };
      }
      
      // 2. Handle rejection - just delete from queue
      if (action === 'reject') {
        const { error: rejectError } = await supabase
          .from(queueTable)
          .delete()
          .eq('id', id);
        
        if (rejectError) {
          return {
            success: false,
            message: 'Failed to reject item',
            error: rejectError.message
          };
        }
        
        logger.info(`Item rejected and removed from queue`, { id, type, reviewedBy });
        return {
          success: true,
          message: 'Item rejected and removed from queue'
        };
      }
      
      // 3. Handle approval - move to production and delete from queue
      const productionItem = this.transformForProduction(queueItem, type);
      
      // Insert into production table
      const { data: insertedItem, error: insertError } = await supabase
        .from(productionTable)
        .insert(productionItem as any)
        .select()
        .single();
      
      if (insertError) {
        return {
          success: false,
          message: `Failed to insert into ${productionTable}`,
          error: insertError.message
        };
      }
      
      // Delete from queue after successful production insert
      const { error: deleteError } = await supabase
        .from(queueTable)
        .delete()
        .eq('id', id);
      
      if (deleteError) {
        logger.warn('Failed to delete from queue after approval', { error: deleteError });
      }
      
      logger.info(`Item approved and moved to production`, { 
        id, 
        type, 
        productionId: insertedItem.id,
        reviewedBy 
      });
      
      return {
        success: true,
        message: `Item approved and moved to ${productionTable}`,
        data: insertedItem
      };
      
    } catch (error) {
      logger.error('Approval process failed', { error, request });
      return {
        success: false,
        message: 'Approval process failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Transform queue item for production table with validation
   */
  private transformForProduction(queueItem: any, type: string): any {
    if (!queueItem || typeof queueItem !== 'object') {
      throw new Error('Invalid queue item');
    }
    
    const now = new Date().toISOString();
    
    if (type === 'projects') {
      // Validate required fields
      if (!queueItem.company_name) {
        throw new Error('Missing required field: company_name');
      }
      
      // Transform queue_projects to accelerate_startups
      return {
        // Core fields - NOTE: accelerate_startups uses 'name' not 'company_name'
        name: queueItem.company_name,  // CRITICAL: column is 'name' not 'company_name'
        description: queueItem.description || '',
        website: queueItem.website || null,
        
        // Team & Location
        founders: queueItem.founders || [],
        team_size: queueItem.team_size,
        location: queueItem.location,
        country: queueItem.country,
        
        // Funding
        funding_amount: queueItem.funding_amount,
        funding_round: queueItem.funding_round,
        funding_investors: queueItem.funding_investors || [],
        
        // Technology
        technology_stack: queueItem.technology_stack || [],
        industry_tags: queueItem.industry_tags || [],
        
        // Metadata
        source: queueItem.source,
        source_url: queueItem.source_url,
        
        // ACCELERATE fields
        accelerate_fit: true,
        accelerate_reason: queueItem.accelerate_reason,
        accelerate_score: queueItem.accelerate_score,
        
        // Timestamps
        created_at: now,
        updated_at: now,
        approved_at: now,
        approved_by: 'admin'
        
        // Note: accelerate_startups doesn't have status, verified, or featured columns
      };
    }
    
    // Default fallback - pass through with timestamps
    return {
      ...queueItem,
      created_at: now,
      updated_at: now,
      status: 'active'
    };
  }
  
  /**
   * Get pending items for review
   */
  async getPendingItems(type?: string): Promise<{
    projects: any[];
    investors: any[];
    news: any[];
    total: number;
  }> {
    const pending = {
      projects: [] as any[],
      investors: [] as any[],
      news: [] as any[],
      total: 0
    };
    
    // Get ALL items from queue (since no status column exists)
    if (!type || type === 'projects') {
      const { data: projects } = await supabase
        .from('queue_projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      pending.projects = projects || [];
    }
    
    // Get pending investors
    if (!type || type === 'investors') {
      const { data: investors } = await supabase
        .from('queue_investors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      pending.investors = investors || [];
    }
    
    // Get pending news
    if (!type || type === 'news') {
      const { data: news } = await supabase
        .from('queue_news')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      pending.news = news || [];
    }
    
    pending.total = pending.projects.length + pending.investors.length + pending.news.length;
    
    return pending;
  }
}

// Export singleton
export const approvalService = new ApprovalService();
