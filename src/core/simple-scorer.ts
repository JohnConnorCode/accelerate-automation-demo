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
    'accelerator', 'incubator', 'venture', 'investment',
    'saas', 'platform', 'api', 'framework', 'tool',
    'react', 'nextjs', 'typescript', 'python', 'rust'
  ]);
  
  // HIGH QUALITY indicators
  private readonly qualityIndicators = new Set([
    'production', 'enterprise', 'customers', 'revenue',
    'team', 'backed', 'yc', 'techstars', 'funded'
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
    const text = `${content.title || content.name || ''} ${content.description || ''}`.toLowerCase();
    
    // Check for GitHub stars as a quality metric
    const hasHighStars = content.stargazers_count > 100 || content.stars > 100;
    const hasVeryHighStars = content.stargazers_count > 1000 || content.stars > 1000;
    
    return {
      hasTitle: !!(content.title || content.name),
      hasDescription: !!content.description,
      descriptionLength: (content.description || '').length,
      hasUrl: !!(content.url || content.html_url),
      hasDate: !!(content.date || content.created_at || content.pushed_at),
      age: this.calculateAge(content.date || content.created_at || content.pushed_at),
      hasTeam: !!(content.team || content.team_size || content.owner),
      hasFunding: !!(content.funding || content.funding_raised || hasVeryHighStars), // High stars = validated
      hasMetrics: !!(content.metrics || content.traction || content.users || hasHighStars),
      keywordMatches: this.countKeywords(text)
    };
  }

  /**
   * Calculate scoring factors - STRICT for HIGH QUALITY
   */
  private calculateFactors(criteria: ScoringCriteria): ScoreResult['factors'] {
    // Quality (0-30) - MUCH STRICTER
    let quality = 0;
    if (criteria.hasTitle) {quality += 2;}
    if (criteria.hasDescription) {quality += 3;}
    if (criteria.descriptionLength > 200) {quality += 5;}  // Need substantial description
    if (criteria.descriptionLength > 500) {quality += 10;} // Really detailed
    if (criteria.hasMetrics) {quality += 10;} // Must have metrics/traction
    
    // Relevance (0-30) - Need multiple keyword matches
    let relevance = Math.min(30, criteria.keywordMatches * 3);
    if (criteria.keywordMatches < 2) {relevance = 0;} // Must match at least 2 keywords
    
    // Freshness (0-20) - Strict on recency
    let freshness = 20;
    if (criteria.age > 3) {freshness = 15;}   // Older than 3 days
    if (criteria.age > 7) {freshness = 10;}   // Older than a week
    if (criteria.age > 30) {freshness = 5;}   // Older than a month
    if (criteria.age > 90) {freshness = 0;}   // Too old
    
    // Completeness (0-20) - Need ALL data
    let completeness = 0;
    if (criteria.hasUrl) {completeness += 3;}
    if (criteria.hasDate) {completeness += 3;}
    if (criteria.hasTeam) {completeness += 7;}     // Team info is important
    if (criteria.hasFunding) {completeness += 7;}  // Funding info is important
    
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
    if (score < 30 || confidence < 0.4) {return 'reject';}
    if (score < 50) {return 'review';}
    if (score < 75) {return 'approve';}
    return 'feature';
  }

  /**
   * Calculate age in days
   */
  private calculateAge(date?: string | Date): number {
    if (!date) {return 999;}
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
      if (text.includes(keyword)) {count++;}
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