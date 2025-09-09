/**
 * Unified Scoring System for ACCELERATE
 * Prioritizes projects with clear needs
 */

import { ContentItem } from './base-fetcher';

export interface ScoringResult {
  score: number;
  confidence: number;
  category: 'urgent' | 'high' | 'medium' | 'low' | 'reject';
  reasons: string[];
  metadata: {
    hasNeeds: boolean;
    needsCount: number;
    isRecent: boolean;
    isActive: boolean;
    isFunded: boolean;
    teamSizeOk: boolean;
  };
}

export class UnifiedScorer {
  /**
   * Main scoring function - prioritizes projects with needs
   */
  static scoreContent(item: ContentItem): ScoringResult {
    const reasons: string[] = [];
    let score = 0;
    let confidence = 0.5;
    
    const metadata = {
      hasNeeds: false,
      needsCount: 0,
      isRecent: false,
      isActive: false,
      isFunded: false,
      teamSizeOk: false
    };
    
    // PRIORITY 1: Projects with clear needs (40 points max)
    const needs = item.metadata?.project_needs || [];
    if (needs.length > 0) {
      metadata.hasNeeds = true;
      metadata.needsCount = needs.length;
      
      score += 20; // Base for having any needs
      score += Math.min(20, needs.length * 5); // More needs = higher score
      reasons.push(`Has ${needs.length} active needs`);
      confidence += 0.2;
      
      // Specific high-value needs
      if (needs.includes('funding')) {
        score += 10;
        reasons.push('Seeking funding');
      }
      if (needs.includes('co-founder')) {
        score += 10;
        reasons.push('Seeking co-founder');
      }
      if (needs.includes('developers')) {
        score += 5;
        reasons.push('Seeking developers');
      }
    }
    
    // PRIORITY 2: Funding opportunities (50 points max) - CRITICAL FOR ACCELERATE
    if (item.type === 'funding') {
      score += 35; // Higher base for funding programs (ACCELERATE priority)
      reasons.push('Funding opportunity');
      
      // Check deadline urgency
      const deadline = item.metadata?.deadline || item.metadata?.end_date;
      if (deadline) {
        const daysUntil = (new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
        if (daysUntil > 7 && daysUntil < 30) {
          score += 10;
          reasons.push('Urgent deadline');
        } else if (daysUntil >= 30 && daysUntil < 90) {
          score += 5;
          reasons.push('Upcoming deadline');
        }
      }
      
      // Check funding amount
      const minAmount = item.metadata?.funding_amount_min || item.metadata?.min_amount;
      const maxAmount = item.metadata?.funding_amount_max || item.metadata?.max_amount;
      if (minAmount && minAmount <= 10000) {
        score += 5;
        reasons.push('Accessible funding amount');
      }
      if (maxAmount && maxAmount >= 100000) {
        score += 5;
        reasons.push('Substantial funding available');
      }
    }
    
    // PRIORITY 3: Recency and activity (20 points max)
    const launchDate = item.metadata?.launch_date || item.metadata?.created_at;
    if (launchDate) {
      const monthsOld = (Date.now() - new Date(launchDate).getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (monthsOld < 3) {
        score += 10;
        metadata.isRecent = true;
        reasons.push('Recently launched');
      } else if (monthsOld < 6) {
        score += 5;
        metadata.isRecent = true;
        reasons.push('Launched this year');
      }
    }
    
    const lastActivity = item.metadata?.last_activity;
    if (lastActivity) {
      const daysSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceActivity < 7) {
        score += 10;
        metadata.isActive = true;
        reasons.push('Active this week');
        confidence += 0.1;
      } else if (daysSinceActivity < 30) {
        score += 5;
        metadata.isActive = true;
        reasons.push('Active this month');
      }
    }
    
    // PRIORITY 4: Team and funding status (10 points max)
    const teamSize = item.metadata?.team_size;
    if (teamSize && teamSize <= 5) {
      score += 5;
      metadata.teamSizeOk = true;
      reasons.push('Small team');
    }
    
    const fundingRaised = item.metadata?.funding_raised;
    if (fundingRaised !== undefined) {
      if (fundingRaised === 0) {
        score += 5;
        reasons.push('Pre-funding');
      } else if (fundingRaised < 500000) {
        score += 3;
        metadata.isFunded = true;
        reasons.push('Early-stage funding');
      }
    }
    
    // BONUS: Platform-specific boosts
    if (item.source === 'Dework' || item.source === 'Layer3' || item.source === 'Wonderverse') {
      score += 5;
      reasons.push('Active on Web3 platforms');
      confidence += 0.1;
    }
    
    // BONUS: Has bounties or rewards
    if (item.metadata?.open_bounties || item.metadata?.total_bounty_value) {
      score += 10;
      reasons.push('Has open bounties');
    }
    
    // Calculate final confidence
    confidence = Math.min(1, confidence);
    
    // Determine category
    let category: ScoringResult['category'];
    if (score < 20) {
      category = 'reject';
    } else if (score < 40) {
      category = 'low';
    } else if (score < 60) {
      category = 'medium';
    } else if (score < 80) {
      category = 'high';
    } else {
      category = 'urgent';
    }
    
    // Special case: If has needs but low score, upgrade to at least medium
    if (metadata.hasNeeds && category === 'low') {
      category = 'medium';
      score = Math.max(score, 40);
      reasons.push('Upgraded due to active needs');
    }
    
    return {
      score: Math.min(100, score),
      confidence,
      category,
      reasons,
      metadata
    };
  }
  
  /**
   * Batch score and rank items
   */
  static scoreAndRank(items: ContentItem[]): ContentItem[] {
    return items
      .map(item => {
        const scoring = this.scoreContent(item);
        return {
          ...item,
          metadata: {
            ...item.metadata,
            unified_score: scoring.score,
            unified_category: scoring.category,
            unified_confidence: scoring.confidence,
            unified_reasons: scoring.reasons,
            unified_metadata: scoring.metadata
          }
        };
      })
      .sort((a, b) => {
        // First sort by category priority
        const categoryOrder = { urgent: 5, high: 4, medium: 3, low: 2, reject: 1 };
        const aCategory = a.metadata?.unified_category || 'reject';
        const bCategory = b.metadata?.unified_category || 'reject';
        
        if (categoryOrder[aCategory] !== categoryOrder[bCategory]) {
          return categoryOrder[bCategory] - categoryOrder[aCategory];
        }
        
        // Then by score
        return (b.metadata?.unified_score || 0) - (a.metadata?.unified_score || 0);
      });
  }
  
  /**
   * Filter out rejected items
   */
  static filterQualified(items: ContentItem[]): ContentItem[] {
    return items.filter(item => {
      const scoring = this.scoreContent(item);
      return scoring.category !== 'reject';
    });
  }
  
  /**
   * Get summary statistics
   */
  static getStats(items: ContentItem[]): {
    total: number;
    byCategory: Record<string, number>;
    withNeeds: number;
    avgScore: number;
    topProjects: ContentItem[];
  } {
    const scoredItems = items.map(item => ({
      item,
      scoring: this.scoreContent(item)
    }));
    
    const byCategory: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
      reject: 0
    };
    
    let totalScore = 0;
    let withNeeds = 0;
    
    for (const { scoring } of scoredItems) {
      byCategory[scoring.category]++;
      totalScore += scoring.score;
      if (scoring.metadata.hasNeeds) withNeeds++;
    }
    
    const qualified = scoredItems.filter(s => s.scoring.category !== 'reject');
    const topProjects = qualified
      .sort((a, b) => b.scoring.score - a.scoring.score)
      .slice(0, 10)
      .map(s => s.item);
    
    return {
      total: items.length,
      byCategory,
      withNeeds,
      avgScore: items.length > 0 ? Math.round(totalScore / items.length) : 0,
      topProjects
    };
  }
}