/**
 * FUNDING PROGRAM EXTRACTOR
 * Extracts critical funding opportunity metadata
 * Focus: Active 2024+ programs with clear application processes
 */

export interface FundingProgramMetadata {
  // CORE PROGRAM INFO
  program_name: string;
  organization: string;
  funding_type: 'grant' | 'investment' | 'accelerator' | 'competition';
  
  // FUNDING AMOUNTS
  min_amount?: number;
  max_amount?: number;
  currency?: string;
  equity_required?: boolean;
  equity_percentage?: number;
  
  // DEADLINES & TIMING
  application_deadline?: string;
  program_start_date?: string;
  decision_timeline?: string;
  is_rolling?: boolean;
  
  // ELIGIBILITY
  stage_preferences?: string[];
  sector_focus?: string[];
  geographic_restrictions?: string[];
  eligibility_criteria?: string[];
  
  // PROGRAM DETAILS
  program_duration?: string;
  program_location?: string;
  is_remote?: boolean;
  cohort_size?: number;
  
  // ACTIVITY VERIFICATION
  last_investment_date?: string;
  total_deployed_2024?: number;
  total_deployed_2025?: number;
  is_active?: boolean;
  
  // BENEFITS
  provides_mentorship?: boolean;
  provides_workspace?: boolean;
  provides_cloud_credits?: boolean;
  additional_benefits?: string[];
}

export class FundingProgramExtractor {
  /**
   * Extract funding amounts from text
   */
  static extractFundingAmounts(text: string): {
    min: number | undefined;
    max: number | undefined;
    currency: string;
  } {
    const normalized = text.toLowerCase();
    
    // Pattern matching for amounts
    const patterns = {
      range: /\$?([\d,]+)\s*(?:k|m)?\s*(?:-|to|–)\s*\$?([\d,]+)\s*(?:k|m)?/i,
      upTo: /up\s+to\s+\$?([\d,]+)\s*(?:k|m)?/i,
      fixed: /\$?([\d,]+)\s*(?:k|m)?\s+(?:grant|funding|investment)/i,
    };
    
    let min: number | undefined;
    let max: number | undefined;
    let currency = 'USD';
    
    // Check for range
    const rangeMatch = normalized.match(patterns.range);
    if (rangeMatch) {
      min = this.parseAmount(rangeMatch[1]);
      max = this.parseAmount(rangeMatch[2]);
      
      // Detect k/m suffixes
      if (normalized.includes(`${rangeMatch[1]}k`)) min = (min || 0) * 1000;
      if (normalized.includes(`${rangeMatch[2]}k`)) max = (max || 0) * 1000;
      if (normalized.includes(`${rangeMatch[1]}m`)) min = (min || 0) * 1000000;
      if (normalized.includes(`${rangeMatch[2]}m`)) max = (max || 0) * 1000000;
    }
    
    // Check for "up to" pattern
    const upToMatch = normalized.match(patterns.upTo);
    if (upToMatch && !max) {
      max = this.parseAmount(upToMatch[1]);
      if (normalized.includes(`${upToMatch[1]}k`)) max = (max || 0) * 1000;
      if (normalized.includes(`${upToMatch[1]}m`)) max = (max || 0) * 1000000;
      min = 0; // Assume starts from 0
    }
    
    // Check for currency
    if (normalized.includes('€') || normalized.includes('eur')) currency = 'EUR';
    if (normalized.includes('£') || normalized.includes('gbp')) currency = 'GBP';
    
    return { min, max, currency };
  }
  
  /**
   * Parse amount string to number
   */
  private static parseAmount(str: string): number | undefined {
    const cleaned = str.replace(/[,$]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }
  
  /**
   * Extract deadline from text
   */
  static extractDeadline(text: string): string | undefined {
    const normalized = text.toLowerCase();
    
    // Date patterns
    const patterns = [
      /deadline[:\s]+([a-z]+ \d{1,2},? \d{4})/i,
      /applications? (?:close|due|end)[:\s]+([a-z]+ \d{1,2},? \d{4})/i,
      /by ([a-z]+ \d{1,2},? \d{4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            return date.toISOString();
          }
        } catch {}
      }
    }
    
    // Check for rolling/ongoing
    if (normalized.includes('rolling') || normalized.includes('ongoing')) {
      return 'rolling';
    }
    
    return undefined;
  }
  
  /**
   * Extract stage preferences
   */
  static extractStagePreferences(text: string): string[] {
    const normalized = text.toLowerCase();
    const stages: string[] = [];
    
    const stageKeywords = {
      'pre-seed': ['pre-seed', 'preseed', 'pre seed'],
      'seed': ['seed stage', 'seed-stage', 'seed'],
      'series-a': ['series a', 'series-a'],
      'early-stage': ['early stage', 'early-stage'],
      'mvp': ['mvp', 'prototype'],
      'idea': ['idea stage', 'ideation'],
    };
    
    for (const [stage, keywords] of Object.entries(stageKeywords)) {
      if (keywords.some(kw => normalized.includes(kw))) {
        stages.push(stage);
      }
    }
    
    return stages;
  }
  
  /**
   * Extract sector focus
   */
  static extractSectorFocus(text: string): string[] {
    const normalized = text.toLowerCase();
    const sectors: string[] = [];
    
    const sectorKeywords = {
      'web3': ['web3', 'blockchain', 'crypto', 'defi', 'nft'],
      'ai': ['artificial intelligence', 'ai', 'machine learning', 'ml'],
      'climate': ['climate', 'sustainability', 'cleantech', 'green'],
      'fintech': ['fintech', 'financial technology', 'payments'],
      'healthtech': ['healthtech', 'healthcare', 'medical', 'biotech'],
      'edtech': ['edtech', 'education technology', 'learning'],
      'saas': ['saas', 'software as a service', 'b2b'],
      'consumer': ['consumer', 'b2c', 'marketplace'],
      'deeptech': ['deep tech', 'deeptech', 'hardware'],
    };
    
    for (const [sector, keywords] of Object.entries(sectorKeywords)) {
      if (keywords.some(kw => normalized.includes(kw))) {
        sectors.push(sector);
      }
    }
    
    return sectors;
  }
  
  /**
   * Extract geographic restrictions
   */
  static extractGeographicRestrictions(text: string): string[] {
    const normalized = text.toLowerCase();
    const locations: string[] = [];
    
    // Check for global/no restrictions
    if (normalized.includes('global') || normalized.includes('worldwide')) {
      return ['global'];
    }
    
    // Common regions
    const regions = {
      'us': ['united states', 'usa', 'u.s.', 'america'],
      'eu': ['europe', 'european union', 'eu'],
      'uk': ['united kingdom', 'uk', 'britain'],
      'asia': ['asia', 'asian'],
      'africa': ['africa', 'african'],
      'latam': ['latin america', 'latam', 'south america'],
    };
    
    for (const [region, keywords] of Object.entries(regions)) {
      if (keywords.some(kw => normalized.includes(kw))) {
        locations.push(region);
      }
    }
    
    return locations;
  }
  
  /**
   * Determine if program is currently active
   */
  static isActive(item: any): boolean {
    // Check deadline
    if (item.application_deadline) {
      const deadline = new Date(item.application_deadline);
      if (deadline < new Date()) return false;
    }
    
    // Check last activity
    if (item.last_investment_date) {
      const lastActive = new Date(item.last_investment_date);
      const monthsAgo = (Date.now() - lastActive.getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (monthsAgo > 6) return false; // Inactive if no activity in 6 months
    }
    
    // Check explicit status
    if (item.status === 'closed' || item.status === 'inactive') return false;
    
    return true;
  }
  
  /**
   * Extract benefits from text
   */
  static extractBenefits(text: string): string[] {
    const normalized = text.toLowerCase();
    const benefits: string[] = [];
    
    const benefitKeywords = {
      'mentorship': ['mentor', 'mentorship', 'advisor'],
      'workspace': ['office', 'workspace', 'coworking'],
      'cloud_credits': ['cloud credits', 'aws credits', 'gcp credits', 'azure credits'],
      'legal_support': ['legal support', 'legal services'],
      'marketing_support': ['marketing support', 'pr support'],
      'networking': ['networking', 'network access', 'connections'],
      'demo_day': ['demo day', 'pitch day', 'investor day'],
      'curriculum': ['curriculum', 'workshops', 'training'],
    };
    
    for (const [benefit, keywords] of Object.entries(benefitKeywords)) {
      if (keywords.some(kw => normalized.includes(kw))) {
        benefits.push(benefit);
      }
    }
    
    return benefits;
  }
  
  /**
   * Main extraction function for funding programs
   */
  static extractFromContent(item: any): FundingProgramMetadata {
    const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`;
    const amounts = this.extractFundingAmounts(text);
    
    return {
      program_name: item.title || item.name || 'Unknown Program',
      organization: item.organization || item.author || item.source || 'Unknown',
      funding_type: this.determineFundingType(text),
      
      // Amounts
      min_amount: amounts.min,
      max_amount: amounts.max,
      currency: amounts.currency,
      equity_required: text.toLowerCase().includes('equity'),
      equity_percentage: this.extractEquityPercentage(text),
      
      // Timing
      application_deadline: this.extractDeadline(text),
      is_rolling: text.toLowerCase().includes('rolling'),
      
      // Eligibility
      stage_preferences: this.extractStagePreferences(text),
      sector_focus: this.extractSectorFocus(text),
      geographic_restrictions: this.extractGeographicRestrictions(text),
      
      // Program details
      is_remote: text.toLowerCase().includes('remote') || 
                text.toLowerCase().includes('virtual'),
      
      // Activity
      is_active: this.isActive(item),
      
      // Benefits
      provides_mentorship: text.toLowerCase().includes('mentor'),
      provides_workspace: text.toLowerCase().includes('office') || 
                         text.toLowerCase().includes('workspace'),
      provides_cloud_credits: text.toLowerCase().includes('credits'),
      additional_benefits: this.extractBenefits(text),
    };
  }
  
  /**
   * Determine funding type from text
   */
  private static determineFundingType(text: string): FundingProgramMetadata['funding_type'] {
    const normalized = text.toLowerCase();
    
    if (normalized.includes('grant')) return 'grant';
    if (normalized.includes('accelerator')) return 'accelerator';
    if (normalized.includes('competition') || normalized.includes('prize')) return 'competition';
    
    return 'investment';
  }
  
  /**
   * Extract equity percentage
   */
  private static extractEquityPercentage(text: string): number | undefined {
    const match = text.match(/(\d+(?:\.\d+)?)\s*%\s*equity/i);
    if (match) {
      return parseFloat(match[1]);
    }
    return undefined;
  }
  
  /**
   * Validate funding program is worth including
   */
  static isHighQualityProgram(meta: FundingProgramMetadata): boolean {
    // Must be active
    if (!meta.is_active) return false;
    
    // Must have clear amounts or be a known program
    if (!meta.max_amount && !meta.program_name.includes('Combinator')) return false;
    
    // Must have deadline or be rolling
    if (!meta.application_deadline && !meta.is_rolling) return false;
    
    // Should have some eligibility criteria
    if (!meta.stage_preferences?.length && 
        !meta.sector_focus?.length && 
        !meta.geographic_restrictions?.length) {
      return false;
    }
    
    return true;
  }
}