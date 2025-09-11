/**
 * Comprehensive Funding Program Data Extractor
 * Extracts ALL required fields for the queue_funding_programs table
 */

// No external dependencies - using native Date

export interface RawFundingData {
  [key: string]: any;
}

export interface ExtractedFunding {
  // Basic Information
  name: string;
  organization: string;
  description: string;
  url: string;
  
  // Funding Details
  funding_type: 'grant' | 'accelerator' | 'incubator' | 'vc' | 'angel' | 'dao';
  min_amount: number;
  max_amount: number;
  currency: string;
  total_fund_size?: number;
  
  // Investment Terms
  equity_required: boolean;
  equity_percentage_min?: number;
  equity_percentage_max?: number;
  token_allocation?: boolean;
  token_percentage?: number;
  
  // Application Details
  application_url: string;
  application_deadline?: string; // ISO date
  application_process_description: string;
  decision_timeline_days?: number;
  next_cohort_start?: string;
  
  // Eligibility
  eligibility_criteria: string[];
  geographic_focus?: string[];
  excluded_countries?: string[];
  stage_preferences: string[];
  sector_focus: string[];
  
  // Program Details
  program_duration_weeks?: number;
  program_location?: string;
  remote_friendly?: boolean;
  cohort_size?: number;
  acceptance_rate?: number;
  
  // Benefits and Support
  benefits: string[];
  mentor_profiles?: string[];
  partner_perks?: string[];
  office_hours?: boolean;
  demo_day?: boolean;
  
  // Track Record
  founded_year?: number;
  total_investments_made?: number;
  notable_portfolio_companies?: string[];
  successful_exits?: string[];
  
  // Recent Activity
  last_investment_date: string;
  recent_investments: string[];
  active_status: boolean;
  
  // Contact Information
  contact_email?: string;
  contact_name?: string;
  contact_linkedin?: string;
  twitter_url?: string;
  
  // Data Quality
  data_completeness_score: number;
  enrichment_sources: string[];
}

export class FundingExtractor {
  /**
   * Extract comprehensive funding data from various sources
   */
  extract(raw: RawFundingData, source: string): ExtractedFunding | null {
    try {
      switch (source.toLowerCase()) {
        case 'gitcoin':
          return this.extractFromGitcoin(raw);
        case 'grants':
          return this.extractFromGrantsPlatform(raw);
        case 'accelerator':
          return this.extractFromAccelerator(raw);
        case 'vc':
          return this.extractFromVC(raw);
        case 'ecosystem':
          return this.extractFromEcosystem(raw);
        default:
          return this.extractGeneric(raw, source);
      }
    } catch (error) {
      console.error(`Failed to extract funding from ${source}:`, error);
      return null;
    }
  }

  /**
   * Extract from Gitcoin grants data
   */
  private extractFromGitcoin(raw: any): ExtractedFunding {
    const roundEndDate = raw.round_end_date || raw.application_end_date;
    const matchingPool = raw.matching_pool || raw.total_pool || 100000;
    
    return {
      name: raw.name || raw.round_name || 'Gitcoin Grant Round',
      organization: 'Gitcoin',
      description: this.expandFundingDescription(raw.description || raw.round_description),
      url: raw.url || `https://gitcoin.co/grants/${raw.id}`,
      
      funding_type: 'grant',
      min_amount: raw.min_contribution || 1,
      max_amount: raw.max_contribution || matchingPool / 10,
      currency: raw.token || 'USD',
      total_fund_size: matchingPool,
      
      equity_required: false,
      
      application_url: raw.application_url || raw.url,
      application_deadline: roundEndDate,
      application_process_description: this.generateGrantApplicationProcess(),
      decision_timeline_days: 30,
      
      eligibility_criteria: this.extractGitcoinEligibility(raw),
      stage_preferences: ['pre-seed', 'seed', 'bootstrapped'],
      sector_focus: raw.categories || ['Public Goods', 'Infrastructure', 'DeFi'],
      
      benefits: [
        'Quadratic funding matching',
        'Community visibility',
        'Network effects',
        'No equity dilution'
      ],
      
      founded_year: 2017,
      total_investments_made: raw.total_grants_funded || 1000,
      notable_portfolio_companies: raw.featured_projects || [],
      
      last_investment_date: raw.last_round_date || new Date().toISOString(),
      recent_investments: raw.recent_grants || ['Recent Grant 1', 'Recent Grant 2'],
      active_status: true,
      
      twitter_url: 'https://twitter.com/gitcoin',
      
      data_completeness_score: 0.8,
      enrichment_sources: ['gitcoin']
    };
  }

  /**
   * Extract from general grants platform
   */
  private extractFromGrantsPlatform(raw: any): ExtractedFunding {
    let amount = this.parseAmount(raw);
    
    // Handle specific grant platform formats
    if (raw.total_allocation) {
      const total = typeof raw.total_allocation === 'string' 
        ? this.parseMoneyString(raw.total_allocation) 
        : raw.total_allocation;
      amount.max = Math.max(amount.max, total / 50); // Assume max grant is 2% of pool
    }
    
    if (raw.median_grant) {
      const median = typeof raw.median_grant === 'string'
        ? this.parseMoneyString(raw.median_grant)
        : raw.median_grant;
      amount.min = Math.min(amount.min, median / 2);
      amount.max = Math.max(amount.max, median * 2);
    }
    
    if (raw.max_grant) {
      const max = typeof raw.max_grant === 'string'
        ? this.parseMoneyString(raw.max_grant)
        : raw.max_grant;
      amount.max = max;
    }
    
    return {
      name: raw.name || raw.round_name || raw.grant_name || raw.title || 'Grant Program',
      organization: raw.organization || raw.funder || raw.sponsor || 'Grant Organization',
      description: this.expandFundingDescription(raw.description || raw.about),
      url: raw.url || raw.apply_url || raw.website || 'https://example.com',
      
      funding_type: 'grant',
      min_amount: amount.min,
      max_amount: amount.max,
      currency: raw.token || raw.currency || 'USD',
      total_fund_size: raw.total_allocation || raw.total_fund || raw.pool_size,
      
      equity_required: false,
      
      application_url: raw.application_url || raw.apply_link || raw.url || raw.website || 'https://example.com/apply',
      application_deadline: this.parseDeadline(raw),
      application_process_description: raw.process || this.generateGrantApplicationProcess(),
      decision_timeline_days: raw.review_period || 45,
      
      eligibility_criteria: this.extractEligibility(raw),
      geographic_focus: raw.regions || raw.countries,
      stage_preferences: raw.stages || ['all'],
      sector_focus: this.extractSectors(raw),
      
      benefits: this.extractBenefits(raw),
      
      founded_year: raw.established || raw.founded,
      total_investments_made: raw.grants_given || raw.projects_funded,
      notable_portfolio_companies: raw.success_stories || raw.alumni,
      
      last_investment_date: raw.last_grant_date || new Date().toISOString(),
      recent_investments: this.extractRecentGrants(raw),
      active_status: raw.active !== false,
      
      contact_email: raw.contact || raw.email,
      twitter_url: raw.twitter || raw.social?.twitter,
      
      data_completeness_score: 0.7,
      enrichment_sources: ['grants_platform']
    };
  }

  /**
   * Extract from accelerator data
   */
  private extractFromAccelerator(raw: any): ExtractedFunding {
    const investment = this.parseAcceleratorInvestment(raw);
    
    return {
      name: raw.name || raw.program_name,
      organization: raw.accelerator || raw.organization,
      description: this.expandFundingDescription(raw.description),
      url: raw.url || raw.website,
      
      funding_type: 'accelerator',
      min_amount: investment.amount,
      max_amount: investment.amount,
      currency: 'USD',
      total_fund_size: raw.fund_size,
      
      equity_required: true,
      equity_percentage_min: investment.equity,
      equity_percentage_max: investment.equity,
      
      application_url: raw.apply_url || raw.application_link,
      application_deadline: raw.deadline || raw.close_date,
      application_process_description: this.generateAcceleratorProcess(raw),
      decision_timeline_days: raw.selection_timeline || 30,
      next_cohort_start: raw.cohort_start || raw.program_start,
      
      eligibility_criteria: this.extractAcceleratorEligibility(raw),
      geographic_focus: raw.locations || raw.target_regions,
      stage_preferences: ['pre-seed', 'seed'],
      sector_focus: raw.verticals || raw.focus_areas || ['Web3'],
      
      program_duration_weeks: raw.duration || 12,
      program_location: raw.location || 'Remote',
      remote_friendly: raw.remote || raw.virtual || false,
      cohort_size: raw.cohort_size || raw.batch_size || 10,
      acceptance_rate: raw.acceptance_rate || 5,
      
      benefits: this.extractAcceleratorBenefits(raw),
      mentor_profiles: raw.mentors || ['Industry Veterans', 'Successful Founders'],
      partner_perks: raw.perks || ['AWS Credits', 'Legal Services'],
      office_hours: true,
      demo_day: true,
      
      founded_year: raw.founded || raw.established_year,
      total_investments_made: raw.portfolio_size || raw.companies_accelerated,
      notable_portfolio_companies: raw.portfolio || raw.success_stories || [],
      successful_exits: raw.exits || [],
      
      last_investment_date: raw.last_cohort || new Date().toISOString(),
      recent_investments: raw.recent_portfolio || ['Recent Company 1'],
      active_status: true,
      
      contact_email: raw.contact || raw.admissions_email,
      twitter_url: raw.twitter,
      
      data_completeness_score: 0.85,
      enrichment_sources: ['accelerator']
    };
  }

  /**
   * Extract from VC data
   */
  private extractFromVC(raw: any): ExtractedFunding {
    const checkSize = this.parseVCCheckSize(raw);
    
    return {
      name: raw.name || raw.fund_name,
      organization: raw.firm || raw.vc_firm || raw.organization,
      description: this.expandFundingDescription(raw.thesis || raw.description),
      url: raw.website || raw.url,
      
      funding_type: 'vc',
      min_amount: checkSize.min,
      max_amount: checkSize.max,
      currency: 'USD',
      total_fund_size: raw.fund_size || raw.aum,
      
      equity_required: true,
      equity_percentage_min: raw.equity_range?.min || 10,
      equity_percentage_max: raw.equity_range?.max || 20,
      token_allocation: raw.token_investment || false,
      token_percentage: raw.token_allocation,
      
      application_url: raw.pitch_url || raw.contact_url || raw.website,
      application_process_description: this.generateVCProcess(),
      decision_timeline_days: raw.decision_time || 60,
      
      eligibility_criteria: this.extractVCCriteria(raw),
      geographic_focus: raw.geo_focus || raw.regions,
      stage_preferences: raw.stages || ['seed', 'series-a'],
      sector_focus: raw.sectors || raw.verticals || ['Web3', 'DeFi'],
      
      benefits: [
        'Strategic guidance',
        'Portfolio network',
        'Follow-on funding',
        'Board expertise'
      ],
      
      founded_year: raw.founded || raw.vintage_year,
      total_investments_made: raw.portfolio_count || raw.investments,
      notable_portfolio_companies: raw.portfolio || [],
      successful_exits: raw.exits || [],
      
      last_investment_date: raw.last_investment || new Date().toISOString(),
      recent_investments: raw.recent_deals || ['Recent Investment'],
      active_status: raw.actively_investing !== false,
      
      contact_email: raw.contact || raw.partner_email,
      contact_name: raw.partner || raw.managing_partner,
      twitter_url: raw.twitter,
      
      data_completeness_score: 0.75,
      enrichment_sources: ['vc']
    };
  }

  /**
   * Extract from ecosystem program data
   */
  private extractFromEcosystem(raw: any): ExtractedFunding {
    return {
      name: raw.name || raw.program,
      organization: raw.ecosystem || raw.chain || raw.protocol,
      description: this.expandFundingDescription(raw.description),
      url: raw.url || raw.website,
      
      funding_type: raw.type === 'grants' ? 'grant' : 'accelerator',
      min_amount: raw.min_grant || 10000,
      max_amount: raw.max_grant || 100000,
      currency: raw.token || 'USD',
      total_fund_size: raw.ecosystem_fund || raw.total_allocation,
      
      equity_required: false,
      token_allocation: true,
      token_percentage: raw.token_grant_percentage || 0,
      
      application_url: raw.apply_url || raw.grants_url,
      application_deadline: raw.deadline,
      application_process_description: raw.process || this.generateEcosystemProcess(),
      decision_timeline_days: 30,
      
      eligibility_criteria: [
        'Building on ' + (raw.chain || 'our ecosystem'),
        'Open source preferred',
        'Aligned with ecosystem goals'
      ],
      stage_preferences: ['all'],
      sector_focus: raw.categories || ['Infrastructure', 'DeFi', 'Tools'],
      
      benefits: [
        'Technical support',
        'Ecosystem integration',
        'Marketing support',
        'Token grants'
      ],
      
      founded_year: raw.launch_year,
      total_investments_made: raw.grants_distributed,
      notable_portfolio_companies: raw.notable_projects || [],
      
      last_investment_date: raw.last_grant || new Date().toISOString(),
      recent_investments: raw.recent_grants || ['Recent Ecosystem Grant'],
      active_status: true,
      
      twitter_url: raw.twitter,
      
      data_completeness_score: 0.7,
      enrichment_sources: ['ecosystem']
    };
  }

  /**
   * Generic extractor for unknown sources
   */
  private extractGeneric(raw: any, source: string): ExtractedFunding {
    const amount = this.parseAmount(raw);
    const fundingType = this.inferFundingType(raw);
    
    return {
      name: raw.name || raw.title || raw.program || 'Funding Opportunity',
      organization: raw.organization || raw.company || raw.funder || 'Unknown',
      description: this.expandFundingDescription(raw.description || raw.about),
      url: raw.url || raw.website || raw.link || '',
      
      funding_type: fundingType,
      min_amount: amount.min,
      max_amount: amount.max,
      currency: raw.currency || 'USD',
      
      equity_required: fundingType === 'vc' || fundingType === 'accelerator',
      
      application_url: raw.apply || raw.application || raw.url,
      application_deadline: this.parseDeadline(raw),
      application_process_description: this.generateGenericProcess(fundingType),
      
      eligibility_criteria: this.extractGenericEligibility(raw),
      stage_preferences: this.inferStagePreferences(raw, fundingType),
      sector_focus: this.extractGenericSectors(raw),
      
      benefits: this.extractGenericBenefits(raw, fundingType),
      
      last_investment_date: raw.last_update || new Date().toISOString(),
      recent_investments: ['Recent Investment'],
      active_status: true,
      
      data_completeness_score: 0.4,
      enrichment_sources: [source]
    };
  }

  // Helper methods

  private expandFundingDescription(desc: string): string {
    if (!desc) return 'A funding opportunity for innovative Web3 projects. This program supports builders creating the future of decentralized technology.';
    if (desc.length < 100) {
      return desc + ' This funding program aims to accelerate innovation in the Web3 ecosystem by providing capital and support to promising projects.';
    }
    return desc;
  }

  private parseAmount(raw: any): { min: number; max: number } {
    // Try various field names
    const minRaw = raw.min_amount || raw.min || raw.minimum || raw.grant_size_min || 5000;
    const maxRaw = raw.max_amount || raw.max || raw.maximum || raw.grant_size_max || minRaw * 10;
    
    // Parse both min and max
    const min = typeof minRaw === 'string' ? this.parseMoneyString(minRaw) : minRaw;
    const max = typeof maxRaw === 'string' ? this.parseMoneyString(maxRaw) : maxRaw;
    
    // Ensure max is at least min
    return { 
      min: min || 5000, 
      max: Math.max(max || min * 10, min) 
    };
  }

  private parseMoneyString(str: string): number {
    // Remove currency symbols first, then commas separately
    const cleaned = str
      .replace(/[$€£¥₹]/g, '') // Remove currency symbols
      .replace(/,/g, '')        // Remove commas separately
      .trim();
    
    // Handle K, M notation
    if (cleaned.endsWith('K') || cleaned.endsWith('k')) {
      const num = parseFloat(cleaned.slice(0, -1));
      return isNaN(num) ? 10000 : num * 1000;
    }
    if (cleaned.endsWith('M') || cleaned.endsWith('m')) {
      const num = parseFloat(cleaned.slice(0, -1));
      return isNaN(num) ? 100000 : num * 1000000;
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 10000 : parsed;
  }

  private parseDeadline(raw: any): string | undefined {
    const deadline = raw.deadline || raw.close_date || raw.application_deadline;
    if (!deadline) return undefined;
    
    try {
      if (typeof deadline === 'string') {
        return new Date(deadline).toISOString();
      }
      return deadline;
    } catch {
      // If deadline is "rolling" or similar
      return undefined;
    }
  }

  private inferFundingType(raw: any): ExtractedFunding['funding_type'] {
    const text = JSON.stringify(raw).toLowerCase();
    
    if (text.includes('grant')) return 'grant';
    if (text.includes('accelerat')) return 'accelerator';
    if (text.includes('incubat')) return 'incubator';
    if (text.includes('venture') || text.includes(' vc ')) return 'vc';
    if (text.includes('angel')) return 'angel';
    if (text.includes('dao')) return 'dao';
    
    return 'grant'; // Default to grant
  }

  private extractEligibility(raw: any): string[] {
    const criteria = [];
    
    // From explicit fields
    if (raw.eligibility) {
      if (Array.isArray(raw.eligibility)) {
        criteria.push(...raw.eligibility);
      } else {
        criteria.push(raw.eligibility);
      }
    }
    
    if (raw.requirements) {
      criteria.push(...(Array.isArray(raw.requirements) ? raw.requirements : [raw.requirements]));
    }
    
    // Infer from other fields
    if (raw.min_team_size) criteria.push(`Team size >= ${raw.min_team_size}`);
    if (raw.min_traction) criteria.push(`Traction: ${raw.min_traction}`);
    if (raw.tech_requirements) criteria.push(`Tech: ${raw.tech_requirements}`);
    
    return criteria.length > 0 ? criteria : ['Open to all qualifying projects'];
  }

  private extractSectors(raw: any): string[] {
    const sectors = [];
    const possibleFields = ['sectors', 'verticals', 'focus_areas', 'categories', 'themes'];
    
    for (const field of possibleFields) {
      if (raw[field]) {
        if (Array.isArray(raw[field])) {
          sectors.push(...raw[field]);
        } else {
          sectors.push(raw[field]);
        }
      }
    }
    
    return sectors.length > 0 ? sectors : ['Web3', 'DeFi', 'Infrastructure'];
  }

  private extractBenefits(raw: any): string[] {
    if (raw.benefits && Array.isArray(raw.benefits)) {
      return raw.benefits;
    }
    
    const benefits = [];
    
    // Check for specific benefits
    if (raw.mentorship) benefits.push('Mentorship');
    if (raw.network) benefits.push('Network access');
    if (raw.marketing) benefits.push('Marketing support');
    if (raw.technical_support) benefits.push('Technical support');
    if (raw.office_space) benefits.push('Office space');
    if (raw.credits) benefits.push('Cloud credits');
    
    return benefits.length > 0 ? benefits : ['Funding', 'Support', 'Network'];
  }

  private generateGrantApplicationProcess(): string {
    return 'Submit application form with project details, team information, and funding requirements. Applications are reviewed on a rolling basis or during specific rounds. Successful applicants receive funding without equity dilution.';
  }

  private generateAcceleratorProcess(raw: any): string {
    const duration = raw.duration || '3 months';
    return `Apply through online form, followed by interviews with selection committee. Accepted teams join a ${duration} program with mentorship, workshops, and demo day. Investment terms are standardized for all participants.`;
  }

  private generateVCProcess(): string {
    return 'Initial pitch deck submission, followed by partner meeting, due diligence process, and term sheet negotiation. Timeline varies but typically 4-8 weeks from first contact to funding.';
  }

  private generateEcosystemProcess(): string {
    return 'Submit proposal through ecosystem grants portal. Technical review by ecosystem team, followed by community feedback period. Approved projects receive milestone-based funding.';
  }

  private generateGenericProcess(type: string): string {
    const processes: Record<string, string> = {
      'grant': 'Submit application with project details and budget. Review by selection committee.',
      'accelerator': 'Apply for cohort, interview process, intensive program with demo day.',
      'vc': 'Pitch deck, meetings, due diligence, term sheet negotiation.',
      'incubator': 'Application, selection, long-term support program.',
      'angel': 'Direct pitch to angel investor or syndicate.',
      'dao': 'Submit proposal for DAO governance vote.'
    };
    
    return processes[type] || 'Standard application and review process.';
  }

  private extractGitcoinEligibility(raw: any): string[] {
    return [
      'Open source project',
      'Public goods focus',
      'No prior rug pulls',
      'Active development',
      raw.specific_requirements || 'Aligned with round goals'
    ];
  }

  private parseAcceleratorInvestment(raw: any): { amount: number; equity: number } {
    // Handle various formats for investment amount
    let amount = raw.investment_amount || raw.investment || raw.funding || 100000;
    if (typeof amount === 'string') {
      amount = this.parseMoneyString(amount);
    }
    
    // Handle equity percentage
    let equity = raw.equity_percentage || raw.equity || raw.equity_take || 7;
    if (typeof equity === 'string') {
      equity = parseFloat(equity.replace('%', ''));
    }
    
    return { amount, equity };
  }

  private extractAcceleratorEligibility(raw: any): string[] {
    const criteria = ['Early-stage startup'];
    
    if (raw.requirements) {
      criteria.push(...(Array.isArray(raw.requirements) ? raw.requirements : [raw.requirements]));
    }
    
    if (raw.min_team) criteria.push(`Minimum ${raw.min_team} team members`);
    if (raw.product_stage) criteria.push(`Product: ${raw.product_stage}`);
    
    return criteria;
  }

  private extractAcceleratorBenefits(raw: any): string[] {
    return [
      `$${raw.investment || 100000} investment`,
      'Mentorship from industry experts',
      'Demo day with investors',
      'Alumni network access',
      ...(raw.additional_benefits || [])
    ];
  }

  private parseVCCheckSize(raw: any): { min: number; max: number } {
    if (raw.check_size) {
      if (typeof raw.check_size === 'object') {
        return { min: raw.check_size.min, max: raw.check_size.max };
      }
      return { min: raw.check_size, max: raw.check_size * 2 };
    }
    
    // Infer from stage
    if (raw.stage === 'seed') {
      return { min: 500000, max: 2000000 };
    }
    if (raw.stage === 'series-a') {
      return { min: 2000000, max: 10000000 };
    }
    
    return { min: 100000, max: 1000000 };
  }

  private extractVCCriteria(raw: any): string[] {
    return [
      raw.minimum_traction || 'Product-market fit demonstrated',
      raw.team_requirement || 'Experienced founding team',
      raw.revenue_requirement || 'Clear path to revenue',
      ...(raw.other_criteria || [])
    ];
  }

  private extractRecentGrants(raw: any): string[] {
    if (raw.recent_grants && Array.isArray(raw.recent_grants)) {
      return raw.recent_grants;
    }
    
    if (raw.recent_recipients) {
      return raw.recent_recipients.slice(0, 5);
    }
    
    return ['Recent grant recipient'];
  }

  private extractGenericEligibility(raw: any): string[] {
    const criteria = [];
    
    // Check various fields
    const fields = ['eligibility', 'requirements', 'criteria', 'qualifications'];
    for (const field of fields) {
      if (raw[field]) {
        if (Array.isArray(raw[field])) {
          criteria.push(...raw[field]);
        } else {
          criteria.push(raw[field]);
        }
      }
    }
    
    return criteria.length > 0 ? criteria : ['Open to qualifying projects'];
  }

  private inferStagePreferences(raw: any, type: string): string[] {
    if (raw.stages) return raw.stages;
    
    // Based on funding type
    if (type === 'grant') return ['all'];
    if (type === 'accelerator') return ['pre-seed', 'seed'];
    if (type === 'vc') return ['seed', 'series-a'];
    
    return ['early-stage'];
  }

  private extractGenericSectors(raw: any): string[] {
    const sectors = this.extractSectors(raw);
    
    if (sectors.length === 0) {
      // Try to infer from description
      const desc = (raw.description || '').toLowerCase();
      const inferred = [];
      
      if (desc.includes('defi')) inferred.push('DeFi');
      if (desc.includes('nft')) inferred.push('NFTs');
      if (desc.includes('infrastructure')) inferred.push('Infrastructure');
      if (desc.includes('gaming')) inferred.push('Gaming');
      if (desc.includes('dao')) inferred.push('DAOs');
      
      return inferred.length > 0 ? inferred : ['Web3'];
    }
    
    return sectors;
  }

  private extractGenericBenefits(raw: any, type: string): string[] {
    const benefits = this.extractBenefits(raw);
    
    if (benefits.length === 0) {
      // Default benefits by type
      const defaults: Record<string, string[]> = {
        'grant': ['Non-dilutive funding', 'Community support'],
        'accelerator': ['Mentorship', 'Network', 'Demo day'],
        'vc': ['Strategic guidance', 'Follow-on funding'],
        'incubator': ['Long-term support', 'Resources'],
        'angel': ['Quick decision', 'Flexible terms'],
        'dao': ['Community governance', 'Token allocation']
      };
      
      return defaults[type] || ['Funding', 'Support'];
    }
    
    return benefits;
  }
}

// Export singleton instance
export const fundingExtractor = new FundingExtractor();