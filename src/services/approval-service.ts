/**
 * APPROVAL SERVICE
 * Handles the approval workflow from content_queue to live tables
 * Ensures quality control and prevents garbage from reaching production
 */

import { createClient } from '@supabase/supabase-js';
import { QualityScorer } from './quality-scorer';
import { EnrichmentOrchestrator } from './enrichment-orchestrator';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

export interface ApprovalResult {
  success: boolean;
  itemId: string;
  action: 'approved' | 'rejected' | 'enriched';
  targetTable?: string;
  error?: string;
}

export interface ReviewItem {
  id: string;
  type: string;
  title: string;
  description: string;
  url: string;
  source: string;
  status: string;
  quality_score: number;
  metadata: any;
  created_at: string;
  enriched: boolean;
}

export class ApprovalService {
  private enrichmentOrchestrator: EnrichmentOrchestrator;

  constructor() {
    this.enrichmentOrchestrator = new EnrichmentOrchestrator();
  }

  /**
   * Get items pending review with quality scores
   */
  async getReviewQueue(
    filters?: {
      type?: string;
      source?: string;
      minScore?: number;
      status?: string;
    }
  ): Promise<ReviewItem[]> {
    let query = supabase
      .from('content_queue')
      .select('*')
      .in('status', ['pending_review', 'ready_for_review'])
      .order('quality_score', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.source) {
      query = query.eq('source', filters.source);
    }
    if (filters?.minScore) {
      query = query.gte('quality_score', filters.minScore);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching review queue:', error);
      return [];
    }

    // Calculate quality scores for items without them
    const itemsNeedingScores = data?.filter(item => !item.quality_score) || [];
    for (const item of itemsNeedingScores) {
      const score = await QualityScorer.scoreContent(item);
      await this.updateQualityScore(item.id, score.total);
      item.quality_score = score.total;
    }

    return data || [];
  }

  /**
   * Approve content and move to live table
   */
  async approveContent(
    itemId: string,
    reviewerId?: string,
    notes?: string
  ): Promise<ApprovalResult> {
    try {
      // 1. Get the item
      const { data: item, error: fetchError } = await supabase
        .from('content_queue')
        .select('*')
        .eq('id', itemId)
        .single();

      if (fetchError || !item) {
        return {
          success: false,
          itemId,
          action: 'approved',
          error: 'Item not found'
        };
      }

      // 2. Validate quality
      const qualityScore = await QualityScorer.scoreContent(item);
      if (qualityScore.flags.red.length > 3) {
        return {
          success: false,
          itemId,
          action: 'approved',
          error: `Quality issues: ${qualityScore.flags.red.join(', ')}`
        };
      }

      // 3. Check for duplicates in target table
      const targetTable = this.getTargetTable(item.type);
      const isDuplicate = await this.checkDuplicate(item, targetTable);
      
      if (isDuplicate) {
        await this.markAsDuplicate(itemId);
        return {
          success: false,
          itemId,
          action: 'rejected',
          error: 'Duplicate content already exists'
        };
      }

      // 4. Transform and insert into live table
      const transformedData = this.transformForLiveTable(item, targetTable);
      
      const { error: insertError } = await supabase
        .from(targetTable)
        .insert(transformedData);

      if (insertError) {
        console.error(`Failed to insert into ${targetTable}:`, insertError);
        return {
          success: false,
          itemId,
          action: 'approved',
          error: `Failed to insert: ${insertError.message}`
        };
      }

      // 5. Update content_queue status
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({
          status: 'approved',
          reviewed_by: reviewerId,
          reviewed_at: new Date(),
          approval_notes: notes
        })
        .eq('id', itemId);

      if (updateError) {
        console.error('Failed to update status:', updateError);
      }

      // 6. Create audit trail
      await this.createAuditRecord(itemId, 'approved', reviewerId, {
        notes,
        target_table: targetTable,
        quality_score: qualityScore.total
      });

      return {
        success: true,
        itemId,
        action: 'approved',
        targetTable
      };

    } catch (error) {
      console.error('Approval error:', error);
      return {
        success: false,
        itemId,
        action: 'approved',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Reject content with reason
   */
  async rejectContent(
    itemId: string,
    reason: string,
    reviewerId?: string
  ): Promise<ApprovalResult> {
    try {
      const { error } = await supabase
        .from('content_queue')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_by: reviewerId,
          reviewed_at: new Date()
        })
        .eq('id', itemId);

      if (error) {
        return {
          success: false,
          itemId,
          action: 'rejected',
          error: error.message
        };
      }

      await this.createAuditRecord(itemId, 'rejected', reviewerId, { reason });

      return {
        success: true,
        itemId,
        action: 'rejected'
      };
    } catch (error) {
      return {
        success: false,
        itemId,
        action: 'rejected',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send item for enrichment
   */
  async enrichContent(itemId: string): Promise<ApprovalResult> {
    try {
      // Update status to enriching
      await supabase
        .from('content_queue')
        .update({ status: 'enriching' })
        .eq('id', itemId);

      // Get the item
      const { data: item } = await supabase
        .from('content_queue')
        .select('*')
        .eq('id', itemId)
        .single();

      if (!item) {
        return {
          success: false,
          itemId,
          action: 'enriched',
          error: 'Item not found'
        };
      }

      // Enrich based on type
      let enrichedData;
      if (item.type === 'project') {
        const enriched = await this.enrichmentOrchestrator.enrichSingleProject(item);
        enrichedData = enriched.enriched_fields;
      } else {
        // Basic enrichment for other types
        enrichedData = {
          enriched_at: new Date().toISOString()
        };
      }

      // Update with enriched data
      await supabase
        .from('content_queue')
        .update({
          metadata: { ...item.metadata, ...enrichedData },
          enriched: true,
          enrichment_data: enrichedData,
          enrichment_status: 'completed',
          status: 'ready_for_review'
        })
        .eq('id', itemId);

      // Recalculate quality score
      const updatedItem = { ...item, metadata: { ...item.metadata, ...enrichedData }, enriched: true };
      const newScore = await QualityScorer.scoreContent(updatedItem);
      await this.updateQualityScore(itemId, newScore.total);

      await this.createAuditRecord(itemId, 'enriched', null, enrichedData);

      return {
        success: true,
        itemId,
        action: 'enriched'
      };
    } catch (error) {
      return {
        success: false,
        itemId,
        action: 'enriched',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Bulk approve high-quality items
   */
  async bulkApprove(
    itemIds: string[],
    reviewerId?: string
  ): Promise<ApprovalResult[]> {
    const results: ApprovalResult[] = [];
    
    for (const itemId of itemIds) {
      const result = await this.approveContent(itemId, reviewerId, 'Bulk approved');
      results.push(result);
    }
    
    return results;
  }

  /**
   * Auto-approve based on quality rules
   */
  async autoApprove(minScore: number = 80): Promise<{
    approved: number;
    errors: number;
  }> {
    // Get high-quality items
    const items = await this.getReviewQueue({ minScore });
    
    let approved = 0;
    let errors = 0;
    
    for (const item of items) {
      // Double-check quality
      const score = await QualityScorer.scoreContent(item);
      
      if (QualityScorer.qualifiesForAutoApproval(score)) {
        const result = await this.approveContent(item.id, 'system', 'Auto-approved based on quality score');
        
        if (result.success) {
          approved++;
          
          // Update to mark as auto-approved
          await supabase
            .from('content_queue')
            .update({ auto_approved: true })
            .eq('id', item.id);
        } else {
          errors++;
        }
      }
    }
    
    return { approved, errors };
  }

  /**
   * Get target table based on content type
   */
  private getTargetTable(type: string): string {
    switch (type) {
      case 'project':
        return 'projects';
      case 'funding':
        return 'funding_programs';
      case 'resource':
        return 'resources';
      default:
        return 'resources'; // Default fallback
    }
  }

  /**
   * Check for duplicates in target table
   */
  private async checkDuplicate(item: any, targetTable: string): Promise<boolean> {
    const { data } = await supabase
      .from(targetTable)
      .select('id')
      .or(`url.eq.${item.url},name.eq.${item.title}`)
      .limit(1);
    
    return (data?.length || 0) > 0;
  }

  /**
   * Transform content for live table
   */
  private transformForLiveTable(item: any, targetTable: string): any {
    const base = {
      created_at: new Date(),
      updated_at: new Date()
    };

    switch (targetTable) {
      case 'projects':
        return {
          ...base,
          name: item.title,
          description: item.description || '',
          short_description: item.description ? item.description.substring(0, 200) : '',
          website_url: item.url,
          github_url: item.metadata?.github_url || null,
          twitter_url: item.metadata?.twitter_url || null,
          linkedin_url: item.metadata?.linkedin_url || null,
          supported_chains: item.metadata?.supported_chains || [],
          project_needs: item.metadata?.project_needs || [],
          tags: item.metadata?.tags || [],
          status: 'active',
          amount_funded: item.metadata?.funding_raised || 0,
          highlights: item.metadata?.highlights || []
        };

      case 'funding_programs':
        return {
          ...base,
          program_name: item.title,
          description: item.description || '',
          type: item.metadata?.funding_type || 'grant',
          min_funding: item.metadata?.min_amount || 0,
          max_funding: item.metadata?.max_amount || 100000,
          funding_currency: item.metadata?.currency || 'USD',
          equity_asked: item.metadata?.equity_required || false,
          application_deadline: item.metadata?.deadline || null,
          status: 'active',
          ecosystems: item.metadata?.ecosystems || [],
          tags: item.metadata?.tags || [],
          location_type: 'remote',
          region: item.metadata?.region || 'Global'
        };

      case 'resources':
        return {
          ...base,
          title: item.title,
          description: item.description || '',
          url: item.url,
          resource_type: item.metadata?.resource_type || 'article',
          category: item.metadata?.category || 'general',
          price_type: item.metadata?.price_type || 'free',
          price_amount: item.metadata?.price_amount || 0,
          provider_name: item.metadata?.provider_name || item.source,
          provider_website: item.metadata?.provider_website || item.url,
          difficulty_level: item.metadata?.difficulty_level || 'intermediate',
          time_commitment: item.metadata?.time_commitment || '1-2 hours',
          target_audience: item.metadata?.target_audience || ['developers'],
          tags: item.metadata?.tags || [],
          status: 'published',
          featured: false,
          verified: false,
          metadata: item.metadata || {}
        };

      default:
        return { ...base, ...item };
    }
  }

  /**
   * Mark item as duplicate
   */
  private async markAsDuplicate(itemId: string): Promise<void> {
    await supabase
      .from('content_queue')
      .update({
        status: 'duplicate',
        reviewed_at: new Date()
      })
      .eq('id', itemId);
  }

  /**
   * Update quality score
   */
  private async updateQualityScore(itemId: string, score: number): Promise<void> {
    await supabase
      .from('content_queue')
      .update({ quality_score: score })
      .eq('id', itemId);
  }

  /**
   * Create audit trail record
   */
  private async createAuditRecord(
    contentId: string,
    action: string,
    performedBy?: string,
    details?: any
  ): Promise<void> {
    await supabase
      .from('approval_audit')
      .insert({
        content_id: contentId,
        action,
        performed_by: performedBy,
        performed_at: new Date(),
        details
      });
  }

  /**
   * Get approval statistics
   */
  async getStats(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
    enriching: number;
    autoApproved: number;
    avgQualityScore: number;
  }> {
    const { data } = await supabase
      .from('content_queue')
      .select('status, auto_approved, quality_score');

    const stats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      enriching: 0,
      autoApproved: 0,
      avgQualityScore: 0
    };

    if (!data) return stats;

    let totalScore = 0;
    let scoreCount = 0;

    for (const item of data) {
      switch (item.status) {
        case 'pending_review':
        case 'ready_for_review':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          if (item.auto_approved) stats.autoApproved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'enriching':
          stats.enriching++;
          break;
      }

      if (item.quality_score) {
        totalScore += item.quality_score;
        scoreCount++;
      }
    }

    stats.avgQualityScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

    return stats;
  }
}