/**
 * Elegant Content Automation Service
 * Minimal code, maximum reliability
 */

import { supabase } from '../lib/supabase-client';

interface ContentItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  type: string;
  score?: number;
  approved_at?: string;
  approved_by?: string;
}

interface EnrichmentOptions {
  aiAnalysis?: boolean;
  sentimentAnalysis?: boolean;
  keywordExtraction?: boolean;
  categoryPrediction?: boolean;
}

class ElegantContentService {
  private readonly MIN_DESCRIPTION_LENGTH = 50;

  /**
   * Queue content with automatic validation
   */
  async queue(items: Partial<ContentItem>[]): Promise<{ success: number; failed: number }> {
    const validated = items
      .filter(item => this.validate(item))
      .map(item => ({
        ...item,
        description: item.description || this.generateDescription(item),
        score: item.score || this.calculateScore(item),
        created_at: new Date().toISOString()
      }));

    const { data, error } = await this.withRetry(
      () => supabase.from('content_queue').insert(validated).select(),
      [],
      3
    );

    return {
      success: data?.length || 0,
      failed: items.length - (data?.length || 0)
    };
  }

  /**
   * Approve content items
   */
  async approve(ids: string[], userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('content_queue')
      .update({ 
        approved_at: new Date().toISOString(),
        approved_by: userId,
        status: 'approved'
      })
      .in('id', ids);

    return !error;
  }

  /**
   * Reject content items
   */
  async reject(ids: string[], reason?: string): Promise<boolean> {
    const { error } = await supabase
      .from('content_queue')
      .update({ 
        status: 'rejected',
        rejection_reason: reason,
        rejected_at: new Date().toISOString()
      })
      .in('id', ids);

    return !error;
  }

  /**
   * Enrich content with AI analysis
   */
  async enrich(id: string, options: EnrichmentOptions): Promise<any> {
    const enrichments: Record<string, any> = {};

    if (options.aiAnalysis) {
      enrichments.ai_summary = await this.generateAISummary(id);
    }
    if (options.sentimentAnalysis) {
      enrichments.sentiment = this.analyzeSentiment(id);
    }
    if (options.keywordExtraction) {
      enrichments.keywords = this.extractKeywords(id);
    }

    const { data } = await supabase
      .from('content_queue')
      .update({ enrichment_data: enrichments })
      .eq('id', id)
      .select()
      .single();

    return data;
  }

  /**
   * Get dashboard statistics
   */
  async stats(): Promise<any> {
    const { data: queue } = await supabase
      .from('content_queue')
      .select('status, type, score');

    return {
      total: queue?.length || 0,
      pending: queue?.filter(i => i.status === 'pending').length || 0,
      approved: queue?.filter(i => i.status === 'approved').length || 0,
      rejected: queue?.filter(i => i.status === 'rejected').length || 0,
      avgScore: this.average(queue?.map(i => i.score) || []),
      byType: this.groupBy(queue || [], 'type')
    };
  }

  /**
   * Fetch content with filters
   */
  async fetch(filters: { status?: string; type?: string; minScore?: number }): Promise<ContentItem[]> {
    let query = supabase.from('content_queue').select('*');

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.minScore) query = query.gte('score', filters.minScore);

    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  }

  // Private helper methods
  private validate(item: any): boolean {
    return !!(
      item.title?.length > 0 &&
      item.url?.length > 0 &&
      (!item.description || item.description.length >= this.MIN_DESCRIPTION_LENGTH)
    );
  }

  private generateDescription(item: any): string {
    return `${item.title || 'Content'} from ${item.source || 'unknown source'}. ${
      item.type ? `Category: ${item.type}. ` : ''
    }This content requires review for quality and relevance assessment.`;
  }

  private calculateScore(item: any): number {
    let score = 50; // Base score
    if (item.description?.length > 100) score += 10;
    if (item.title?.length > 20) score += 10;
    if (item.source) score += 15;
    if (item.type) score += 15;
    return Math.min(score, 100);
  }

  private async generateAISummary(id: string): Promise<string> {
    // Mock AI summary - replace with actual AI service
    return `AI-generated summary for content ${id}`;
  }

  private analyzeSentiment(id: string): string {
    // Mock sentiment - replace with actual analysis
    return 'neutral';
  }

  private extractKeywords(id: string): string[] {
    // Mock keywords - replace with actual extraction
    return ['technology', 'innovation', 'development'];
  }

  private average(numbers: number[]): number {
    if (!numbers.length) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private groupBy(items: any[], key: string): Record<string, number> {
    return items.reduce((acc, item) => {
      const value = item[key] || 'unknown';
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    fallback: T,
    attempts = 3
  ): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation();
      } catch (error) {
        if (i === attempts - 1) return fallback;
        await new Promise(r => setTimeout(r, 100 * Math.pow(2, i)));
      }
    }
    return fallback;
  }
}

export const contentService = new ElegantContentService();