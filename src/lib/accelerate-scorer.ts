import { ContentItem } from './base-fetcher';

/**
 * ACCELERATE PLATFORM SCORING ALGORITHM
 * Scores content based on relevance to early-stage Web3 founders
 * Higher scores = more valuable for Accelerate users
 * 
 * Based on ACCELERATE_FINAL_CRITERIA.md scoring algorithm
 */

export class AccelerateScorer {
  /**
   * Instance method for scoring content
   */
  async scoreContent(item: ContentItem): Promise<number> {
    return AccelerateScorer.scoreForAccelerate(item);
  }

  /**
   * Main scoring function - returns 0-100
   */
  static scoreForAccelerate(item: ContentItem): number {
    let score = 0;

    // PROJECTS - Early stage projects seeking help
    if (item.type === 'project') {
      score += this.scoreProject(item);
    }
    
    // FUNDING - Open opportunities with deadlines
    else if (item.type === 'funding') {
      score += this.scoreFunding(item);
    }
    
    // RESOURCES - Educational and tools
    else if (item.type === 'resource') {
      score += this.scoreResource(item);
    }

    // Universal boosts
    score += this.scoreRecency(item);
    score += this.scoreEngagement(item);
    score += this.scoreCompleteness(item);

    return Math.min(Math.round(score), 100);
  }

  /**
   * Score projects based on stage, needs, and traction
   */
  private static scoreProject(item: ContentItem): number {
    let score = 0;
    const meta = item.metadata || {};

    // Recency - prefer newer projects but don't disqualify older ones
    if (meta.launch_date) {
      const launchDate = new Date(meta.launch_date);
      const monthsOld = (Date.now() - launchDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
      
      // Be more lenient - accept projects from 2023+
      if (launchDate < new Date('2023-01-01')) {score -= 10;} // Penalty but not disqualified
      
      if (monthsOld < 3) {score += 30;}
      else if (monthsOld < 6) {score += 20;}
      else if (monthsOld < 12) {score += 10;}
      else {score += 5;} // Still give some points for older projects
    } else {
      // No launch date? Give benefit of doubt
      score += 15;
    }

    // Team size - smaller is better for early stage
    if (meta.team_size) {
      if (meta.team_size > 10) {return 0;} // Disqualified
      
      if (meta.team_size <= 3) {score += 20;}
      else if (meta.team_size <= 5) {score += 15;}
      else if (meta.team_size <= 10) {score += 10;}
    }

    // Funding - less is more early-stage
    if (typeof meta.funding_raised === 'number') {
      if (meta.funding_raised > 500000) {return 0;} // Disqualified
      
      if (meta.funding_raised === 0) {score += 15;}
      else if (meta.funding_raised < 100000) {score += 10;}
      else if (meta.funding_raised < 500000) {score += 5;}
    }

    // Validation signals
    if (meta.grant_participation?.length > 0) {score += 15;}
    if (meta.incubator_participation?.length > 0) {score += 15;}
    if (meta.traction_metrics?.users > 100) {score += 10;}
    if (meta.traction_metrics?.github_stars > 50) {score += 10;}

    // Needs - actively seeking help boosts score
    if (meta.project_needs?.includes('funding')) {score += 10;}
    if (meta.project_needs?.includes('co-founder')) {score += 15;}
    if (meta.project_needs?.includes('developers')) {score += 10;}

    // Activity check - be more lenient
    if (meta.last_activity) {
      const daysSinceActivity = (Date.now() - new Date(meta.last_activity).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceActivity > 90) {score *= 0.7;} // 30% penalty for very inactive
      else if (daysSinceActivity > 30) {score *= 0.9;} // 10% penalty for somewhat inactive
    } else {
      // No activity date? Assume it's recent
      score += 5;
    }

    return score;
  }

  /**
   * Score funding opportunities based on deadline, amount, and terms
   */
  private static scoreFunding(item: ContentItem): number {
    let score = 40; // Base score for funding (highest value)
    const meta = item.metadata || {};

    // Deadline urgency
    if (meta.days_until_deadline) {
      if (meta.days_until_deadline < 7) {return 0;} // Too urgent, likely to miss
      if (meta.days_until_deadline < 30) {score += 20;}
      else if (meta.days_until_deadline < 60) {score += 10;}
    } else {
      score += 15; // Rolling basis is good
    }

    // Amount accessibility
    if (meta.min_amount <= 10000) {score += 15;}
    if (meta.max_amount >= 100000) {score += 10;}

    // Equity terms
    if (meta.equity_required === false) {score += 20;}
    else if (meta.equity_percentage < 7) {score += 10;}

    // Recent activity - prefer active funds but don't disqualify
    if (meta.last_investment_date) {
      const daysSinceInvestment = (Date.now() - new Date(meta.last_investment_date).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceInvestment > 180) {score -= 20;} // Penalty for very old
      else if (daysSinceInvestment < 30) {score += 20;}
      else if (daysSinceInvestment < 90) {score += 10;}
    } else {
      // No investment date? Assume it's active
      score += 15;
    }

    // Benefits beyond money
    if (meta.benefits?.includes('mentorship')) {score += 5;}
    if (meta.benefits?.includes('network')) {score += 5;}

    return score;
  }

  /**
   * Score resources based on price, quality, and relevance
   */
  private static scoreResource(item: ContentItem): number {
    let score = 20; // Base score for resources
    const meta = item.metadata || {};

    // Free is better for early stage
    if (meta.price_type === 'free') {score += 20;}
    else if (meta.price_type === 'freemium') {score += 15;}
    else if (meta.price_amount < 100) {score += 10;}
    else if (meta.price_amount >= 100) {return 0;} // Too expensive

    // Recency - prefer recent but don't disqualify
    if (meta.last_updated) {
      const monthsSinceUpdate = (Date.now() - new Date(meta.last_updated).getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (monthsSinceUpdate > 12) {score -= 10;} // Penalty for very old
      else if (monthsSinceUpdate < 1) {score += 15;}
      else if (monthsSinceUpdate < 3) {score += 10;}
      else if (monthsSinceUpdate < 6) {score += 5;}
    } else {
      // No update date? Give benefit of doubt
      score += 10;
    }

    // Credibility
    if (meta.provider_credibility?.includes('YC')) {score += 10;}
    if (meta.provider_credibility?.includes('a16z')) {score += 10;}
    if (meta.success_stories?.length > 0) {score += 10;}

    // Relevance to builders
    if (meta.category === 'smart-contracts') {score += 10;}
    if (meta.category === 'fundraising') {score += 10;}
    if (meta.difficulty_level === 'beginner') {score += 5;}

    return score;
  }

  /**
   * Boost score for recent content
   */
  private static scoreRecency(item: ContentItem): number {
    let score = 0;
    const created = item.metadata?.created_at || item.metadata?.published_at;
    
    if (created) {
      const hoursSincePost = (Date.now() - new Date(created).getTime()) / (60 * 60 * 1000);
      if (hoursSincePost < 24) {score += 15;}
      else if (hoursSincePost < 24 * 3) {score += 10;}
      else if (hoursSincePost < 24 * 7) {score += 5;}
    }

    return score;
  }

  /**
   * Boost score for high engagement
   */
  private static scoreEngagement(item: ContentItem): number {
    let score = 0;
    const meta = item.metadata || {};

    // Different engagement metrics per type
    if (item.type === 'project') {
      const stars = meta.github_stars || meta.traction_metrics?.github_stars || 0;
      if (stars > 500) {score += 10;}
      else if (stars > 100) {score += 5;}
    } else if (item.type === 'resource') {
      const qualityScore = meta.quality_score || 0;
      score += Math.floor(qualityScore / 20); // 0-5 points
    }

    return score;
  }

  /**
   * Boost score for data completeness
   */
  private static scoreCompleteness(item: ContentItem): number {
    let score = 0;
    const meta = item.metadata || {};

    // Check for detailed descriptions
    if (item.description && item.description.length > 500) {score += 5;}

    // Check for complete metadata
    const requiredFields = this.getRequiredFields(item.type);
    const filledFields = requiredFields.filter(field => meta[field] !== null && meta[field] !== undefined);
    const completeness = filledFields.length / requiredFields.length;
    
    score += Math.floor(completeness * 10); // 0-10 points

    return score;
  }

  /**
   * Get required fields per content type
   */
  private static getRequiredFields(type: string): string[] {
    switch (type) {
      case 'project':
        return ['name', 'launch_date', 'funding_raised', 'team_size', 'categories', 'project_needs', 'last_activity'];
      case 'funding':
        return ['name', 'organization', 'funding_type', 'min_amount', 'max_amount', 'application_url', 'eligibility_criteria', 'last_investment_date'];
      case 'resource':
        return ['resource_type', 'category', 'price_type', 'provider_name', 'last_updated', 'key_benefits'];
      default:
        return [];
    }
  }

  /**
   * Batch score multiple items and sort by score
   */
  static scoreAndRank(items: ContentItem[]): ContentItem[] {
    return items
      .map(item => ({
        ...item,
        metadata: {
          ...item.metadata,
          accelerate_score: this.scoreForAccelerate(item)
        }
      }))
      .sort((a, b) => (b.metadata?.accelerate_score || 0) - (a.metadata?.accelerate_score || 0));
  }

  /**
   * Filter items that don't meet minimum criteria
   */
  static filterQualified(items: ContentItem[]): ContentItem[] {
    return items.filter(item => {
      const score = this.scoreForAccelerate(item);
      return score > 0; // Score of 0 means disqualified
    });
  }

  /**
   * Get quality metrics for a batch of items
   */
  static getQualityMetrics(items: ContentItem[]): {
    total: number;
    qualified: number;
    averageScore: number;
    topScorers: ContentItem[];
    disqualified: ContentItem[];
    byType: { [key: string]: number };
  } {
    const scored = items.map(item => ({
      item,
      score: this.scoreForAccelerate(item)
    }));

    const qualified = scored.filter(s => s.score > 0);
    const disqualified = scored.filter(s => s.score === 0);
    const topScorers = qualified
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.item);

    const byType = {
      project: qualified.filter(s => s.item.type === 'project').length,
      funding: qualified.filter(s => s.item.type === 'funding').length,
      resource: qualified.filter(s => s.item.type === 'resource').length,
    };

    return {
      total: items.length,
      qualified: qualified.length,
      averageScore: qualified.length > 0 
        ? qualified.reduce((sum, s) => sum + s.score, 0) / qualified.length 
        : 0,
      topScorers,
      disqualified: disqualified.map(s => s.item),
      byType
    };
  }
}