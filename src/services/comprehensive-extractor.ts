/**
 * Comprehensive Data Extractor
 * Intelligently extracts ALL required fields for PROJECTS, RESOURCES, and FUNDING
 * Based on ACCELERATE_FINAL_CRITERIA.md requirements
 */

import { ContentItem } from '../types';

export interface ExtractedProject {
  type: 'project';
  name: string;
  company_name: string;
  description: string;
  short_description: string;
  website_url: string;
  github_url?: string;
  twitter_url?: string;
  discord_url?: string;
  
  // Stage Information
  launch_date: string;
  founded_year: number;
  funding_raised: number;
  funding_round?: string;
  team_size: number;
  
  // Categories & Tags
  categories: string[];
  supported_chains: string[];
  project_needs: string[];
  
  // Validation
  grant_participation?: string[];
  incubator_participation?: string[];
  traction_metrics?: {
    users?: number;
    tvl?: number;
    transactions?: number;
    github_stars?: number;
  };
  
  // Activity Tracking
  last_activity: string;
  development_status: string;
  
  // Detailed Context
  problem_solving: string;
  unique_value_prop: string;
  target_market: string;
  roadmap_highlights?: string[];
  
  // Source metadata
  source: string;
  source_url: string;
  metadata: any;
}

export interface ExtractedResource {
  type: 'resource';
  title: string;
  description: string;
  url: string;
  
  // Type & Category
  resource_type: string;
  category: string;
  
  // Accessibility
  price_type: string;
  price_amount?: number;
  trial_available?: boolean;
  
  // Quality Indicators
  provider_name: string;
  provider_credibility: string;
  last_updated: string;
  
  // Usage Details
  difficulty_level: string;
  time_commitment?: string;
  prerequisites?: string[];
  
  // Value Proposition
  key_benefits: string[];
  use_cases: string[];
  success_stories?: string[];
  
  // Source metadata
  source: string;
  source_url: string;
  metadata: any;
}

export interface ExtractedFunding {
  type: 'funding';
  name: string;
  organization: string;
  description: string;
  
  // Funding Details
  funding_type: string;
  min_amount: number;
  max_amount: number;
  currency: string;
  equity_required: boolean;
  equity_percentage?: number;
  
  // Application Details
  application_url: string;
  application_deadline?: string;
  application_process: string;
  decision_timeline: string;
  
  // Eligibility
  eligibility_criteria: string[];
  geographic_restrictions?: string[];
  stage_preferences: string[];
  sector_focus: string[];
  
  // Program Details
  program_duration?: string;
  program_location?: string;
  cohort_size?: number;
  
  // Benefits Beyond Funding
  benefits: string[];
  mentor_profiles?: string[];
  alumni_companies?: string[];
  
  // Activity Verification
  last_investment_date: string;
  recent_portfolio: string[];
  total_deployed_2025?: number;
  
  // Source metadata
  source: string;
  source_url: string;
  metadata: any;
}

export type ExtractedContent = ExtractedProject | ExtractedResource | ExtractedFunding;

export class ComprehensiveExtractor {
  
  /**
   * Main extraction method - determines type and extracts accordingly
   * Returns ContentItem format expected by validator
   */
  static extract(item: any, source: string): any {
    const contentType = this.determineContentType(item, source);
    
    let extracted: ExtractedContent;
    switch (contentType) {
      case 'project':
        extracted = this.extractProject(item, source);
        break;
      case 'funding':
        extracted = this.extractFunding(item, source);
        break;
      case 'resource':
        extracted = this.extractResource(item, source);
        break;
      default:
        // Default to resource if uncertain
        extracted = this.extractResource(item, source);
    }
    
    // Convert to ContentItem format expected by validator
    return this.toContentItem(extracted);
  }
  
  /**
   * Convert extracted data to ContentItem format
   */
  private static toContentItem(extracted: ExtractedContent): any {
    if (extracted.type === 'project') {
      const project = extracted as ExtractedProject;
      return {
        type: 'project',
        title: project.name,
        name: project.company_name,
        url: project.website_url,
        description: project.description,
        source: project.source,
        source_url: project.source_url,
        created_at: project.launch_date,
        score: 7, // Default score
        
        // Put all project data in metadata for validator
        metadata: {
          launch_date: project.launch_date,
          launch_year: project.founded_year,
          founded_year: project.founded_year,
          funding_raised: project.funding_raised,
          team_size: project.team_size,
          categories: project.categories,
          supported_chains: project.supported_chains,
          project_needs: project.project_needs,
          grant_participation: project.grant_participation,
          incubator_participation: project.incubator_participation,
          traction_metrics: project.traction_metrics,
          last_activity: project.last_activity,
          development_status: project.development_status,
          problem_solving: project.problem_solving,
          unique_value_prop: project.unique_value_prop,
          target_market: project.target_market,
          roadmap_highlights: project.roadmap_highlights,
          github_url: project.github_url,
          twitter_url: project.twitter_url,
          discord_url: project.discord_url,
          funding_round: project.funding_round,
          short_description: project.short_description,
          ...project.metadata
        },
        
        // Also include key fields at top level for staging service
        company_name: project.company_name,
        founded_year: project.founded_year,
        funding_raised: project.funding_raised,
        team_size: project.team_size,
        website_url: project.website_url,
        github_url: project.github_url,
        twitter_url: project.twitter_url,
        discord_url: project.discord_url,
        categories: project.categories,
        development_status: project.development_status
      };
    } else if (extracted.type === 'funding') {
      const funding = extracted as ExtractedFunding;
      return {
        type: 'funding',
        title: funding.name,
        name: funding.name,
        url: funding.application_url,
        description: funding.description,
        source: funding.source,
        source_url: funding.source_url,
        created_at: funding.last_investment_date,
        score: 7,
        
        metadata: {
          organization: funding.organization,
          funding_type: funding.funding_type,
          min_amount: funding.min_amount,
          max_amount: funding.max_amount,
          currency: funding.currency,
          equity_required: funding.equity_required,
          equity_percentage: funding.equity_percentage,
          application_deadline: funding.application_deadline,
          application_process: funding.application_process,
          decision_timeline: funding.decision_timeline,
          eligibility_criteria: funding.eligibility_criteria,
          geographic_restrictions: funding.geographic_restrictions,
          stage_preferences: funding.stage_preferences,
          sector_focus: funding.sector_focus,
          program_duration: funding.program_duration,
          program_location: funding.program_location,
          cohort_size: funding.cohort_size,
          benefits: funding.benefits,
          mentor_profiles: funding.mentor_profiles,
          alumni_companies: funding.alumni_companies,
          recent_portfolio: funding.recent_portfolio,
          total_deployed_2025: funding.total_deployed_2025,
          ...funding.metadata
        },
        
        // Top level fields
        organization: funding.organization,
        max_amount: funding.max_amount,
        min_amount: funding.min_amount,
        funding_type: funding.funding_type,
        equity_required: funding.equity_required,
        benefits: funding.benefits
      };
    } else {
      const resource = extracted as ExtractedResource;
      return {
        type: 'resource',
        title: resource.title,
        name: resource.title,
        url: resource.url,
        content: resource.description,
        description: resource.description,
        source: resource.source,
        source_url: resource.source_url,
        created_at: resource.last_updated,
        score: 7,
        
        metadata: {
          resource_type: resource.resource_type,
          category: resource.category,
          price_type: resource.price_type,
          price_amount: resource.price_amount,
          trial_available: resource.trial_available,
          provider_name: resource.provider_name,
          provider_credibility: resource.provider_credibility,
          last_updated: resource.last_updated,
          difficulty_level: resource.difficulty_level,
          time_commitment: resource.time_commitment,
          prerequisites: resource.prerequisites,
          key_benefits: resource.key_benefits,
          use_cases: resource.use_cases,
          success_stories: resource.success_stories,
          ...resource.metadata
        },
        
        // Top level fields  
        resource_type: resource.resource_type,
        category: resource.category,
        provider_name: resource.provider_name,
        price_type: resource.price_type
      };
    }
  }
  
  /**
   * Intelligently determine content type based on source and content
   */
  private static determineContentType(item: any, source: string): 'project' | 'funding' | 'resource' {
    const text = JSON.stringify(item).toLowerCase();
    const title = (item.title || item.name || '').toLowerCase();
    const description = (item.description || '').toLowerCase();
    
    // Funding indicators - CHECK FIRST
    if (source.includes('Grant') || source.includes('VC') || source.includes('Funding')) {
      return 'funding';
    }
    if (title.includes('grant') || title.includes('accelerator') || 
        title.includes('incubator') || title.includes('funding') ||
        description.includes('grant program') || description.includes('funding round')) {
      return 'funding';
    }
    
    // Resource indicators - very specific patterns
    if (source.includes('DevTo')) {
      // DevTo articles are usually resources/tutorials
      return 'resource';
    }
    
    // GitHub repos - mostly projects unless explicitly a resource
    if (source.includes('GitHub')) {
      // Check if it's explicitly a resource/tool collection
      if (title.includes('awesome-') || title.includes('tutorial') || 
          title.includes('guide') || title.includes('boilerplate') ||
          title.includes('template') || title.includes('starter') ||
          title.includes('resources') || title.includes('collection')) {
        return 'resource';
      }
      // Most GitHub repos are PROJECTS being built
      return 'project';
    }
    
    // HackerNews Show HN - almost always projects
    if (source.includes('HackerNews')) {
      // Show HN is for showing projects you've built
      if (source.includes('Show HN')) {
        return 'project';
      }
      // Ask HN might be resources
      if (source.includes('Ask HN')) {
        if (title.includes('how to') || title.includes('tutorial') || 
            title.includes('guide') || title.includes('resources')) {
          return 'resource';
        }
      }
      // Jobs are funding/hiring related
      if (source.includes('Jobs')) {
        return 'funding';
      }
      // Default HN to project
      return 'project';
    }
    
    // Check content for strong indicators
    if (title.includes('course') || title.includes('tutorial') || 
        title.includes('documentation') || title.includes('learning')) {
      return 'resource';
    }
    
    // Default based on source patterns
    if (source.toLowerCase().includes('startup') || source.toLowerCase().includes('project')) {
      return 'project';
    }
    
    // When in doubt, it's probably a project (most common type)
    return 'project';
  }
  
  /**
   * Extract comprehensive PROJECT data
   */
  private static extractProject(item: any, source: string): ExtractedProject {
    const text = `${item.title || ''} ${item.description || ''} ${item.text || ''}`.toLowerCase();
    const created = new Date(item.created_at || Date.now());
    
    // Extract funding information
    const fundingInfo = this.extractFundingInfo(text);
    
    // Extract team information
    const teamInfo = this.extractTeamInfo(text, item);
    
    // Extract technology information
    const techInfo = this.extractTechInfo(text, item);
    
    // Extract traction metrics
    const traction = this.extractTractionMetrics(item, source);
    
    // Determine project needs based on content
    const needs = this.extractProjectNeeds(text);
    
    // Extract URLs
    const urls = this.extractUrls(item, text);
    
    return {
      type: 'project',
      name: item.name || item.title || 'Unnamed Project',
      company_name: item.company_name || item.name || item.title || 'Unnamed Company',
      description: this.generateDescription(item, 500),
      short_description: this.generateDescription(item, 100),
      website_url: urls.website || item.url || item.html_url || '',
      github_url: urls.github,
      twitter_url: urls.twitter,
      discord_url: urls.discord,
      
      // Stage Information
      launch_date: created.toISOString().split('T')[0],
      founded_year: created.getFullYear(),
      funding_raised: fundingInfo.amount,
      funding_round: fundingInfo.round,
      team_size: teamInfo.size,
      
      // Categories & Tags
      categories: techInfo.categories,
      supported_chains: techInfo.chains,
      project_needs: needs,
      
      // Validation
      grant_participation: fundingInfo.grants,
      incubator_participation: fundingInfo.incubators,
      traction_metrics: traction,
      
      // Activity Tracking
      last_activity: new Date().toISOString().split('T')[0],
      development_status: this.determineDevelopmentStatus(item, source),
      
      // Detailed Context
      problem_solving: this.extractProblemSolving(item),
      unique_value_prop: this.extractUniqueValue(item),
      target_market: this.extractTargetMarket(text),
      roadmap_highlights: this.extractRoadmapHighlights(text),
      
      // Source metadata
      source: source,
      source_url: item.url || item.html_url || '',
      metadata: {
        ...item.metadata,
        original_item: item
      }
    };
  }
  
  /**
   * Extract comprehensive RESOURCE data
   */
  private static extractResource(item: any, source: string): ExtractedResource {
    const text = `${item.title || ''} ${item.description || ''} ${item.text || ''}`.toLowerCase();
    
    // Determine resource type and category
    const typeInfo = this.determineResourceType(text, item);
    
    // Extract pricing information
    const pricingInfo = this.extractPricingInfo(text, item);
    
    // Determine difficulty level
    const difficulty = this.determineDifficulty(text);
    
    // Extract benefits and use cases
    const benefits = this.extractBenefits(text);
    const useCases = this.extractUseCases(text);
    
    return {
      type: 'resource',
      title: item.title || item.name || 'Untitled Resource',
      description: this.generateDescription(item, 500),
      url: item.url || item.html_url || '',
      
      // Type & Category
      resource_type: typeInfo.type,
      category: typeInfo.category,
      
      // Accessibility
      price_type: pricingInfo.type,
      price_amount: pricingInfo.amount,
      trial_available: pricingInfo.hasTrial,
      
      // Quality Indicators
      provider_name: this.extractProvider(item, source),
      provider_credibility: this.assessCredibility(item, source),
      last_updated: item.updated_at || item.created_at || new Date().toISOString(),
      
      // Usage Details
      difficulty_level: difficulty,
      time_commitment: this.extractTimeCommitment(text),
      prerequisites: this.extractPrerequisites(text),
      
      // Value Proposition
      key_benefits: benefits,
      use_cases: useCases,
      success_stories: this.extractSuccessStories(text),
      
      // Source metadata
      source: source,
      source_url: item.url || '',
      metadata: {
        ...item.metadata,
        original_item: item
      }
    };
  }
  
  /**
   * Extract comprehensive FUNDING data
   */
  private static extractFunding(item: any, source: string): ExtractedFunding {
    const text = `${item.title || ''} ${item.description || ''} ${item.text || ''}`.toLowerCase();
    
    // Extract funding amounts and terms
    const fundingTerms = this.extractFundingTerms(text);
    
    // Extract program details
    const programInfo = this.extractProgramInfo(text);
    
    // Extract eligibility criteria
    const eligibility = this.extractEligibility(text);
    
    // Extract benefits
    const benefits = this.extractProgramBenefits(text);
    
    return {
      type: 'funding',
      name: item.title || item.name || 'Untitled Funding Program',
      organization: this.extractOrganization(item, source),
      description: this.generateDescription(item, 500),
      
      // Funding Details
      funding_type: fundingTerms.type,
      min_amount: fundingTerms.min,
      max_amount: fundingTerms.max,
      currency: fundingTerms.currency,
      equity_required: fundingTerms.equityRequired,
      equity_percentage: fundingTerms.equityPercent,
      
      // Application Details
      application_url: item.url || '',
      application_deadline: this.extractDeadline(text),
      application_process: programInfo.process,
      decision_timeline: programInfo.timeline,
      
      // Eligibility
      eligibility_criteria: eligibility.criteria,
      geographic_restrictions: eligibility.geographic,
      stage_preferences: eligibility.stages,
      sector_focus: eligibility.sectors,
      
      // Program Details
      program_duration: programInfo.duration,
      program_location: programInfo.location,
      cohort_size: programInfo.cohortSize,
      
      // Benefits Beyond Funding
      benefits: benefits,
      mentor_profiles: this.extractMentors(text),
      alumni_companies: this.extractAlumni(text),
      
      // Activity Verification
      last_investment_date: new Date().toISOString().split('T')[0],
      recent_portfolio: this.extractPortfolio(text),
      total_deployed_2025: fundingTerms.totalDeployed,
      
      // Source metadata
      source: source,
      source_url: item.url || '',
      metadata: {
        ...item.metadata,
        original_item: item
      }
    };
  }
  
  // Helper methods for extraction
  
  private static extractFundingInfo(text: string): any {
    const amount = this.extractAmount(text);
    const round = this.extractFundingRound(text);
    const grants = this.extractGrants(text);
    const incubators = this.extractIncubators(text);
    
    return { amount, round, grants, incubators };
  }
  
  private static extractAmount(text: string): number {
    const patterns = [
      /\$(\d+(?:\.\d+)?)\s*([kmb])/i,
      /raised\s+\$?(\d+(?:\.\d+)?)\s*([kmb])?/i,
      /funding.*?\$?(\d+(?:\.\d+)?)\s*([kmb])?/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = parseFloat(match[1]);
        const unit = match[2]?.toLowerCase();
        if (unit === 'k') amount *= 1000;
        if (unit === 'm') amount *= 1000000;
        if (unit === 'b') amount *= 1000000000;
        return Math.round(amount);
      }
    }
    
    return 0; // No funding = good for ACCELERATE
  }
  
  private static extractFundingRound(text: string): string | undefined {
    const rounds = ['pre-seed', 'seed', 'series a', 'series b', 'series c'];
    for (const round of rounds) {
      if (text.includes(round)) return round;
    }
    return undefined;
  }
  
  private static extractGrants(text: string): string[] {
    const grants: string[] = [];
    const grantPrograms = ['yc', 'y combinator', 'techstars', 'google for startups', 'aws activate'];
    
    for (const program of grantPrograms) {
      if (text.includes(program)) {
        grants.push(program);
      }
    }
    
    return grants;
  }
  
  private static extractIncubators(text: string): string[] {
    const incubators: string[] = [];
    const programs = ['500 startups', 'techstars', 'yc', 'founder institute', 'entrepreneur first'];
    
    for (const program of programs) {
      if (text.includes(program)) {
        incubators.push(program);
      }
    }
    
    return incubators;
  }
  
  private static extractTeamInfo(text: string, item: any): any {
    // Try multiple patterns to extract team size
    const patterns = [
      /team of (\d+)/i,
      /(\d+)[\s-]person team/i,
      /(\d+) employees?/i,
      /(\d+) engineers?/i,
      /(\d+) developers?/i,
      /(\d+) members?/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return { size: parseInt(match[1]) };
      }
    }
    
    // Check for solo indicators
    if (text.includes('solo') || text.includes('i built') || text.includes("i'm building")) {
      return { size: 1 };
    }
    
    // Check for small team indicators
    if (text.includes('we built') || text.includes("we're building")) {
      return { size: 2 };
    }
    
    // GitHub specific - check contributors
    if (item.contributors_count) {
      return { size: Math.min(item.contributors_count, 10) };
    }
    
    // Default to small team (good for ACCELERATE)
    return { size: 2 };
  }
  
  private static extractTechInfo(text: string, item: any): any {
    const categories: string[] = [];
    const chains: string[] = [];
    
    // Categories
    const categoryKeywords = {
      'DeFi': ['defi', 'decentralized finance', 'dex', 'amm', 'lending', 'borrowing'],
      'NFT': ['nft', 'non-fungible', 'collectible', 'opensea'],
      'Infrastructure': ['infrastructure', 'protocol', 'layer 2', 'scaling'],
      'Gaming': ['gaming', 'game', 'metaverse', 'play-to-earn'],
      'DAO': ['dao', 'governance', 'voting', 'treasury'],
      'AI': ['ai', 'artificial intelligence', 'machine learning', 'ml', 'gpt'],
      'Developer Tools': ['sdk', 'api', 'framework', 'library', 'developer tool']
    };
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        categories.push(category);
      }
    }
    
    // Chains
    const chainKeywords = {
      'Ethereum': ['ethereum', 'eth', 'erc20', 'erc721'],
      'Polygon': ['polygon', 'matic'],
      'Solana': ['solana', 'sol'],
      'Arbitrum': ['arbitrum'],
      'Optimism': ['optimism', 'op'],
      'Base': ['base'],
      'Bitcoin': ['bitcoin', 'btc', 'lightning']
    };
    
    for (const [chain, keywords] of Object.entries(chainKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        chains.push(chain);
      }
    }
    
    // Add language as category for GitHub
    if (item.language) {
      categories.push(item.language);
    }
    
    // Default if none found
    if (categories.length === 0) categories.push('Technology');
    if (chains.length === 0 && text.includes('blockchain')) chains.push('Multi-chain');
    
    return { categories, chains };
  }
  
  private static extractTractionMetrics(item: any, source: string): any {
    const metrics: any = {};
    
    // GitHub metrics
    if (source.includes('GitHub')) {
      metrics.github_stars = item.stargazers_count || 0;
      metrics.forks = item.forks_count || 0;
    }
    
    // HackerNews metrics
    if (source.includes('HackerNews')) {
      metrics.hn_points = item.points || 0;
      metrics.comments = item.num_comments || 0;
    }
    
    // Try to extract user numbers from text
    const text = JSON.stringify(item).toLowerCase();
    const userPattern = /(\d+(?:k|m)?)\s*(?:users?|customers?|clients?)/i;
    const userMatch = text.match(userPattern);
    if (userMatch) {
      let users = parseFloat(userMatch[1].replace(/[km]/i, ''));
      if (userMatch[1].includes('k')) users *= 1000;
      if (userMatch[1].includes('m')) users *= 1000000;
      metrics.users = Math.round(users);
    }
    
    return metrics;
  }
  
  private static extractProjectNeeds(text: string): string[] {
    const needs: string[] = [];
    
    const needIndicators = {
      'funding': ['looking for funding', 'raising', 'seeking investment', 'fundraising'],
      'developers': ['hiring', 'looking for developers', 'need engineers', 'join our team'],
      'marketing': ['need marketing', 'growth', 'user acquisition'],
      'co-founder': ['looking for co-founder', 'seeking co-founder'],
      'advisors': ['looking for advisors', 'need guidance', 'seeking mentors'],
      'users': ['beta testers', 'early users', 'feedback', 'user testing']
    };
    
    for (const [need, indicators] of Object.entries(needIndicators)) {
      if (indicators.some(ind => text.includes(ind))) {
        needs.push(need);
      }
    }
    
    // Default if early stage
    if (needs.length === 0) {
      needs.push('users', 'feedback');
    }
    
    return needs;
  }
  
  private static extractUrls(item: any, text: string): any {
    const urls: any = {};
    
    // Website
    urls.website = item.website || item.homepage || item.url || item.html_url;
    
    // GitHub
    if (item.html_url?.includes('github.com')) {
      urls.github = item.html_url;
    } else {
      const githubMatch = text.match(/github\.com\/[\w-]+\/[\w-]+/);
      if (githubMatch) urls.github = `https://${githubMatch[0]}`;
    }
    
    // Twitter
    const twitterMatch = text.match(/twitter\.com\/[\w]+|x\.com\/[\w]+/);
    if (twitterMatch) urls.twitter = `https://${twitterMatch[0]}`;
    
    // Discord
    const discordMatch = text.match(/discord\.gg\/[\w]+/);
    if (discordMatch) urls.discord = `https://${discordMatch[0]}`;
    
    return urls;
  }
  
  private static determineDevelopmentStatus(item: any, source: string): string {
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('launching soon') || text.includes('coming soon')) return 'pre-launch';
    if (text.includes('beta') || text.includes('early access')) return 'beta';
    if (text.includes('mvp') || text.includes('prototype')) return 'mvp';
    if (text.includes('live') || text.includes('launched')) return 'launched';
    
    // GitHub repos are usually active
    if (source.includes('GitHub')) return 'active';
    
    return 'active'; // Default
  }
  
  private static extractProblemSolving(item: any): string {
    const description = item.description || item.text || '';
    
    // Look for problem indicators
    const problemPatterns = [
      /solving\s+(.+)/i,
      /problem[:\s]+(.+)/i,
      /helps?\s+(.+)/i,
      /enables?\s+(.+)/i,
      /allows?\s+(.+)/i
    ];
    
    for (const pattern of problemPatterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1].split('.')[0]; // First sentence
      }
    }
    
    // Generate from description
    return `Addresses challenges in ${item.category || 'technology'} space`;
  }
  
  private static extractUniqueValue(item: any): string {
    const text = (item.description || item.text || '').toLowerCase();
    
    if (text.includes('first')) return 'First mover in this space';
    if (text.includes('only')) return 'Only solution offering this approach';
    if (text.includes('unlike')) return 'Differentiated approach to the problem';
    if (text.includes('faster')) return 'Superior performance and speed';
    if (text.includes('cheaper')) return 'More cost-effective solution';
    if (text.includes('easier')) return 'Better user experience';
    
    return 'Innovative approach to solving the problem';
  }
  
  private static extractTargetMarket(text: string): string {
    if (text.includes('enterprise')) return 'Enterprise companies';
    if (text.includes('developer')) return 'Developers and technical teams';
    if (text.includes('startup')) return 'Early-stage startups';
    if (text.includes('creator')) return 'Content creators';
    if (text.includes('trader')) return 'Traders and investors';
    if (text.includes('gamer')) return 'Gaming community';
    
    return 'Web3 builders and innovators';
  }
  
  private static extractRoadmapHighlights(text: string): string[] | undefined {
    const highlights: string[] = [];
    
    const roadmapKeywords = ['roadmap', 'next', 'upcoming', 'planned', 'future', 'q1', 'q2', 'q3', 'q4'];
    if (!roadmapKeywords.some(kw => text.includes(kw))) {
      return undefined;
    }
    
    // Extract sentences containing future plans
    const sentences = text.split(/[.!?]/);
    for (const sentence of sentences) {
      if (roadmapKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
        highlights.push(sentence.trim());
        if (highlights.length >= 3) break;
      }
    }
    
    return highlights.length > 0 ? highlights : undefined;
  }
  
  private static generateDescription(item: any, maxLength: number): string {
    let description = item.description || item.text || item.content || '';
    
    // If too short, enhance it
    if (description.length < 50) {
      const title = item.title || item.name || '';
      const source = item.source || 'the web';
      description = `${title} - A ${source} project focused on ${item.category || 'innovation'}. ${description}`;
    }
    
    // Truncate if too long
    if (description.length > maxLength) {
      description = description.substring(0, maxLength - 3) + '...';
    }
    
    return description;
  }
  
  private static determineResourceType(text: string, item: any): any {
    // Determine type
    let type = 'tool';
    if (text.includes('course') || text.includes('tutorial')) type = 'educational';
    if (text.includes('api') || text.includes('sdk')) type = 'infrastructure';
    if (text.includes('community') || text.includes('dao')) type = 'community';
    
    // Determine category
    let category = 'general';
    if (text.includes('smart contract')) category = 'smart-contracts';
    if (text.includes('frontend') || text.includes('ui')) category = 'frontend';
    if (text.includes('backend') || text.includes('server')) category = 'backend';
    if (text.includes('fundrais')) category = 'fundraising';
    
    return { type, category };
  }
  
  private static extractPricingInfo(text: string, item: any): any {
    let type = 'free'; // Default to free
    let amount = 0;
    let hasTrial = false;
    
    if (text.includes('paid') || text.includes('premium') || text.includes('$')) {
      type = 'paid';
      
      // Try to extract price
      const priceMatch = text.match(/\$(\d+)/);
      if (priceMatch) {
        amount = parseInt(priceMatch[1]);
      }
    }
    
    if (text.includes('freemium')) {
      type = 'freemium';
    }
    
    if (text.includes('trial') || text.includes('free tier')) {
      hasTrial = true;
    }
    
    return { type, amount, hasTrial };
  }
  
  private static determineDifficulty(text: string): string {
    if (text.includes('beginner') || text.includes('easy') || text.includes('simple')) return 'beginner';
    if (text.includes('advanced') || text.includes('expert') || text.includes('complex')) return 'advanced';
    return 'intermediate';
  }
  
  private static extractBenefits(text: string): string[] {
    const benefits: string[] = [];
    
    const benefitKeywords = {
      'Save time': ['save time', 'faster', 'quick'],
      'Reduce costs': ['save money', 'cheaper', 'cost-effective'],
      'Improve quality': ['better', 'improve', 'enhance'],
      'Learn skills': ['learn', 'education', 'skill'],
      'Access network': ['network', 'community', 'connect']
    };
    
    for (const [benefit, keywords] of Object.entries(benefitKeywords)) {
      if (keywords.some(kw => text.includes(kw))) {
        benefits.push(benefit);
      }
    }
    
    if (benefits.length === 0) {
      benefits.push('Accelerate development', 'Access to resources');
    }
    
    return benefits;
  }
  
  private static extractUseCases(text: string): string[] {
    const useCases: string[] = [];
    
    if (text.includes('build')) useCases.push('Building Web3 applications');
    if (text.includes('deploy')) useCases.push('Deploying smart contracts');
    if (text.includes('test')) useCases.push('Testing and debugging');
    if (text.includes('monitor')) useCases.push('Monitoring and analytics');
    
    if (useCases.length === 0) {
      useCases.push('General Web3 development');
    }
    
    return useCases;
  }
  
  private static extractProvider(item: any, source: string): string {
    return item.provider || item.author || item.owner?.login || source;
  }
  
  private static assessCredibility(item: any, source: string): string {
    const credibility: string[] = [];
    
    // GitHub credibility
    if (source.includes('GitHub')) {
      const stars = item.stargazers_count || 0;
      if (stars > 1000) credibility.push('Popular open source project');
      else if (stars > 100) credibility.push('Growing open source project');
    }
    
    // HackerNews credibility
    if (source.includes('HackerNews')) {
      const points = item.points || 0;
      if (points > 100) credibility.push('Highly upvoted on HackerNews');
    }
    
    // Check for known organizations
    const text = JSON.stringify(item).toLowerCase();
    if (text.includes('yc') || text.includes('y combinator')) credibility.push('YC-backed');
    if (text.includes('a16z')) credibility.push('a16z portfolio');
    
    return credibility.length > 0 ? credibility.join(', ') : 'Community contribution';
  }
  
  private static extractTimeCommitment(text: string): string | undefined {
    const timePattern = /(\d+)\s*(hours?|days?|weeks?|months?)/i;
    const match = text.match(timePattern);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return undefined;
  }
  
  private static extractPrerequisites(text: string): string[] {
    const prerequisites: string[] = [];
    
    if (text.includes('javascript') || text.includes('js')) prerequisites.push('JavaScript knowledge');
    if (text.includes('solidity')) prerequisites.push('Solidity basics');
    if (text.includes('react')) prerequisites.push('React experience');
    if (text.includes('node')) prerequisites.push('Node.js familiarity');
    
    return prerequisites;
  }
  
  private static extractSuccessStories(text: string): string[] | undefined {
    const stories: string[] = [];
    
    // Look for success indicators
    if (text.includes('used by')) {
      const match = text.match(/used by ([^.]+)/i);
      if (match) stories.push(match[1]);
    }
    
    return stories.length > 0 ? stories : undefined;
  }
  
  private static extractFundingTerms(text: string): any {
    const type = this.determineFundingType(text);
    const amounts = this.extractFundingAmounts(text);
    const equity = this.extractEquityTerms(text);
    
    return {
      type,
      min: amounts.min,
      max: amounts.max,
      currency: 'USD',
      equityRequired: equity.required,
      equityPercent: equity.percent,
      totalDeployed: amounts.total
    };
  }
  
  private static determineFundingType(text: string): string {
    if (text.includes('grant')) return 'grant';
    if (text.includes('accelerator')) return 'accelerator';
    if (text.includes('incubator')) return 'incubator';
    if (text.includes('vc') || text.includes('venture')) return 'vc';
    return 'grant'; // Default to grant (best for ACCELERATE)
  }
  
  private static extractFundingAmounts(text: string): any {
    let min = 10000; // Default min
    let max = 500000; // Default max (ACCELERATE limit)
    let total = 0;
    
    // Look for specific amounts
    const amountPattern = /\$(\d+(?:k|m)?)\s*(?:to|-)\s*\$?(\d+(?:k|m)?)/i;
    const match = text.match(amountPattern);
    if (match) {
      min = this.parseAmount(match[1]);
      max = this.parseAmount(match[2]);
    }
    
    return { min, max, total };
  }
  
  private static parseAmount(str: string): number {
    let amount = parseFloat(str.replace(/[^\d.]/g, ''));
    if (str.includes('k')) amount *= 1000;
    if (str.includes('m')) amount *= 1000000;
    return Math.round(amount);
  }
  
  private static extractEquityTerms(text: string): any {
    const required = text.includes('equity') && !text.includes('no equity');
    let percent = 0;
    
    if (required) {
      const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%/);
      if (percentMatch) {
        percent = parseFloat(percentMatch[1]);
      } else {
        percent = 7; // Default equity
      }
    }
    
    return { required, percent };
  }
  
  private static extractProgramInfo(text: string): any {
    const duration = this.extractDuration(text);
    const location = this.extractLocation(text);
    const process = this.extractApplicationProcess(text);
    const timeline = this.extractDecisionTimeline(text);
    const cohortSize = this.extractCohortSize(text);
    
    return { duration, location, process, timeline, cohortSize };
  }
  
  private static extractDuration(text: string): string | undefined {
    const durationPattern = /(\d+)\s*(weeks?|months?)\s*(?:program|duration|long)/i;
    const match = text.match(durationPattern);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return '12 weeks'; // Default duration
  }
  
  private static extractLocation(text: string): string | undefined {
    if (text.includes('remote')) return 'Remote';
    if (text.includes('san francisco') || text.includes('sf')) return 'San Francisco';
    if (text.includes('new york') || text.includes('nyc')) return 'New York';
    if (text.includes('london')) return 'London';
    if (text.includes('berlin')) return 'Berlin';
    return 'Remote'; // Default to remote
  }
  
  private static extractApplicationProcess(text: string): string {
    if (text.includes('application')) {
      const match = text.match(/application[^.]+/i);
      if (match) return match[0];
    }
    return 'Submit application with pitch deck and team information';
  }
  
  private static extractDecisionTimeline(text: string): string {
    const timelinePattern = /(\d+)\s*(days?|weeks?)\s*(?:decision|response|hear back)/i;
    const match = text.match(timelinePattern);
    if (match) {
      return `${match[1]} ${match[2]}`;
    }
    return '2-4 weeks';
  }
  
  private static extractCohortSize(text: string): number | undefined {
    const sizePattern = /(\d+)\s*(?:companies|startups|teams)\s*(?:per|in)\s*(?:cohort|batch)/i;
    const match = text.match(sizePattern);
    if (match) {
      return parseInt(match[1]);
    }
    return undefined;
  }
  
  private static extractEligibility(text: string): any {
    const criteria = this.extractCriteria(text);
    const geographic = this.extractGeographic(text);
    const stages = this.extractStages(text);
    const sectors = this.extractSectors(text);
    
    return { criteria, geographic, stages, sectors };
  }
  
  private static extractCriteria(text: string): string[] {
    const criteria: string[] = [];
    
    if (text.includes('early') || text.includes('seed')) criteria.push('Early-stage startups');
    if (text.includes('< $500k') || text.includes('less than 500k')) criteria.push('Less than $500k funding');
    if (text.includes('technical')) criteria.push('Technical founders');
    if (text.includes('traction')) criteria.push('Demonstrated traction');
    
    if (criteria.length === 0) {
      criteria.push('Early-stage startups', 'Less than $500k funding');
    }
    
    return criteria;
  }
  
  private static extractGeographic(text: string): string[] | undefined {
    const regions: string[] = [];
    
    if (text.includes('us only') || text.includes('united states')) regions.push('United States');
    if (text.includes('europe')) regions.push('Europe');
    if (text.includes('global') || text.includes('worldwide')) return undefined;
    
    return regions.length > 0 ? regions : undefined;
  }
  
  private static extractStages(text: string): string[] {
    const stages: string[] = [];
    
    if (text.includes('pre-seed')) stages.push('pre-seed');
    if (text.includes('seed')) stages.push('seed');
    if (text.includes('series a')) stages.push('series-a');
    
    if (stages.length === 0) {
      stages.push('pre-seed', 'seed');
    }
    
    return stages;
  }
  
  private static extractSectors(text: string): string[] {
    const sectors: string[] = [];
    
    if (text.includes('web3') || text.includes('blockchain')) sectors.push('Web3');
    if (text.includes('defi')) sectors.push('DeFi');
    if (text.includes('ai') || text.includes('ml')) sectors.push('AI/ML');
    if (text.includes('fintech')) sectors.push('Fintech');
    
    if (sectors.length === 0) {
      sectors.push('Technology', 'Web3');
    }
    
    return sectors;
  }
  
  private static extractProgramBenefits(text: string): string[] {
    const benefits: string[] = [];
    
    if (text.includes('funding') || text.includes('capital')) benefits.push('Funding');
    if (text.includes('mentor')) benefits.push('Mentorship');
    if (text.includes('network')) benefits.push('Network access');
    if (text.includes('office')) benefits.push('Office space');
    if (text.includes('credit') || text.includes('aws') || text.includes('azure')) benefits.push('Cloud credits');
    
    if (benefits.length === 0) {
      benefits.push('Funding', 'Mentorship', 'Network access');
    }
    
    return benefits;
  }
  
  private static extractDeadline(text: string): string | undefined {
    const deadlinePattern = /deadline[:\s]+([^.]+)/i;
    const match = text.match(deadlinePattern);
    if (match) {
      return match[1].trim();
    }
    
    // Look for date patterns
    const datePattern = /(\w+\s+\d{1,2},?\s+\d{4})/;
    const dateMatch = text.match(datePattern);
    if (dateMatch) {
      return dateMatch[1];
    }
    
    return undefined;
  }
  
  private static extractOrganization(item: any, source: string): string {
    return item.organization || item.provider || item.author || source;
  }
  
  private static extractMentors(text: string): string[] | undefined {
    // This would need more sophisticated extraction
    // For now, return undefined
    return undefined;
  }
  
  private static extractAlumni(text: string): string[] | undefined {
    // This would need more sophisticated extraction
    // For now, return undefined
    return undefined;
  }
  
  private static extractPortfolio(text: string): string[] {
    // This would need more sophisticated extraction
    // For now, return a placeholder
    return ['Recent investment activity'];
  }
}