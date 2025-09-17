/**
 * Approval API - Moves content from queue to production tables
 */

import type { Database } from '../types/supabase';
import { supabase, ContentQueueRow } from '../lib/typed-supabase';
import type { ContentQueueItem, ProjectItem, FundingItem, ResourceItem } from '../types/database';

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

export class ApprovalService {
  /**
   * Process approval/rejection for a queued item
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    try {
      // 1. Get the item from queue
      const { data: queueItem, error: fetchError } = await supabase
        .from('content_queue')
        .select('*')
        .eq('id', request.itemId)
        .single() as { data: ContentQueueRow | null; error: any };

      if (fetchError || !queueItem) {
        return {
          success: false,
          message: 'Item not found',
          error: fetchError?.message
        };
      }

      // 2. Handle rejection
      if (request.action === 'reject') {
        const updateData: any = {
            status: 'rejected',
            reviewed_by: request.reviewedBy || 'admin',
            reviewed_at: new Date().toISOString(),
            metadata: {
                ...(typeof (queueItem.metadata || {}) === "object" && (queueItem.metadata || {}) !== null ? (queueItem.metadata || {}) : {}),
                reviewer_notes: request.reviewerNotes,
                rejection_reason: request.reviewerNotes
            }
        };
        
        const { error: rejectError } = await supabase
          .from('content_queue')
          .update(updateData as any)
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

      // 3. Handle approval - move to appropriate production table
      const targetTable = this.getTargetTable(queueItem.type);
      const productionData = this.transformForProduction(queueItem, targetTable);

      // 4. Insert into production table
      const { data: insertedItem, error: insertError } = await supabase
        .from(targetTable)
        .insert(productionData as any)
        .select()
        .single();

      if (insertError) {
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          // Update existing item instead
          const { data: updatedItem, error: updateError } = await supabase
            .from(targetTable)
            .update(productionData as any)
            .eq('url', (productionData).url)
            .select()
            .single();

          if (updateError) {
            return {
              success: false,
              message: 'Failed to update existing item',
              error: updateError.message
            };
          }

          // Mark as approved in queue
          await this.markAsApproved(request.itemId, request.reviewedBy);

          return {
            success: true,
            message: 'Item updated in production',
            data: updatedItem
          };
        }

        return {
          success: false,
          message: 'Failed to move to production',
          error: insertError?.message || JSON.stringify(insertError)
        };
      }

      // 5. Mark as approved in queue
      await this.markAsApproved(request.itemId, request.reviewedBy);

      return {
        success: true,
        message: `Item approved and moved to ${targetTable}`,
        data: insertedItem
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
      'project': 'projects',
      'projects': 'projects',
      'startup': 'projects',
      'funding': 'funding_programs',
      'grant': 'funding_programs',
      'accelerator': 'funding_programs',
      'incubator': 'funding_programs',
      'vc': 'funding_programs',
      'resource': 'resources',
      'tool': 'resources',
      'guide': 'resources',
      'course': 'resources',
      'community': 'resources',
      'infrastructure': 'resources'
    };

    return tables[type?.toLowerCase()] || 'projects';
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
          team_size: queueItem.metadata?.team_size,
          funding_raised: queueItem.metadata?.funding_raised || 0,
          funding_stage: queueItem.metadata?.funding_stage,
          categories: queueItem.metadata?.categories || [],
          technologies: queueItem.metadata?.technologies || [],
          project_needs: queueItem.metadata?.project_needs || [],
          location: queueItem.metadata?.location,
          contact_email: queueItem.metadata?.contact_email,
          social_links: queueItem.metadata?.social_links || {},
          ai_summary: queueItem.ai_summary,
          last_activity: queueItem.metadata?.last_activity || new Date().toISOString()
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
   * Mark item as approved in queue
   */
  private async markAsApproved(itemId: string, reviewedBy?: string): Promise<void> {
    await supabase
      .from('content_queue')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: reviewedBy || 'system',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy || 'system'
      } as any)
      .eq('id', itemId);
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
}

// Export singleton instance
export const approvalService = new ApprovalService();