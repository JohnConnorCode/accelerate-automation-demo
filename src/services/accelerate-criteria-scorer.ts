/**
 * Scoring service that implements ACCELERATE_FINAL_CRITERIA.md requirements
 */

interface ProjectCriteria {
  launch_date: string;
  funding_raised: number;
  team_size: number;
  grant_participation?: string[];
  incubator_participation?: string[];
  traction_metrics?: {
    users?: number;
    github_stars?: number;
  };
  project_needs?: string[];
  last_activity?: string;
}

interface FundingCriteria {
  deadline?: string;
  min_amount: number;
  max_amount: number;
  equity_required: boolean;
  equity_percentage?: number;
  last_investment_date?: string;
  benefits?: string[];
}

interface ResourceCriteria {
  price_type: 'free' | 'freemium' | 'paid';
  price_amount?: number;
  last_updated: string;
  provider_credibility?: string;
  success_stories?: string[];
  category?: string;
  difficulty_level?: string;
}

export class AccelerateCriteriaScorer {
  /**
   * Score a project based on ACCELERATE_FINAL_CRITERIA requirements
   */
  scoreProject(item: any): { score: number; eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;

    // MANDATORY CRITERIA - Must pass all
    const launchYear = new Date(item.launch_date || '').getFullYear();
    if (launchYear < 2024) {
      eligible = false;
      reasons.push('❌ Launched before 2024');
    }

    if ((item.funding_raised || 0) > 500000) {
      eligible = false;
      reasons.push('❌ Funding exceeds $500k');
    }

    if ((item.team_size || 0) > 10) {
      eligible = false;
      reasons.push('❌ Team size exceeds 10');
    }

    // Check for corporate backing (simplified check)
    const description = (item.description || '').toLowerCase();
    const corporateBacked = ['coinbase', 'sony', 'microsoft', 'google', 'amazon', 'meta']
      .some(corp => description.includes(corp));
    if (corporateBacked) {
      eligible = false;
      reasons.push('❌ Corporate-backed project');
    }

    // Check activity (must be within 30 days)
    const daysSinceActivity = this.getDaysSince(item.last_activity);
    if (daysSinceActivity > 30) {
      eligible = false;
      reasons.push('❌ No activity in 30+ days');
    }

    // If not eligible, return early
    if (!eligible) {
      return { score: 0, eligible, reasons };
    }

    // SCORING FOR ELIGIBLE PROJECTS
    
    // Recency bonus (newer is better)
    const monthsOld = this.getMonthsSince(item.launch_date);
    if (monthsOld < 3) {
      score += 30;
      reasons.push('✅ Launched < 3 months ago (+30)');
    } else if (monthsOld < 6) {
      score += 20;
      reasons.push('✅ Launched < 6 months ago (+20)');
    } else if (monthsOld < 12) {
      score += 10;
      reasons.push('✅ Launched < 12 months ago (+10)');
    }

    // Team size (smaller is better)
    if (item.team_size <= 3) {
      score += 20;
      reasons.push('✅ Small team ≤3 (+20)');
    } else if (item.team_size <= 5) {
      score += 15;
      reasons.push('✅ Small team ≤5 (+15)');
    } else if (item.team_size <= 10) {
      score += 10;
      reasons.push('✅ Team ≤10 (+10)');
    }

    // Funding (less is more early-stage)
    if (!item.funding_raised || item.funding_raised === 0) {
      score += 15;
      reasons.push('✅ Pre-funding (+15)');
    } else if (item.funding_raised < 100000) {
      score += 10;
      reasons.push('✅ <$100k raised (+10)');
    } else if (item.funding_raised < 500000) {
      score += 5;
      reasons.push('✅ <$500k raised (+5)');
    }

    // Validation
    if (item.grant_participation?.length > 0) {
      score += 15;
      reasons.push('✅ Grant participant (+15)');
    }
    if (item.incubator_participation?.length > 0) {
      score += 15;
      reasons.push('✅ Incubator alumni (+15)');
    }
    if (item.traction_metrics?.users > 100) {
      score += 10;
      reasons.push('✅ 100+ users (+10)');
    }
    if (item.traction_metrics?.github_stars > 50) {
      score += 10;
      reasons.push('✅ 50+ GitHub stars (+10)');
    }

    // Needs (actively seeking help)
    if (item.project_needs?.includes('funding')) {
      score += 10;
      reasons.push('✅ Seeking funding (+10)');
    }
    if (item.project_needs?.includes('co-founder')) {
      score += 15;
      reasons.push('✅ Seeking co-founder (+15)');
    }
    if (item.project_needs?.includes('developers')) {
      score += 10;
      reasons.push('✅ Seeking developers (+10)');
    }

    return { 
      score: Math.min(score, 100), 
      eligible, 
      reasons 
    };
  }

  /**
   * Score a funding program based on criteria
   */
  scoreFunding(item: any): { score: number; eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;

    // Check if currently active (2025 activity required)
    const daysSinceLastInvestment = this.getDaysSince(item.last_investment_date);
    if (daysSinceLastInvestment > 90) {
      eligible = false;
      reasons.push('❌ No recent activity (90+ days)');
      return { score: 0, eligible, reasons };
    }

    // Deadline urgency
    const daysUntilDeadline = this.getDaysUntil(item.deadline);
    if (daysUntilDeadline !== null) {
      if (daysUntilDeadline < 7) {
        reasons.push('⚠️ Deadline too soon (<7 days)');
      } else if (daysUntilDeadline < 30) {
        score += 30;
        reasons.push('✅ Urgent deadline <30 days (+30)');
      } else if (daysUntilDeadline < 60) {
        score += 20;
        reasons.push('✅ Deadline <60 days (+20)');
      }
    } else {
      score += 15;
      reasons.push('✅ Rolling basis (+15)');
    }

    // Amount accessibility
    if (item.min_amount <= 10000) {
      score += 15;
      reasons.push('✅ Low minimum ≤$10k (+15)');
    }
    if (item.max_amount >= 100000) {
      score += 10;
      reasons.push('✅ High maximum ≥$100k (+10)');
    }

    // Equity
    if (!item.equity_required) {
      score += 20;
      reasons.push('✅ No equity required (+20)');
    } else if (item.equity_percentage < 7) {
      score += 10;
      reasons.push('✅ Low equity <7% (+10)');
    }

    // Recent activity
    if (daysSinceLastInvestment < 30) {
      score += 20;
      reasons.push('✅ Very recent activity <30 days (+20)');
    } else if (daysSinceLastInvestment < 60) {
      score += 10;
      reasons.push('✅ Recent activity <60 days (+10)');
    }

    // Benefits
    if (item.benefits?.includes('mentorship')) {
      score += 5;
      reasons.push('✅ Includes mentorship (+5)');
    }
    if (item.benefits?.includes('network')) {
      score += 5;
      reasons.push('✅ Network access (+5)');
    }

    return { 
      score: Math.min(score, 100), 
      eligible, 
      reasons 
    };
  }

  /**
   * Score a resource based on criteria
   */
  scoreResource(item: any): { score: number; eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let eligible = true;

    // Must be updated within 6 months
    const monthsSinceUpdate = this.getMonthsSince(item.last_updated);
    if (monthsSinceUpdate > 6) {
      eligible = false;
      reasons.push('❌ Not updated in 6+ months');
      return { score: 0, eligible, reasons };
    }

    // Pricing (free is better for early stage)
    if (item.price_type === 'free') {
      score += 20;
      reasons.push('✅ Free resource (+20)');
    } else if (item.price_type === 'freemium') {
      score += 15;
      reasons.push('✅ Freemium model (+15)');
    } else if (item.price_amount < 100) {
      score += 10;
      reasons.push('✅ Affordable <$100 (+10)');
    }

    // Recency
    if (monthsSinceUpdate < 1) {
      score += 15;
      reasons.push('✅ Updated <1 month ago (+15)');
    } else if (monthsSinceUpdate < 3) {
      score += 10;
      reasons.push('✅ Updated <3 months ago (+10)');
    } else if (monthsSinceUpdate < 6) {
      score += 5;
      reasons.push('✅ Updated <6 months ago (+5)');
    }

    // Credibility
    const credibility = (item.provider_credibility || '').toLowerCase();
    if (credibility.includes('yc') || credibility.includes('combinator')) {
      score += 10;
      reasons.push('✅ YC-backed provider (+10)');
    }
    if (credibility.includes('a16z') || credibility.includes('andreessen')) {
      score += 10;
      reasons.push('✅ a16z-backed provider (+10)');
    }
    if (item.success_stories?.length > 0) {
      score += 10;
      reasons.push('✅ Has success stories (+10)');
    }

    // Relevance
    if (item.category === 'smart-contracts' || item.category === 'blockchain') {
      score += 10;
      reasons.push('✅ Blockchain/smart contracts (+10)');
    }
    if (item.category === 'fundraising' || item.category === 'grants') {
      score += 10;
      reasons.push('✅ Fundraising focused (+10)');
    }
    if (item.difficulty_level === 'beginner') {
      score += 5;
      reasons.push('✅ Beginner friendly (+5)');
    }

    return { 
      score: Math.min(score, 100), 
      eligible, 
      reasons 
    };
  }

  /**
   * Main scoring function that routes to appropriate scorer
   */
  score(item: any, type: 'project' | 'funding' | 'resource'): { 
    score: number; 
    eligible: boolean; 
    reasons: string[];
    recommendation: 'approve' | 'review' | 'reject';
  } {
    let result;
    
    switch (type) {
      case 'project':
        result = this.scoreProject(item);
        break;
      case 'funding':
        result = this.scoreFunding(item);
        break;
      case 'resource':
        result = this.scoreResource(item);
        break;
      default:
        result = { score: 0, eligible: false, reasons: ['Unknown type'] };
    }

    // Determine recommendation
    let recommendation: 'approve' | 'review' | 'reject';
    if (!result.eligible) {
      recommendation = 'reject';
    } else if (result.score >= 70) {
      recommendation = 'approve';
    } else if (result.score >= 40) {
      recommendation = 'review';
    } else {
      recommendation = 'reject';
    }

    return { ...result, recommendation };
  }

  // Helper functions
  private getDaysSince(date?: string): number {
    if (!date) return 999;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private getDaysUntil(date?: string): number | null {
    if (!date) return null;
    const diff = new Date(date).getTime() - Date.now();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private getMonthsSince(date?: string): number {
    if (!date) return 999;
    const diff = Date.now() - new Date(date).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  }
}

export const accelerateCriteriaScorer = new AccelerateCriteriaScorer();