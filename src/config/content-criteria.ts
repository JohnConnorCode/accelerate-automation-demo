/**
 * Content Type Definitions and Criteria
 * Clear specifications for Projects, Funding Programs, and Resources
 */

export interface ContentCriteria {
  required_fields: string[];
  scoring_weights: Record<string, number>;
  validation_rules: Record<string, any>;
  enrichment_priority: string[];
}

/**
 * PROJECT CRITERIA
 * Early-stage Web3 startups ONLY (no big protocols)
 * Based on ACCELERATE_FINAL_CRITERIA.md
 */
export const PROJECT_CRITERIA: ContentCriteria = {
  required_fields: [
    'title',
    'description',
    'url',
    'team_info',
    'launch_date'
  ],
  
  scoring_weights: {
    recency: 0.30,           // 2024+ launch, newer is better
    team_size: 0.20,         // Smaller teams (1-5) score higher
    funding_stage: 0.15,     // Less funding = more early stage
    validation: 0.15,        // Grant/incubator participation
    traction: 0.10,          // Users, GitHub activity
    needs: 0.10              // Actively seeking help
  },
  
  validation_rules: {
    min_team_size: 1,
    max_team_size: 10,       // MUST be ≤10 people
    max_funding: 500000,     // MUST be <$500k raised
    min_launch_year: 2024,   // MUST be 2024 or later
    min_description_length: 500,  // Detailed descriptions preferred
    required_links: ['website', 'social_proof'],
    max_age_days: 30,        // Must show activity in last 30 days
    exclude_corporate: true  // No Coinbase, Sony, etc backing
  },
  
  enrichment_priority: [
    'github_data',           // Stars, contributors, activity
    'team_linkedin',         // Founder backgrounds
    'funding_history',       // Crunchbase, AngelList
    'social_metrics',        // Twitter, Discord followers
    'product_metrics'        // Users, revenue if available
  ]
};

/**
 * FUNDING PROGRAM CRITERIA
 * Grants, incubators, accelerators, early-stage VCs
 * Based on ACCELERATE_FINAL_CRITERIA.md
 */
export const FUNDING_CRITERIA: ContentCriteria = {
  required_fields: [
    'program_name',
    'description',
    'funding_amount',
    'application_url',
    'eligibility'
  ],
  
  scoring_weights: {
    deadline_urgency: 0.30,  // <30 days scores highest
    accessibility: 0.20,     // No equity > low equity
    amount_fit: 0.15,        // $10k-$100k sweet spot
    recent_activity: 0.20,   // 2025 investments proven
    benefits: 0.15           // Mentorship, network value
  },
  
  validation_rules: {
    min_funding_amount: 1000,
    max_funding_amount: 10000000,  // Focus on early-stage amounts
    min_description_length: 500,    // Detailed descriptions
    required_info: ['application_process', 'eligibility_criteria'],
    must_be_active: true,           // Currently accepting applications
    requires_2025_activity: true    // Must show recent activity
  },
  
  enrichment_priority: [
    'funder_profile',        // VC/accelerator background
    'portfolio_companies',   // Previous investments
    'success_stories',       // Alumni outcomes
    'application_tips',      // How to improve chances
    'contact_info'          // Direct contacts if available
  ]
};

/**
 * RESOURCE CRITERIA
 * Infrastructure, educational, tools, communities for early-stage founders
 * Based on ACCELERATE_FINAL_CRITERIA.md
 */
export const RESOURCE_CRITERIA: ContentCriteria = {
  required_fields: [
    'title',
    'description',
    'url',
    'category',
    'resource_type'
  ],
  
  scoring_weights: {
    price_accessibility: 0.20,  // Free > freemium > paid
    recency: 0.15,              // Updated in last 6 months
    credibility: 0.10,          // YC, a16z, proven providers
    relevance: 0.10,            // Smart contracts, fundraising focus
    usefulness: 0.30,           // Clear value to early founders
    quality: 0.15               // Success stories, reviews
  },
  
  validation_rules: {
    min_description_length: 500,  // Detailed descriptions preferred
    valid_categories: [
      'infrastructure',          // Node providers, hosting, APIs
      'educational',            // Courses, docs, tutorials
      'tools',                  // Dev tools, analytics, design
      'communities'             // Founder collectives, DAOs
    ],
    max_age_months: 6,          // Must be updated in last 6 months
    must_help_early_stage: true // Must provide value to early teams
  },
  
  enrichment_priority: [
    'documentation_quality',
    'user_reviews',
    'github_stats',         // If open source
    'pricing_info',
    'alternatives'
  ]
};

/**
 * Content Type Detector with Clear Rules
 */
export class ContentTypeDetector {
  /**
   * Detect content type with confidence score
   */
  detectType(item: any, source: string): {
    type: 'project' | 'funding' | 'resource';
    confidence: number;
    matched_criteria: string[];
  } {
    const scores = {
      project: 0,
      funding: 0,
      resource: 0
    };
    const matched = {
      project: [] as string[],
      funding: [] as string[],
      resource: [] as string[]
    };
    
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    
    // PROJECT INDICATORS (Early-stage startups only)
    if (item.team_size && item.team_size <= 10) {
      scores.project += 30;
      matched.project.push('small_team');
    }
    if (item.launch_date && new Date(item.launch_date).getFullYear() >= 2024) {
      scores.project += 25;
      matched.project.push('launched_2024_plus');
    }
    if (item.funding_raised !== undefined && item.funding_raised < 500000) {
      scores.project += 20;
      matched.project.push('early_stage_funding');
    }
    if (text.includes('startup') || text.includes('founder') || text.includes('early-stage')) {
      scores.project += 15;
      matched.project.push('startup_keywords');
    }
    if (item.grant_participation || item.incubator_participation) {
      scores.project += 15;
      matched.project.push('accelerator_validation');
    }
    if (source === 'producthunt' || source === 'github') {
      scores.project += 10;
      matched.project.push('project_source');
    }
    
    // FUNDING INDICATORS (Active programs with 2025 activity)
    if (item.funding_amount || item.min_amount || item.max_amount) {
      scores.funding += 35;
      matched.funding.push('has_funding_amount');
    }
    if (item.application_url || item.application_process) {
      scores.funding += 25;
      matched.funding.push('has_application_info');
    }
    if (item.last_investment_date && this.isRecent2025Activity(item.last_investment_date)) {
      scores.funding += 20;
      matched.funding.push('recent_2025_activity');
    }
    if (text.includes('grant') || text.includes('accelerator') || text.includes('incubator') || text.includes('pre-seed')) {
      scores.funding += 15;
      matched.funding.push('funding_keywords');
    }
    if (!item.equity_required || item.equity_percentage < 7) {
      scores.funding += 5;
      matched.funding.push('founder_friendly');
    }
    
    // RESOURCE INDICATORS (Tools/education for early-stage founders)
    if (item.price_type === 'free' || text.includes('free')) {
      scores.resource += 25;
      matched.resource.push('free_resource');
    }
    if (item.last_updated && this.isRecentlyUpdated(item.last_updated)) {
      scores.resource += 20;
      matched.resource.push('recently_updated');
    }
    if (text.includes('tutorial') || text.includes('course') || text.includes('guide') || text.includes('documentation')) {
      scores.resource += 20;
      matched.resource.push('educational_content');
    }
    if (text.includes('infrastructure') || text.includes('api') || text.includes('hosting') || text.includes('node')) {
      scores.resource += 15;
      matched.resource.push('infrastructure_keywords');
    }
    if (text.includes('community') || text.includes('dao') || text.includes('collective')) {
      scores.resource += 10;
      matched.resource.push('community_resource');
    }
    if (!item.team_size && !item.funding_amount && !item.launch_date) {
      scores.resource += 10;
      matched.resource.push('not_project_or_funding');
    }
    
    // Determine type with highest score
    let type: 'project' | 'funding' | 'resource' = 'resource';
    let maxScore = scores.resource;
    
    if (scores.project > maxScore) {
      type = 'project';
      maxScore = scores.project;
    }
    if (scores.funding > maxScore) {
      type = 'funding';
      maxScore = scores.funding;
    }
    
    return {
      type,
      confidence: Math.min(1, maxScore / 100),
      matched_criteria: matched[type]
    };
  }
  
  /**
   * Validate content against criteria
   */
  validateContent(item: any, type: 'project' | 'funding' | 'resource'): {
    valid: boolean;
    missing_fields: string[];
    quality_score: number;
  } {
    const criteria = this.getCriteria(type);
    const missing: string[] = [];
    
    // Check required fields
    for (const field of criteria.required_fields) {
      if (!this.hasField(item, field)) {
        missing.push(field);
      }
    }
    
    // Calculate quality score
    let quality = 100;
    quality -= missing.length * 20; // -20 points per missing field
    
    // Check validation rules
    const rules = criteria.validation_rules;
    
    if (rules.min_description_length) {
      const desc = item.description || '';
      if (desc.length < rules.min_description_length) {
        quality -= 10;
      }
    }
    
    if (rules.deadline_required && type === 'funding') {
      if (!item.deadline) {
        quality -= 30;
      }
    }
    
    return {
      valid: missing.length === 0,
      missing_fields: missing,
      quality_score: Math.max(0, quality)
    };
  }
  
  /**
   * Get enrichment requirements for content type
   */
  getEnrichmentPlan(type: 'project' | 'funding' | 'resource'): string[] {
    const criteria = this.getCriteria(type);
    return criteria.enrichment_priority;
  }
  
  /**
   * Calculate final score based on type-specific weights
   */
  calculateScore(item: any, type: 'project' | 'funding' | 'resource'): number {
    const criteria = this.getCriteria(type);
    const weights = criteria.scoring_weights;
    let totalScore = 0;
    
    switch (type) {
      case 'project':
        // Recency (2024+ is mandatory, newer is better)
        if (item.launch_date) {
          const monthsOld = this.getAgeInMonths(item.launch_date);
          if (monthsOld < 3) totalScore += 100 * weights.recency;
          else if (monthsOld < 6) totalScore += 70 * weights.recency;
          else if (monthsOld < 12) totalScore += 40 * weights.recency;
        }
        // Team size (smaller is better for early stage)
        if (item.team_size) {
          if (item.team_size <= 3) totalScore += 100 * weights.team_size;
          else if (item.team_size <= 5) totalScore += 75 * weights.team_size;
          else if (item.team_size <= 10) totalScore += 50 * weights.team_size;
        }
        // Funding stage (less is more early-stage)
        if (item.funding_raised !== undefined) {
          if (item.funding_raised === 0) totalScore += 100 * weights.funding_stage;
          else if (item.funding_raised < 100000) totalScore += 70 * weights.funding_stage;
          else if (item.funding_raised < 500000) totalScore += 40 * weights.funding_stage;
        }
        // Validation (grants/incubators)
        if (item.grant_participation?.length > 0) totalScore += 50 * weights.validation;
        if (item.incubator_participation?.length > 0) totalScore += 50 * weights.validation;
        // Traction
        if (item.metrics?.users > 100) totalScore += 50 * weights.traction;
        if (item.metrics?.github_stars > 50) totalScore += 50 * weights.traction;
        // Needs (actively seeking help)
        if (item.project_needs?.includes('funding')) totalScore += 40 * weights.needs;
        if (item.project_needs?.includes('co-founder')) totalScore += 60 * weights.needs;
        break;
        
      case 'funding':
        // Deadline urgency
        if (item.deadline) {
          const daysLeft = this.daysUntilDeadline(item.deadline);
          if (daysLeft > 7 && daysLeft < 30) totalScore += 100 * weights.deadline_urgency;
          else if (daysLeft < 60) totalScore += 70 * weights.deadline_urgency;
        } else {
          totalScore += 50 * weights.deadline_urgency; // Rolling basis
        }
        // Accessibility (no equity is best)
        if (!item.equity_required) totalScore += 100 * weights.accessibility;
        else if (item.equity_percentage < 7) totalScore += 50 * weights.accessibility;
        // Amount fit ($10k-$100k sweet spot)
        if (item.min_amount <= 10000 && item.max_amount >= 100000) {
          totalScore += 100 * weights.amount_fit;
        } else if (item.max_amount >= 50000) {
          totalScore += 50 * weights.amount_fit;
        }
        // Recent activity (2025)
        if (item.last_investment_date && this.isRecent2025Activity(item.last_investment_date)) {
          totalScore += 100 * weights.recent_activity;
        }
        // Benefits beyond money
        if (item.benefits?.includes('mentorship')) totalScore += 50 * weights.benefits;
        if (item.benefits?.includes('network')) totalScore += 50 * weights.benefits;
        break;
        
      case 'resource':
        // Price accessibility (free is best for early stage)
        if (item.price_type === 'free') totalScore += 100 * weights.price_accessibility;
        else if (item.price_type === 'freemium') totalScore += 75 * weights.price_accessibility;
        else if (item.price_amount < 100) totalScore += 50 * weights.price_accessibility;
        // Recency (updated in last 6 months)
        if (item.last_updated) {
          const monthsSinceUpdate = this.getAgeInMonths(item.last_updated);
          if (monthsSinceUpdate < 1) totalScore += 100 * weights.recency;
          else if (monthsSinceUpdate < 3) totalScore += 70 * weights.recency;
          else if (monthsSinceUpdate < 6) totalScore += 40 * weights.recency;
        }
        // Credibility
        const credText = item.provider_credibility || '';
        if (credText.includes('YC') || credText.includes('Y Combinator')) totalScore += 50 * weights.credibility;
        if (credText.includes('a16z') || credText.includes('Andreessen')) totalScore += 50 * weights.credibility;
        // Relevance to early-stage
        if (item.category === 'smart-contracts' || item.category === 'fundraising') {
          totalScore += 100 * weights.relevance;
        }
        // Usefulness
        const useful = this.assessUsefulness(item);
        totalScore += useful * weights.usefulness;
        // Quality (success stories)
        if (item.success_stories?.length > 0) totalScore += 100 * weights.quality;
        break;
    }
    
    return Math.round(totalScore);
  }
  
  // Helper methods
  private getCriteria(type: 'project' | 'funding' | 'resource'): ContentCriteria {
    switch (type) {
      case 'project': return PROJECT_CRITERIA;
      case 'funding': return FUNDING_CRITERIA;
      case 'resource': return RESOURCE_CRITERIA;
    }
  }
  
  private hasField(item: any, field: string): boolean {
    if (field.includes('_or_')) {
      const fields = field.split('_or_');
      return fields.some(f => item[f]);
    }
    return !!item[field];
  }
  
  private daysUntilDeadline(deadline: string): number {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diff = deadlineDate.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }
  
  private getAgeInDays(date?: string): number {
    if (!date) return 999;
    const created = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  private getAgeInMonths(date?: string): number {
    if (!date) return 999;
    const created = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }
  
  private assessUsefulness(item: any): number {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    let score = 50; // Base score
    
    // High-value keywords for early-stage founders
    const valuable = [
      'free', 'open source', 'startup', 'founder',
      'fundraising', 'smart contract', 'web3', 'blockchain',
      'beginner', 'tutorial', 'complete guide', 'best practices'
    ];
    valuable.forEach(keyword => {
      if (text.includes(keyword)) score += 5;
    });
    
    return Math.min(100, score);
  }
  
  private isRecent2025Activity(date: string): boolean {
    const activityDate = new Date(date);
    const now = new Date();
    const daysSince = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince < 90 && activityDate.getFullYear() >= 2024;
  }
  
  private isRecentlyUpdated(date: string): boolean {
    const updateDate = new Date(date);
    const now = new Date();
    const monthsSince = (now.getTime() - updateDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return monthsSince < 6;
  }
}

export const contentTypeDetector = new ContentTypeDetector();