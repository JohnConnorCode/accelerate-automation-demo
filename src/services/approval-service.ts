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
    const { id, type, action, reviewerNotes, reviewedBy = 'admin' } = request;
    
    // Determine source and target tables
    const queueTable = `queue_${type}`;
    const productionTable = type === 'investors' 
      ? 'accelerate_investors'
      : type === 'news' 
      ? 'accelerate_news'
      : 'accelerate_startups';
    
    try {
      // 1. Get item from queue
      const { data: queueItem, error: fetchError } = await supabase
        .from(queueTable)
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError || !queueItem) {
        return {
          success: false,
          message: `Item not found in ${queueTable}`,
          error: fetchError?.message
        };
      }
      
      // 2. Handle rejection
      if (action === 'reject') {
        const { error: rejectError } = await supabase
          .from(queueTable)
          .update({
            status: 'rejected',
            reviewer_notes: reviewerNotes,
            reviewed_by: reviewedBy,
            reviewed_at: new Date().toISOString()
          })
          .eq('id', id);
        
        if (rejectError) {
          return {
            success: false,
            message: 'Failed to reject item',
            error: rejectError.message
          };
        }
        
        logger.info(`Item rejected`, { id, type, reviewedBy });
        return {
          success: true,
          message: 'Item rejected successfully'
        };
      }
      
      // 3. Handle approval - keep in queue with approved status for now
      const { error: updateError } = await supabase
        .from(queueTable)
        .update({
          status: 'approved',
          reviewer_notes: reviewerNotes,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (updateError) {
        return {
          success: false,
          message: 'Failed to approve item',
          error: updateError.message
        };
      }
      
      logger.info(`Item approved`, { id, type, reviewedBy });
      
      return {
        success: true,
        message: `Item approved successfully`,
        data: { id, type }
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
    
    // Get pending projects
    if (!type || type === 'projects') {
      const { data: projects } = await supabase
        .from('queue_projects')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(10);
      
      pending.projects = projects || [];
    }
    
    // Get pending investors
    if (!type || type === 'investors') {
      const { data: investors } = await supabase
        .from('queue_investors')
        .select('*')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(10);
      
      pending.investors = investors || [];
    }
    
    // Get pending news
    if (!type || type === 'news') {
      const { data: news } = await supabase
        .from('queue_news')
        .select('*')
        .eq('status', 'pending_review')
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
