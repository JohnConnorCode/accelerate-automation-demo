/**
 * Simple, deterministic content scorer
 * No ML/AI needed - just clear business rules
 */

interface ScoringCriteria {
  hasTitle: boolean;
  hasDescription: boolean;
  descriptionLength: number;
  hasUrl: boolean;
  hasDate: boolean;
  age: number; // days
  hasTeam: boolean;
  hasFunding: boolean;
  hasMetrics: boolean;
  keywordMatches: number;
}

interface ScoreResult {
  score: number;          // 0-100
  confidence: number;     // 0-1
  factors: {
    quality: number;      // 0-30
    relevance: number;    // 0-30
    freshness: number;    // 0-20
    completeness: number; // 0-20
  };
  recommendation: 'reject' | 'review' | 'approve' | 'feature';
}

export class SimpleScorer {
  private readonly keywords = new Set([
    'blockchain', 'ai', 'ml', 'web3', 'defi', 'nft', 'dao',
    'startup', 'founder', 'funding', 'seed', 'series',
    'developer', 'builder', 'open source', 'github',
    'accelerator', 'incubator', 'venture', 'investment'
  ]);

  /**
   * Score content based on clear criteria
   */
  score(content: any): ScoreResult {
    const criteria = this.extractCriteria(content);
    const factors = this.calculateFactors(criteria);
    
    const totalScore = 
      factors.quality + 
      factors.relevance + 
      factors.freshness + 
      factors.completeness;
    
    const confidence = this.calculateConfidence(criteria);
    const recommendation = this.getRecommendation(totalScore, confidence);
    
    return {
      score: Math.round(totalScore),
      confidence,
      factors,
      recommendation
    };
  }

  /**
   * Extract scoring criteria from content
   */
  private extractCriteria(content: any): ScoringCriteria {
    const text = `${content.title || ''} ${content.description || ''}`.toLowerCase();
    
    return {
      hasTitle: !!content.title,
      hasDescription: !!content.description,
      descriptionLength: (content.description || '').length,
      hasUrl: !!content.url,
      hasDate: !!content.date || !!content.created_at,
      age: this.calculateAge(content.date || content.created_at),
      hasTeam: !!content.team || !!content.team_size,
      hasFunding: !!content.funding || !!content.funding_raised,
      hasMetrics: !!(content.metrics || content.traction || content.users),
      keywordMatches: this.countKeywords(text)
    };
  }

  /**
   * Calculate scoring factors
   */
  private calculateFactors(criteria: ScoringCriteria): ScoreResult['factors'] {
    // Quality (0-30)
    let quality = 0;
    if (criteria.hasTitle) quality += 5;
    if (criteria.hasDescription) quality += 5;
    if (criteria.descriptionLength > 100) quality += 10;
    if (criteria.descriptionLength > 300) quality += 10;
    
    // Relevance (0-30)
    let relevance = Math.min(30, criteria.keywordMatches * 5);
    
    // Freshness (0-20)
    let freshness = 20;
    if (criteria.age > 7) freshness = 15;
    if (criteria.age > 30) freshness = 10;
    if (criteria.age > 90) freshness = 5;
    if (criteria.age > 365) freshness = 0;
    
    // Completeness (0-20)
    let completeness = 0;
    if (criteria.hasUrl) completeness += 5;
    if (criteria.hasDate) completeness += 5;
    if (criteria.hasTeam) completeness += 5;
    if (criteria.hasFunding || criteria.hasMetrics) completeness += 5;
    
    return {
      quality: Math.round(quality),
      relevance: Math.round(relevance),
      freshness: Math.round(freshness),
      completeness: Math.round(completeness)
    };
  }

  /**
   * Calculate confidence in the score
   */
  private calculateConfidence(criteria: ScoringCriteria): number {
    let confidence = 0;
    const checks = [
      criteria.hasTitle,
      criteria.hasDescription,
      criteria.descriptionLength > 50,
      criteria.hasUrl,
      criteria.hasDate
    ];
    
    confidence = checks.filter(Boolean).length / checks.length;
    return Number(confidence.toFixed(2));
  }

  /**
   * Get recommendation based on score
   */
  private getRecommendation(
    score: number, 
    confidence: number
  ): ScoreResult['recommendation'] {
    if (score < 30 || confidence < 0.4) return 'reject';
    if (score < 50) return 'review';
    if (score < 75) return 'approve';
    return 'feature';
  }

  /**
   * Calculate age in days
   */
  private calculateAge(date?: string | Date): number {
    if (!date) return 999;
    const created = new Date(date);
    const now = new Date();
    const days = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return Math.round(days);
  }

  /**
   * Count keyword matches
   */
  private countKeywords(text: string): number {
    let count = 0;
    for (const keyword of this.keywords) {
      if (text.includes(keyword)) count++;
    }
    return count;
  }

  /**
   * Batch score multiple items
   */
  batchScore(items: any[]): ScoreResult[] {
    return items.map(item => this.score(item));
  }

  /**
   * Filter items by minimum score
   */
  filter(items: any[], minScore: number = 30): any[] {
    return items.filter(item => {
      const result = this.score(item);
      return result.score >= minScore;
    });
  }
}

export const scorer = new SimpleScorer();