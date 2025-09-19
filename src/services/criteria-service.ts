/**
 * Dynamic Criteria Service
 * Allows admin-editable content criteria with database persistence
 */

import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase-client';

export interface CriteriaConfig {
  id?: string;
  type: 'project' | 'funding' | 'resource';
  name: string;
  description: string;
  version: number;
  active: boolean;
  
  // Dynamic fields that can be edited
  required_fields: string[];
  scoring_weights: Record<string, number>;
  validation_rules: Record<string, any>;
  enrichment_priorities: string[];
  
  // Metadata
  created_at?: Date;
  updated_at?: Date;
  updated_by?: string;
}

export interface CriteriaRule {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'between' | 'in_list';
  value: any;
  weight?: number;
  required?: boolean;
}

class CriteriaService {
  private cache: Map<string, CriteriaConfig> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastFetch = 0;

  /**
   * Get active criteria for a content type
   */
  async getCriteria(type: 'project' | 'funding' | 'resource'): Promise<CriteriaConfig> {
    // Check cache first
    if (this.isCacheValid()) {
      const cached = this.cache.get(type);
      if (cached) {return cached;}
    }

    // Fetch from database
    const { data, error } = await supabase
      // DISABLED: Table 'content_criteria' doesn't exist

      .from('content_criteria')
      .select('*')
      .eq('type', type)
      .eq('active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single() as any || { data: [], error: null };

    if (error || !data) {
      // Return default criteria if none in database
      return this.getDefaultCriteria(type);
    }

    // Update cache
    this.cache.set(type, data);
    this.lastFetch = Date.now();

    return data;
  }

  /**
   * Get all criteria configurations
   */
  async getAllCriteria(): Promise<CriteriaConfig[]> {
    const { data, error } = await supabase
      // DISABLED: Table 'content_criteria' doesn't exist

      .from('content_criteria')
      .select('*')
      .eq('active', true)
      .order('type', { ascending: true }) as any || { data: [], error: null };

    if (error || !data) {
      return [
        this.getDefaultCriteria('project'),
        this.getDefaultCriteria('funding'),
        this.getDefaultCriteria('resource')
      ];
    }

    return data;
  }

  /**
   * Update criteria (admin only)
   */
  async updateCriteria(
    type: 'project' | 'funding' | 'resource',
    updates: Partial<CriteriaConfig>,
    userId: string
  ): Promise<CriteriaConfig> {
    // Get current criteria
    const current = await this.getCriteria(type);
    
    // Create new version
    const newCriteria: CriteriaConfig = {
      ...current,
      ...updates,
      type,
      version: (current.version || 0) + 1,
      updated_at: new Date(),
      updated_by: userId
    };

    // Validate criteria
    this.validateCriteria(newCriteria);

    // Save to database
    const { data, error } = await supabase
      // DISABLED: Table 'content_criteria' doesn't exist

      .from('content_criteria')
      .insert(newCriteria as any)
      .select()
      .single() as any || { then: () => Promise.resolve({ data: null, error: null }) };

    if (error) {
      throw new Error(`Failed to update criteria: ${error.message}`);
    }

    // Clear cache
    this.cache.delete(type);

    return data;
  }

  /**
   * Validate criteria configuration
   */
  private validateCriteria(criteria: CriteriaConfig): void {
    // Check required fields
    if (!criteria.type || !criteria.name) {
      throw new Error('Criteria must have type and name');
    }

    // Validate scoring weights sum to 1
    const weightSum = Object.values(criteria.scoring_weights).reduce((a, b) => a + b, 0);
    if (Math.abs(weightSum - 1) > 0.01) {
      throw new Error('Scoring weights must sum to 1.0');
    }

    // Validate required fields are reasonable
    if (criteria.required_fields.length === 0) {
      throw new Error('At least one required field must be specified');
    }

    // Validate enrichment priorities
    if (criteria.enrichment_priorities.length === 0) {
      throw new Error('At least one enrichment priority must be specified');
    }
  }

  /**
   * Get default criteria for type
   */
  private getDefaultCriteria(type: 'project' | 'funding' | 'resource'): CriteriaConfig {
    const defaults: Record<string, CriteriaConfig> = {
      project: {
        type: 'project',
        name: 'Early-Stage Startups',
        description: 'Web3 startups launched 2024+, <$500k funding, ≤10 team members',
        version: 1,
        active: true,
        required_fields: ['title', 'description', 'url', 'team_size', 'launch_date'],
        scoring_weights: {
          recency: 0.30,
          team_size: 0.20,
          funding_stage: 0.15,
          validation: 0.15,
          traction: 0.10,
          needs: 0.10
        },
        validation_rules: {
          min_team_size: 1,
          max_team_size: 10,
          max_funding: 500000,
          min_launch_year: 2024,
          min_description_length: 500,
          max_age_days: 30,
          exclude_corporate: true
        },
        enrichment_priorities: [
          'github_data',
          'team_linkedin',
          'funding_history',
          'social_metrics',
          'product_metrics'
        ]
      },
      funding: {
        type: 'funding',
        name: 'Active Funding Programs',
        description: 'Grants, incubators, accelerators with 2025 activity',
        version: 1,
        active: true,
        required_fields: ['program_name', 'description', 'funding_amount', 'application_url', 'eligibility'],
        scoring_weights: {
          deadline_urgency: 0.30,
          accessibility: 0.20,
          amount_fit: 0.15,
          recent_activity: 0.20,
          benefits: 0.15
        },
        validation_rules: {
          min_funding_amount: 1000,
          max_funding_amount: 10000000,
          min_description_length: 500,
          must_be_active: true,
          requires_2025_activity: true
        },
        enrichment_priorities: [
          'funder_profile',
          'portfolio_companies',
          'success_stories',
          'application_tips',
          'contact_info'
        ]
      },
      resource: {
        type: 'resource',
        name: 'Founder Resources',
        description: 'Tools, education, communities for early-stage teams',
        version: 1,
        active: true,
        required_fields: ['title', 'description', 'url', 'category', 'resource_type'],
        scoring_weights: {
          price_accessibility: 0.20,
          recency: 0.15,
          credibility: 0.10,
          relevance: 0.10,
          usefulness: 0.30,
          quality: 0.15
        },
        validation_rules: {
          min_description_length: 500,
          valid_categories: ['infrastructure', 'educational', 'tools', 'communities'],
          max_age_months: 6,
          must_help_early_stage: true
        },
        enrichment_priorities: [
          'documentation_quality',
          'user_reviews',
          'github_stats',
          'pricing_info',
          'alternatives'
        ]
      }
    };

    return defaults[type] || defaults.project;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastFetch < this.cacheTimeout;
  }

  /**
   * Clear criteria cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastFetch = 0;
  }

  /**
   * Score content based on dynamic criteria
   */
  async scoreContent(item: any, type: 'project' | 'funding' | 'resource'): Promise<number> {
    const criteria = await this.getCriteria(type);
    let totalScore = 0;

    // Apply scoring weights dynamically
    for (const [factor, weight] of Object.entries(criteria.scoring_weights)) {
      const factorScore = this.calculateFactorScore(item, factor, type, criteria.validation_rules);
      totalScore += factorScore * weight;
    }

    return Math.round(Math.min(100, totalScore));
  }

  /**
   * Calculate score for a specific factor
   */
  private calculateFactorScore(
    item: any,
    factor: string,
    type: string,
    rules: Record<string, any>
  ): number {
    // Generic scoring logic that works with any factor
    switch (factor) {
      case 'recency':
        if (!item.launch_date && !item.created_at) {return 0;}
        const ageMonths = this.getAgeInMonths(item.launch_date || item.created_at);
        if (ageMonths < 3) {return 100;}
        if (ageMonths < 6) {return 70;}
        if (ageMonths < 12) {return 40;}
        return 20;

      case 'team_size':
        if (!item.team_size) {return 0;}
        if (item.team_size <= 3) {return 100;}
        if (item.team_size <= 5) {return 75;}
        if (item.team_size <= 10) {return 50;}
        return 0;

      case 'funding_stage':
        if (item.funding_raised === undefined) {return 0;}
        if (item.funding_raised === 0) {return 100;}
        if (item.funding_raised < 100000) {return 70;}
        if (item.funding_raised < rules.max_funding) {return 40;}
        return 0;

      case 'validation':
        let score = 0;
        if (item.grant_participation?.length > 0) {score += 50;}
        if (item.incubator_participation?.length > 0) {score += 50;}
        return score;

      case 'traction':
        let tScore = 0;
        if (item.metrics?.users > 100) {tScore += 50;}
        if (item.metrics?.github_stars > 50) {tScore += 50;}
        return tScore;

      case 'deadline_urgency':
        if (!item.deadline) {return 50;} // Rolling basis
        const daysLeft = this.getDaysUntil(item.deadline);
        if (daysLeft > 7 && daysLeft < 30) {return 100;}
        if (daysLeft < 60) {return 70;}
        return 30;

      case 'accessibility':
        if (!item.equity_required) {return 100;}
        if (item.equity_percentage < 7) {return 50;}
        return 20;

      case 'price_accessibility':
        if (item.price_type === 'free') {return 100;}
        if (item.price_type === 'freemium') {return 75;}
        if (item.price_amount < 100) {return 50;}
        return 20;

      case 'amount_fit':
        // For funding programs - sweet spot is $10k-$100k
        if (!item.min_amount && !item.max_amount) {return 50;}
        if (item.min_amount <= 10000 && item.max_amount >= 100000) {return 100;}
        if (item.max_amount >= 50000) {return 70;}
        if (item.max_amount >= 25000) {return 50;}
        return 30;

      case 'recent_activity':
        // For funding programs - must show 2025 activity
        if (!item.last_investment_date) {return 0;}
        const daysSinceInvestment = this.getDaysSince(item.last_investment_date);
        if (daysSinceInvestment < 30) {return 100;}
        if (daysSinceInvestment < 60) {return 70;}
        if (daysSinceInvestment < 90) {return 40;}
        return 10;

      case 'benefits':
        // Extra benefits beyond funding
        let benefitScore = 0;
        if (item.benefits?.includes('mentorship')) {benefitScore += 30;}
        if (item.benefits?.includes('network')) {benefitScore += 30;}
        if (item.benefits?.includes('workspace')) {benefitScore += 20;}
        if (item.benefits?.includes('credits')) {benefitScore += 20;}
        return Math.min(100, benefitScore);

      case 'needs':
        // For projects - actively seeking help
        let needsScore = 0;
        if (item.project_needs?.includes('funding')) {needsScore += 40;}
        if (item.project_needs?.includes('co-founder')) {needsScore += 60;}
        if (item.project_needs?.includes('developers')) {needsScore += 40;}
        if (item.project_needs?.includes('marketing')) {needsScore += 30;}
        return Math.min(100, needsScore);

      case 'credibility':
        // For resources - provider reputation
        const providerText = (item.provider_credibility || '').toLowerCase();
        let credScore = 0;
        if (providerText.includes('yc') || providerText.includes('y combinator')) {credScore += 40;}
        if (providerText.includes('a16z') || providerText.includes('andreessen')) {credScore += 40;}
        if (providerText.includes('sequoia')) {credScore += 30;}
        if (providerText.includes('google')) {credScore += 20;}
        if (providerText.includes('microsoft')) {credScore += 20;}
        return Math.min(100, credScore);

      case 'relevance':
        // For resources - relevance to early-stage founders
        const category = item.category || '';
        if (category === 'smart-contracts' || category === 'fundraising') {return 100;}
        if (category === 'infrastructure' || category === 'educational') {return 80;}
        if (category === 'tools' || category === 'communities') {return 60;}
        return 30;

      case 'usefulness':
        // For resources - practical value
        const description = (item.description || '').toLowerCase();
        let usefulScore = 50; // Base score
        if (description.includes('free')) {usefulScore += 20;}
        if (description.includes('open source')) {usefulScore += 20;}
        if (description.includes('tutorial') || description.includes('guide')) {usefulScore += 15;}
        if (description.includes('beginner')) {usefulScore += 15;}
        if (description.includes('startup') || description.includes('founder')) {usefulScore += 10;}
        return Math.min(100, usefulScore);

      case 'quality':
        // For resources - quality indicators
        let qualityScore = 0;
        if (item.documentation_quality === 'excellent') {qualityScore += 40;}
        if (item.github_stars > 1000) {qualityScore += 30;}
        else if (item.github_stars > 100) {qualityScore += 20;}
        if (item.success_stories?.length > 0) {qualityScore += 30;}
        if (item.user_reviews?.average_rating > 4) {qualityScore += 30;}
        return Math.min(100, qualityScore);

      default:
        // Generic scoring for unknown factors
        return item[factor] ? 50 : 0;
    }
  }

  // Helper methods
  private getAgeInMonths(date: string): number {
    const created = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
  }

  private getDaysUntil(date: string): number {
    const deadline = new Date(date);
    const now = new Date();
    return Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private getDaysSince(date: string): number {
    const past = new Date(date);
    const now = new Date();
    return Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24));
  }
}

export const criteriaService = new CriteriaService();