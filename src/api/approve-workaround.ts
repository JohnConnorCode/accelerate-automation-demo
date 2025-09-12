/**
 * Approval API with workaround - Uses content_queue for everything
 * This version works without the accelerate_startups table
 */

import { supabase } from '../lib/supabase-client';

export interface ApprovalRequest {
  itemId: string;
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

export class ApprovalServiceWorkaround {
  /**
   * Process approval/rejection for a queued item
   * WORKAROUND: Keep approved items in content_queue with approved status
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    try {
      // 1. Get the item from queue
      const { data: queueItem, error: fetchError } = await supabase
        .from('content_queue')
        .select('*')
        .eq('id', request.itemId)
        .single();

      if (fetchError || !queueItem) {
        return {
          success: false,
          message: 'Item not found',
          error: fetchError?.message
        };
      }

      // 2. Handle rejection
      if (request.action === 'reject') {
        const { error: rejectError } = await supabase
          .from('content_queue')
          .update({
            status: 'rejected',
            reviewer_notes: request.reviewerNotes,
            reviewed_by: request.reviewedBy || 'admin',
            reviewed_at: new Date().toISOString(),
            rejection_reason: request.reviewerNotes
          } as any)
          .eq('id', request.itemId);

        if (rejectError) {
          return {
            success: false,
            message: 'Failed to reject item',
            error: rejectError.message
          };
        }

        return {
          success: true,
          message: 'Item rejected successfully'
        };
      }

      // 3. Handle approval - WORKAROUND: Keep in queue with approved status
      const approvalData = {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: request.reviewedBy || 'system',
        reviewed_at: new Date().toISOString(),
        reviewed_by: request.reviewedBy || 'system',
        // Add approval metadata
        metadata: {
          ...(queueItem as any).metadata,
          approval: {
            timestamp: new Date().toISOString(),
            approver: request.reviewedBy || 'system',
            notes: request.reviewerNotes
          }
        }
      };

      const { data: updatedItems, error: updateError } = await supabase
        .from('content_queue')
        .update(approvalData as any)
        .eq('id', request.itemId)
        .select();
      
      const updatedItem = updatedItems?.[0];

      if (updateError) {
        return {
          success: false,
          message: 'Failed to approve item',
          error: updateError.message
        };
      }

      // Try to move to production tables if they exist
      const targetTable = this.getTargetTable(queueItem.type);
      if (targetTable !== 'content_queue') {
        const productionData = this.transformForProduction(queueItem, targetTable);
        
        // Attempt insertion but don't fail if table doesn't exist
        const { error: insertError } = await supabase
          .from(targetTable)
          .insert(productionData)
          .select()
          .single();

        if (!insertError) {
          console.log(`✅ Also copied to ${targetTable} table`);
        } else if (insertError.code !== '42P01') {
          // Log non-table-missing errors
          console.log(`⚠️ Could not copy to ${targetTable}:`, insertError.message);
        }
      }

      return {
        success: true,
        message: `Item approved successfully (kept in queue with approved status)`,
        data: updatedItem
      };

    } catch (error: any) {
      return {
        success: false,
        message: 'Approval process failed',
        error: error.message
      };
    }
  }

  /**
   * Get the target production table based on content type
   */
  private getTargetTable(type: string): string {
    const tables: Record<string, string> = {
      'project': 'projects',  // Use projects if accelerate_startups doesn't exist
      'projects': 'projects',
      'startup': 'projects',
      'funding': 'funding_programs',
      'grant': 'funding_programs',
      'resource': 'resources',
      'tool': 'resources',
      'guide': 'resources'
    };

    return tables[type?.toLowerCase()] || 'content_queue';
  }

  /**
   * Transform queue item for production table
   */
  private transformForProduction(queueItem: any, targetTable: string): any {
    const base = {
      approved_at: new Date().toISOString(),
      approved_by: queueItem.reviewed_by || 'system',
      score: queueItem.score || 0,
      metadata: queueItem.metadata || {}
    };

    switch (targetTable) {
      case 'projects':
        return {
          ...base,
          name: queueItem.title,
          description: queueItem.description,
          url: queueItem.url,
          source: queueItem.source,
          categories: queueItem.metadata?.categories || [],
          technologies: queueItem.metadata?.technologies || []
        };

      case 'funding_programs':
        return {
          ...base,
          name: queueItem.title,
          organization: queueItem.metadata?.organization || queueItem.source,
          description: queueItem.description,
          url: queueItem.url,
          funding_type: queueItem.metadata?.program_type || 'grant',
          min_amount: queueItem.metadata?.funding_amount_min || 0,
          max_amount: queueItem.metadata?.funding_amount_max || 0,
          currency: queueItem.metadata?.currency || 'USD',
          deadline: queueItem.metadata?.deadline,
          eligibility_criteria: queueItem.metadata?.eligibility_criteria || [],
          focus_areas: queueItem.metadata?.focus_areas || [],
          application_url: queueItem.metadata?.application_url || queueItem.url,
          contact_info: queueItem.metadata?.contact || {}
        };

      case 'resources':
        return {
          ...base,
          title: queueItem.title,
          description: queueItem.description,
          url: queueItem.url,
          resource_type: queueItem.metadata?.resource_type || 'tool',
          category: queueItem.category || queueItem.metadata?.category,
          tags: queueItem.metadata?.tags || [],
          price_type: queueItem.metadata?.price_type || 'free',
          price_details: queueItem.metadata?.price_details || {},
          provider_name: queueItem.metadata?.provider_name || queueItem.source,
          provider_url: queueItem.metadata?.provider_url,
          features: queueItem.metadata?.features || [],
          requirements: queueItem.metadata?.requirements || []
        };

      default:
        return {
          ...base,
          name: queueItem.title,
          description: queueItem.description,
          url: queueItem.url
        };
    }
  }

  /**
   * Bulk approve multiple items
   */
  async bulkApprove(itemIds: string[], reviewedBy?: string): Promise<ApprovalResponse> {
    const results = await Promise.all(
      itemIds.map(itemId =>
        this.processApproval({
          itemId,
          action: 'approve',
          reviewedBy
        })
      )
    );

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      success: failed === 0,
      message: `Approved ${successful} items, ${failed} failed`,
      data: { successful, failed, results }
    };
  }

  /**
   * Auto-approve high-scoring items
   */
  async autoApprove(minScore: number = 70): Promise<ApprovalResponse> {
    try {
      // Get high-scoring pending items
      const { data: items, error: fetchError } = await supabase
        .from('content_queue')
        .select('id')
        .eq('status', 'pending_review')
        .gte('score', minScore)
        .limit(10);

      if (fetchError || !items || items.length === 0) {
        return {
          success: false,
          message: 'No items to auto-approve',
          error: fetchError?.message
        };
      }

      const itemIds = items.map(item => item.id);
      return await this.bulkApprove(itemIds, 'auto-approver');

    } catch (error: any) {
      return {
        success: false,
        message: 'Auto-approval failed',
        error: error.message
      };
    }
  }

  /**
   * Get approved items (from content_queue with approved status)
   */
  async getApprovedItems(limit: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('content_queue')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching approved items:', error);
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const approvalServiceWorkaround = new ApprovalServiceWorkaround();