/**
 * Approval API V2 - Works with separate staging tables
 * Moves content from staging (queued_*) to production tables
 */

import { supabase } from '../lib/supabase-client';

export interface ApprovalRequest {
  itemId: string;
  contentType: 'project' | 'funding' | 'resource';
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

export class ApprovalServiceV2 {
  /**
   * Process approval/rejection for a staged item
   */
  async processApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    try {
      // Determine source and target tables
      const stagingTable = this.getStagingTable(request.contentType);
      const productionTable = this.getProductionTable(request.contentType);

      // 1. Get the item from staging
      const { data: stagedItem, error: fetchError } = await supabase
        .from(stagingTable)
        .select('*')
        .eq('id', request.itemId)
        .single();

      if (fetchError || !stagedItem) {
        return {
          success: false,
          message: 'Item not found in staging',
          error: fetchError?.message
        };
      }

      // 2. Handle rejection
      if (request.action === 'reject') {
        const { error: rejectError } = await supabase
          .from(stagingTable)
          .update({
            status: 'rejected',
            reviewer_notes: request.reviewerNotes,
            reviewed_by: request.reviewedBy || 'admin',
            reviewed_at: new Date().toISOString(),
            rejection_reason: request.reviewerNotes
          })
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
          message: `${request.contentType} rejected successfully`
        };
      }

      // 3. Handle approval - transform and move to production
      const productionData = this.transformForProduction(stagedItem, request.contentType);

      // 4. Insert into production table
      const { data: insertedItem, error: insertError } = await supabase
        .from(productionTable)
        .insert(productionData)
        .select()
        .single();

      if (insertError) {
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          // Update existing item instead
          const { data: updatedItem, error: updateError } = await supabase
            .from(productionTable)
            .update(productionData)
            .eq('url', productionData.url)
            .select()
            .single();

          if (updateError) {
            return {
              success: false,
              message: 'Failed to update existing item',
              error: updateError.message
            };
          }

          // Mark as approved in staging
          await this.markAsApproved(stagingTable, request.itemId, request.reviewedBy);

          return {
            success: true,
            message: `${request.contentType} updated in production`,
            data: updatedItem
          };
        }

        return {
          success: false,
          message: 'Failed to move to production',
          error: insertError.message
        };
      }

      // 5. Mark as approved in staging
      await this.markAsApproved(stagingTable, request.itemId, request.reviewedBy);

      return {
        success: true,
        message: `${request.contentType} approved and moved to ${productionTable}`,
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
   * Get staging table name
   */
  private getStagingTable(type: string): string {
    const tables: Record<string, string> = {
      'project': 'queue_projects',
      'funding': 'queue_funding_programs',
      'resource': 'queue_resources'
    };
    return tables[type] || 'queue_resources';
  }

  /**
   * Get production table name
   */
  private getProductionTable(type: string): string {
    const tables: Record<string, string> = {
      'project': 'projects',
      'funding': 'funding_programs',
      'resource': 'resources'
    };
    return tables[type] || 'resources';
  }

  /**
   * Transform staging data for production table
   */
  private transformForProduction(stagedItem: any, contentType: string): any {
    const base = {
      approved_at: new Date().toISOString(),
      approved_by: stagedItem.reviewed_by || 'system',
      score: stagedItem.score || 0,
      metadata: stagedItem.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    switch (contentType) {
      case 'project':
        return {
          ...base,
          name: stagedItem.name,
          description: stagedItem.description,
          short_description: stagedItem.short_description,
          url: stagedItem.url,
          launch_date: stagedItem.launch_date,
          funding_raised: stagedItem.funding_raised,
          funding_round: stagedItem.funding_round,
          team_size: stagedItem.team_size,
          website_url: stagedItem.website_url,
          github_url: stagedItem.github_url,
          twitter_url: stagedItem.twitter_url,
          discord_url: stagedItem.discord_url,
          categories: stagedItem.categories,
          supported_chains: stagedItem.supported_chains,
          project_needs: stagedItem.project_needs,
          grant_participation: stagedItem.grant_participation,
          incubator_participation: stagedItem.incubator_participation,
          traction_metrics: stagedItem.traction_metrics,
          last_activity: stagedItem.last_activity,
          development_status: stagedItem.development_status,
          problem_solving: stagedItem.problem_solving,
          unique_value_prop: stagedItem.unique_value_prop,
          target_market: stagedItem.target_market,
          roadmap_highlights: stagedItem.roadmap_highlights,
          ai_summary: stagedItem.ai_summary
        };

      case 'funding':
        return {
          ...base,
          name: stagedItem.name,
          organization: stagedItem.organization,
          description: stagedItem.description,
          url: stagedItem.url,
          funding_type: stagedItem.funding_type,
          min_amount: stagedItem.min_amount,
          max_amount: stagedItem.max_amount,
          currency: stagedItem.currency,
          equity_required: stagedItem.equity_required,
          equity_percentage: stagedItem.equity_percentage,
          application_url: stagedItem.application_url,
          application_deadline: stagedItem.application_deadline,
          application_process: stagedItem.application_process,
          decision_timeline: stagedItem.decision_timeline,
          eligibility_criteria: stagedItem.eligibility_criteria,
          geographic_restrictions: stagedItem.geographic_restrictions,
          stage_preferences: stagedItem.stage_preferences,
          sector_focus: stagedItem.sector_focus,
          program_duration: stagedItem.program_duration,
          program_location: stagedItem.program_location,
          cohort_size: stagedItem.cohort_size,
          benefits: stagedItem.benefits,
          mentor_profiles: stagedItem.mentor_profiles,
          alumni_companies: stagedItem.alumni_companies,
          last_investment_date: stagedItem.last_investment_date,
          recent_portfolio: stagedItem.recent_portfolio,
          total_deployed_2025: stagedItem.total_deployed_2025,
          ai_summary: stagedItem.ai_summary
        };

      case 'resource':
        return {
          ...base,
          title: stagedItem.title,
          description: stagedItem.description,
          url: stagedItem.url,
          resource_type: stagedItem.resource_type,
          category: stagedItem.category,
          price_type: stagedItem.price_type,
          price_amount: stagedItem.price_amount,
          trial_available: stagedItem.trial_available,
          provider_name: stagedItem.provider_name,
          provider_credibility: stagedItem.provider_credibility,
          last_updated: stagedItem.last_updated,
          difficulty_level: stagedItem.difficulty_level,
          time_commitment: stagedItem.time_commitment,
          prerequisites: stagedItem.prerequisites,
          key_benefits: stagedItem.key_benefits,
          use_cases: stagedItem.use_cases,
          success_stories: stagedItem.success_stories,
          ai_summary: stagedItem.ai_summary
        };

      default:
        return { ...base, ...stagedItem };
    }
  }

  /**
   * Mark item as approved in staging
   */
  private async markAsApproved(table: string, itemId: string, reviewedBy?: string): Promise<void> {
    await supabase
      .from(table)
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewedBy || 'system'
      })
      .eq('id', itemId);
  }

  /**
   * Bulk approve multiple items
   */
  async bulkApprove(
    items: Array<{ id: string; type: 'project' | 'funding' | 'resource' }>,
    reviewedBy?: string
  ): Promise<ApprovalResponse> {
    const results = await Promise.all(
      items.map(item =>
        this.processApproval({
          itemId: item.id,
          contentType: item.type,
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
   * Get all pending items from staging tables
   */
  async getPendingItems(): Promise<{
    projects: any[];
    funding: any[];
    resources: any[];
    total: number;
  }> {
    // Fetch from all three staging tables
    const [projects, funding, resources] = await Promise.all([
      supabase
        .from('queue_projects')
        .select('*')
        .eq('status', 'pending_review')
        .order('score', { ascending: false })
        .limit(50),
      
      supabase
        .from('queue_funding_programs')
        .select('*')
        .eq('status', 'pending_review')
        .order('score', { ascending: false })
        .limit(50),
      
      supabase
        .from('queue_resources')
        .select('*')
        .eq('status', 'pending_review')
        .order('score', { ascending: false })
        .limit(50)
    ]);

    const projectItems = projects.data || [];
    const fundingItems = funding.data || [];
    const resourceItems = resources.data || [];

    return {
      projects: projectItems,
      funding: fundingItems,
      resources: resourceItems,
      total: projectItems.length + fundingItems.length + resourceItems.length
    };
  }

  /**
   * Auto-approve high-scoring items from all staging tables
   */
  async autoApprove(minScore: number = 70): Promise<ApprovalResponse> {
    try {
      const pending = await this.getPendingItems();
      
      // Filter high-scoring items
      const toApprove: Array<{ id: string; type: 'project' | 'funding' | 'resource' }> = [];
      
      pending.projects
        .filter(p => p.score >= minScore)
        .forEach(p => toApprove.push({ id: p.id, type: 'project' }));
      
      pending.funding
        .filter(f => f.score >= minScore)
        .forEach(f => toApprove.push({ id: f.id, type: 'funding' }));
      
      pending.resources
        .filter(r => r.score >= minScore)
        .forEach(r => toApprove.push({ id: r.id, type: 'resource' }));

      if (toApprove.length === 0) {
        return {
          success: false,
          message: 'No items to auto-approve',
        };
      }

      return await this.bulkApprove(toApprove, 'auto-approver');

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
export const approvalServiceV2 = new ApprovalServiceV2();