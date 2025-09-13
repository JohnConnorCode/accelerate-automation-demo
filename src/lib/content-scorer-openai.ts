/**
 * Content Scorer using OpenAI via Supabase Edge Function
 */
import { supabase } from './supabase';

export interface ScoringResult {
  relevance_score: number;
  quality_score: number;
  urgency_score: number;
  ai_summary: string;
  ai_reasoning: string;
  confidence: number;
}

export class ContentScorer {
  /**
   * Score content using OpenAI GPT-4o-mini via Supabase Edge Function
   */
  async scoreContent(content: any): Promise<ScoringResult> {
    try {
      // Call the Supabase Edge Function (which has the OpenAI key)
      const { data, error } = await supabase.functions.invoke('score-content', {
        body: {
          title: content.title || content.name || '',
          description: content.description || content.tagline || '',
          type: content.type || 'resource'
        }
      });

      if (error) {throw error;}
      
      return data as ScoringResult;
    } catch (error) {
      console.error('OpenAI scoring failed:', error);
      // Return default scores if AI fails
      return {
        relevance_score: 5,
        quality_score: 5,
        urgency_score: 3,
        ai_summary: 'Scoring unavailable',
        ai_reasoning: 'AI service temporarily unavailable',
        confidence: 0.5
      };
    }
  }

  /**
   * Batch score multiple items
   */
  async batchScore(items: any[]): Promise<ScoringResult[]> {
    const results: ScoringResult[] = [];
    
    // Process in batches of 5 for rate limiting
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      const batchResults = await Promise.all(
        batch.map(item => this.scoreContent(item))
      );
      results.push(...batchResults);
      
      // Small delay between batches to avoid rate limits
      if (i + 5 < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Calculate final priority from OpenAI scores
   */
  calculatePriority(scores: ScoringResult): number {
    // Weighted average of OpenAI scores
    const weights = {
      relevance: 0.4,
      quality: 0.35,
      urgency: 0.25
    };
    
    return (
      scores.relevance_score * weights.relevance +
      scores.quality_score * weights.quality +
      scores.urgency_score * weights.urgency
    );
  }
}

export const contentScorer = new ContentScorer();