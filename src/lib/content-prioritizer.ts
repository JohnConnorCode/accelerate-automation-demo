/**
 * Simple Content Prioritizer - No TensorFlow, just smart scoring
 */
import { supabase } from './supabase';
import { openai } from './openai';

export interface PriorityFactors {
  relevanceScore: number;      // From OpenAI
  freshnessScore: number;      // Based on age
  qualityScore: number;        // From OpenAI
  urgencyScore: number;        // From deadlines
}

export enum ContentPriority {
  EMERGENCY = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  BACKLOG = 1,
}

export class ContentPrioritizer {
  /**
   * Calculate priority score from factors (no ML needed!)
   */
  calculatePriority(factors: PriorityFactors): number {
    // Simple weighted average
    const weights = {
      relevance: 0.35,
      freshness: 0.25,
      quality: 0.30,
      urgency: 0.10
    };
    
    const score = 
      factors.relevanceScore * weights.relevance +
      factors.freshnessScore * weights.freshness +
      factors.qualityScore * weights.quality +
      factors.urgencyScore * weights.urgency;
    
    return Math.round(score * 10) / 10; // 0-10 scale
  }

  /**
   * Get priority level from score
   */
  getPriorityLevel(score: number): ContentPriority {
    if (score >= 8) {return ContentPriority.EMERGENCY;}
    if (score >= 6) {return ContentPriority.HIGH;}
    if (score >= 4) {return ContentPriority.MEDIUM;}
    if (score >= 2) {return ContentPriority.LOW;}
    return ContentPriority.BACKLOG;
  }

  /**
   * Process and prioritize content
   */
  async prioritizeContent(items: any[]): Promise<any[]> {
    const prioritized = [];
    
    for (const item of items) {
      // Get OpenAI scores from the API (key is in Supabase)
      const aiScores = await this.getAIScores(item);
      
      // Calculate freshness (simple age decay)
      const ageInDays = this.getAgeInDays(item.created_at);
      const freshnessScore = Math.max(0, 10 - (ageInDays * 0.5));
      
      // Build factors
      const factors: PriorityFactors = {
        relevanceScore: aiScores?.relevance_score || 5,
        qualityScore: aiScores?.quality_score || 5,
        freshnessScore,
        urgencyScore: aiScores?.urgency_score || 3
      };
      
      // Calculate final priority
      const priorityScore = this.calculatePriority(factors);
      const priorityLevel = this.getPriorityLevel(priorityScore);
      
      prioritized.push({
        ...item,
        priority_score: priorityScore,
        priority_level: priorityLevel,
        factors,
        ai_summary: aiScores?.ai_summary
      });
    }
    
    // Sort by priority score
    return prioritized.sort((a, b) => b.priority_score - a.priority_score);
  }

  /**
   * Get AI scores from Supabase function (which uses the API key)
   */
  private async getAIScores(item: any): Promise<any> {
    try {
      // Call Supabase edge function that has the OpenAI key
      const { data, error } = await supabase.functions.invoke('score-content', {
        body: { 
          title: item.title,
          description: item.description,
          type: item.type || 'resource'
        }
      });
      
      if (error) {throw error;}
      return data;
    } catch (error) {
      console.error('AI scoring failed:', error);
      // Return default scores if AI fails
      return {
        relevance_score: 5,
        quality_score: 5,
        urgency_score: 3,
        ai_summary: 'AI scoring unavailable'
      };
    }
  }

  /**
   * Calculate age in days
   */
  private getAgeInDays(date?: string | Date): number {
    if (!date) {return 999;}
    const created = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export const contentPrioritizer = new ContentPrioritizer();