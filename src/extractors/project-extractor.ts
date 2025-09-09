/**
 * Comprehensive Project Data Extractor
 * Extracts ALL required fields for the queue_projects table
 */

// No external dependencies - using native Date

export interface RawProjectData {
  [key: string]: any;
}

export interface ExtractedProject {
  // Basic Information
  name: string;
  description: string;
  short_description: string;
  url: string;
  
  // Team Information
  team_size: number;
  founder_names: string[];
  founder_linkedin_urls?: string[];
  
  // Funding Information
  funding_raised: number;
  funding_stage: 'pre-seed' | 'seed' | 'series-a' | 'bootstrapped' | 'grant-funded';
  previous_investors?: string[];
  seeking_amount?: number;
  
  // Project Details
  launch_date: string; // ISO date
  incorporation_date?: string;
  incorporation_country?: string;
  
  // Technical Information
  github_url?: string;
  github_stars?: number;
  github_last_commit?: string;
  demo_url?: string;
  technical_stack: string[];
  
  // Social Presence
  twitter_url?: string;
  twitter_followers?: number;
  discord_url?: string;
  discord_members?: number;
  telegram_url?: string;
  website_traffic_monthly?: number;
  
  // Categories and Focus
  categories: string[];
  supported_chains?: string[];
  target_market: string;
  
  // Traction Metrics
  active_users?: number;
  monthly_revenue?: number;
  total_transactions?: number;
  tvl_usd?: number;
  
  // Validation and Programs
  grant_participation?: string[];
  incubator_participation?: string[];
  hackathon_wins?: string[];
  
  // Project Needs
  project_needs: string[];
  
  // Detailed Context
  problem_statement: string;
  solution_description: string;
  unique_value_proposition: string;
  competitive_advantage?: string;
  roadmap_milestones?: string[];
  
  // Data Quality
  data_completeness_score: number;
  enrichment_sources: string[];
}

export class ProjectExtractor {
  /**
   * Extract comprehensive project data from various sources
   */
  extract(raw: RawProjectData, source: string): ExtractedProject | null {
    try {
      switch (source.toLowerCase()) {
        case 'github':
          return this.extractFromGitHub(raw);
        case 'producthunt':
          return this.extractFromProductHunt(raw);
        case 'devpost':
          return this.extractFromDevpost(raw);
        case 'crunchbase':
          return this.extractFromCrunchbase(raw);
        case 'web3':
          return this.extractFromWeb3Platform(raw);
        default:
          return this.extractGeneric(raw, source);
      }
    } catch (error) {
      console.error(`Failed to extract project from ${source}:`, error);
      return null;
    }
  }

  /**
   * Extract from GitHub repository data
   */
  private extractFromGitHub(raw: any): ExtractedProject {
    const contributors = raw.contributors || [];
    const teamSize = this.estimateTeamSize(contributors.length, raw.commits_count);
    
    // Extract technical stack from languages and topics
    const technicalStack = [
      ...(raw.language ? [raw.language] : []),
      ...(raw.topics || []),
      ...(raw.languages ? Object.keys(raw.languages) : [])
    ].filter(Boolean);
    
    // Determine project stage based on metrics
    const fundingStage = this.determineFundingStage(raw.stargazers_count, raw.created_at);
    
    // Extract founder info from main contributors
    const founderNames = contributors
      .slice(0, 3)
      .map((c: any) => c.name || c.login)
      .filter(Boolean);
    
    return {
      name: raw.name || raw.full_name,
      description: this.expandDescription(raw.description || ''),
      short_description: this.createShortDescription(raw.description),
      url: raw.html_url || raw.url,
      
      team_size: teamSize,
      founder_names: founderNames.length > 0 ? founderNames : ['Unknown Founder'],
      
      funding_raised: 0, // Will be enriched
      funding_stage: fundingStage,
      
      launch_date: raw.created_at || new Date().toISOString(),
      
      github_url: raw.html_url,
      github_stars: raw.stargazers_count || 0,
      github_last_commit: raw.pushed_at || raw.updated_at,
      technical_stack: technicalStack,
      
      categories: this.extractCategories(raw),
      target_market: this.inferTargetMarket(raw),
      
      active_users: raw.watchers_count || 0,
      
      project_needs: this.inferProjectNeeds(raw),
      
      problem_statement: this.generateProblemStatement(raw),
      solution_description: this.generateSolutionDescription(raw),
      unique_value_proposition: this.generateUVP(raw),
      
      data_completeness_score: 0.6, // GitHub alone gives partial data
      enrichment_sources: ['github']
    };
  }

  /**
   * Extract from ProductHunt data
   */
  private extractFromProductHunt(raw: any): ExtractedProject {
    const makers = raw.makers || [];
    const teamSize = Math.max(makers.length, 1);
    
    return {
      name: raw.name,
      description: this.expandDescription(raw.tagline + '. ' + (raw.description || '')),
      short_description: raw.tagline,
      url: raw.website || raw.url,
      
      team_size: teamSize,
      founder_names: makers.map((m: any) => m.name).filter(Boolean),
      
      funding_raised: 0, // Will be enriched
      funding_stage: 'pre-seed', // Most PH launches are early
      
      launch_date: raw.created_at || raw.featured_at,
      
      demo_url: raw.website,
      technical_stack: this.inferTechStack(raw.topics || []),
      
      twitter_url: raw.twitter_url,
      
      categories: (raw.topics || []).map((t: any) => t.name),
      target_market: this.inferTargetMarket(raw),
      
      active_users: raw.votes_count || 0,
      
      project_needs: ['users', 'feedback', 'funding'],
      
      problem_statement: this.generateProblemStatement(raw),
      solution_description: raw.description || raw.tagline,
      unique_value_proposition: raw.tagline,
      
      data_completeness_score: 0.5,
      enrichment_sources: ['producthunt']
    };
  }

  /**
   * Extract from Devpost hackathon data
   */
  private extractFromDevpost(raw: any): ExtractedProject {
    const teamMembers = raw.team_members || raw.members || [];
    
    return {
      name: raw.name || raw.title,
      description: this.expandDescription(raw.description || raw.tagline),
      short_description: this.createShortDescription(raw.tagline || raw.description),
      url: raw.url || raw.project_url,
      
      team_size: Math.max(teamMembers.length, 1),
      founder_names: teamMembers.map((m: any) => m.name || m.screen_name).filter(Boolean),
      
      funding_raised: raw.prizes_won || 0,
      funding_stage: 'grant-funded',
      
      launch_date: raw.submission_date || raw.created_at,
      
      github_url: raw.github_url || raw.code_url,
      demo_url: raw.demo_url || raw.video_url,
      technical_stack: raw.technologies || raw.built_with || [],
      
      categories: raw.categories || raw.tags || [],
      target_market: 'developers',
      
      hackathon_wins: raw.wins || (raw.winner ? [raw.hackathon_name] : []),
      
      project_needs: ['funding', 'mentorship', 'developers'],
      
      problem_statement: this.extractProblemFromDescription(raw.description),
      solution_description: this.extractSolutionFromDescription(raw.description),
      unique_value_proposition: raw.tagline || this.generateUVP(raw),
      
      data_completeness_score: 0.7,
      enrichment_sources: ['devpost']
    };
  }

  /**
   * Extract from Crunchbase data
   */
  private extractFromCrunchbase(raw: any): ExtractedProject {
    return {
      name: raw.name || raw.organization_name,
      description: this.expandDescription(raw.short_description || raw.description),
      short_description: raw.short_description || this.createShortDescription(raw.description),
      url: raw.homepage_url || raw.website,
      
      team_size: raw.num_employees_enum ? this.parseEmployeeRange(raw.num_employees_enum) : 5,
      founder_names: this.extractFoundersFromCrunchbase(raw),
      
      funding_raised: raw.total_funding_amount || raw.funding_total || 0,
      funding_stage: this.mapCrunchbaseStage(raw.last_funding_type),
      previous_investors: raw.investors || [],
      
      launch_date: raw.founded_on || raw.founded_date,
      incorporation_date: raw.founded_on,
      incorporation_country: raw.country_code || raw.location_country,
      
      twitter_url: raw.twitter_url,
      
      categories: raw.categories || raw.category_list?.split(',') || [],
      target_market: raw.target_market || 'global',
      
      project_needs: this.inferProjectNeedsFromStage(raw.last_funding_type),
      
      problem_statement: this.generateProblemStatement(raw),
      solution_description: raw.description || raw.short_description,
      unique_value_proposition: raw.short_description || this.generateUVP(raw),
      
      data_completeness_score: 0.8,
      enrichment_sources: ['crunchbase']
    };
  }

  /**
   * Extract from Web3 platform data
   */
  private extractFromWeb3Platform(raw: any): ExtractedProject {
    return {
      name: raw.name || raw.project_name,
      description: this.expandDescription(raw.description || raw.about),
      short_description: this.createShortDescription(raw.description || raw.tagline),
      url: raw.website || raw.url,
      
      team_size: raw.team_size || raw.team?.length || 3,
      founder_names: this.extractWeb3Founders(raw),
      
      funding_raised: raw.funding || raw.raised || 0,
      funding_stage: raw.stage || 'seed',
      
      launch_date: raw.launch_date || raw.created_at,
      
      github_url: raw.github,
      technical_stack: raw.tech_stack || raw.technologies || ['Solidity', 'Web3.js'],
      
      twitter_url: raw.twitter,
      twitter_followers: raw.twitter_followers,
      discord_url: raw.discord,
      discord_members: raw.discord_members || raw.community_size,
      
      categories: raw.categories || raw.tags || ['DeFi'],
      supported_chains: raw.chains || raw.blockchain || ['Ethereum'],
      target_market: raw.target_audience || 'Web3 users',
      
      active_users: raw.users || raw.active_addresses || 0,
      monthly_revenue: raw.revenue || 0,
      total_transactions: raw.transactions || 0,
      tvl_usd: raw.tvl || raw.total_value_locked || 0,
      
      grant_participation: raw.grants || [],
      incubator_participation: raw.accelerators || [],
      
      project_needs: raw.needs || ['funding', 'users', 'developers'],
      
      problem_statement: this.generateWeb3ProblemStatement(raw),
      solution_description: raw.solution || raw.description,
      unique_value_proposition: raw.value_prop || this.generateUVP(raw),
      
      data_completeness_score: 0.75,
      enrichment_sources: ['web3platform']
    };
  }

  /**
   * Generic extractor for unknown sources
   */
  private extractGeneric(raw: any, source: string): ExtractedProject {
    // Handle nested structures
    const project = raw.project || raw;
    const metrics = raw.metrics || {};
    const team = raw.team || {};
    const funding = raw.funding || {};
    const details = project.details || {};
    
    // Try to extract as much as possible from common field names
    const name = project.name || project.title || raw.name || raw.title || raw.project_name || 'Unknown Project';
    const description = details.description || project.description || raw.description || raw.about || raw.summary || '';
    
    return {
      name,
      description: this.expandDescription(description),
      short_description: this.createShortDescription(description),
      url: raw.url || raw.website || raw.link || '',
      
      team_size: team.size || raw.team_size || raw.team?.length || metrics.github?.contributors || 2,
      founder_names: this.extractGenericFounders(team.founders || raw),
      
      funding_raised: funding.raised || raw.funding || raw.raised || raw.funding_amount || 0,
      funding_stage: funding.stage?.toLowerCase() || this.inferStage(raw),
      
      launch_date: raw.launch_date || raw.created_at || raw.date || new Date().toISOString(),
      
      github_url: raw.github || raw.github_url || raw.repo,
      technical_stack: this.extractGenericTechStack(details.tech || project),
      
      twitter_url: raw.twitter || raw.twitter_url,
      discord_url: raw.discord || raw.discord_url,
      
      categories: this.extractGenericCategories(raw),
      target_market: raw.market || raw.audience || 'general',
      
      active_users: metrics.github?.stars || metrics.onchain?.users || raw.users || 0,
      tvl_usd: metrics.onchain?.tvl || raw.tvl || 0,
      total_transactions: metrics.onchain?.transactions || raw.transactions || 0,
      
      project_needs: ['funding', 'users', 'feedback'],
      
      problem_statement: this.generateGenericProblemStatement(raw),
      solution_description: description || 'Innovative solution in the Web3 space',
      unique_value_proposition: this.generateUVP(raw),
      
      data_completeness_score: 0.3,
      enrichment_sources: [source]
    };
  }

  // Helper methods

  private estimateTeamSize(contributors: number, commits: number): number {
    if (contributors > 0) return Math.min(contributors, 10);
    if (commits > 1000) return 5;
    if (commits > 100) return 3;
    return 2;
  }

  private determineFundingStage(stars: number, createdAt: string): ExtractedProject['funding_stage'] {
    const created = new Date(createdAt);
    const now = new Date();
    const monthsOld = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (stars > 1000 || monthsOld > 24) return 'seed';
    if (stars > 100 || monthsOld > 12) return 'pre-seed';
    return 'bootstrapped';
  }

  private expandDescription(desc: string): string {
    if (!desc) return 'An innovative Web3 project building solutions for the decentralized ecosystem.';
    if (desc.length < 100) {
      return desc + ' This project aims to revolutionize the Web3 space by providing innovative solutions and driving adoption of blockchain technology.';
    }
    return desc;
  }

  private createShortDescription(desc: string): string {
    if (!desc) return 'Innovative Web3 solution';
    if (desc.length <= 200) return desc;
    return desc.substring(0, 197) + '...';
  }

  private extractCategories(raw: any): string[] {
    const categories = [];
    
    // From topics/tags
    if (raw.topics) categories.push(...raw.topics);
    if (raw.tags) categories.push(...raw.tags);
    if (raw.categories) categories.push(...raw.categories);
    
    // Infer from description
    const desc = (raw.description || '').toLowerCase();
    if (desc.includes('defi')) categories.push('DeFi');
    if (desc.includes('nft')) categories.push('NFT');
    if (desc.includes('dao')) categories.push('DAO');
    if (desc.includes('game') || desc.includes('gaming')) categories.push('Gaming');
    
    return [...new Set(categories)].slice(0, 5);
  }

  private inferTargetMarket(raw: any): string {
    const desc = (raw.description || '').toLowerCase();
    if (desc.includes('developer')) return 'developers';
    if (desc.includes('trader')) return 'traders';
    if (desc.includes('creator')) return 'creators';
    if (desc.includes('enterprise')) return 'enterprise';
    return 'Web3 users';
  }

  private inferProjectNeeds(raw: any): string[] {
    const needs = [];
    
    // Based on stars/activity
    if (raw.stargazers_count < 100) needs.push('users');
    if (raw.open_issues_count > 10) needs.push('developers');
    
    // Based on stage
    if (!raw.has_funding) needs.push('funding');
    
    // Always need these in early stage
    needs.push('feedback', 'partnerships');
    
    return needs.slice(0, 5);
  }

  private generateProblemStatement(raw: any): string {
    const name = raw.name || 'This project';
    const category = raw.topics?.[0] || 'Web3';
    
    return `${name} addresses the critical challenge of ${category} adoption by solving key pain points that users face in the current ecosystem. The existing solutions are often complex, expensive, or centralized, creating barriers for mainstream adoption.`;
  }

  private generateSolutionDescription(raw: any): string {
    const name = raw.name || 'Our solution';
    const tech = raw.language || 'blockchain technology';
    
    return `${name} leverages ${tech} to create a seamless, user-friendly experience that removes traditional barriers. By implementing innovative approaches and focusing on user needs, we're building a solution that is both powerful and accessible.`;
  }

  private generateUVP(raw: any): string {
    const name = raw.name || 'This project';
    return `${name} uniquely combines technical innovation with user-centric design to deliver unmatched value in the Web3 ecosystem.`;
  }

  private extractFoundersFromCrunchbase(raw: any): string[] {
    const founders = [];
    
    if (raw.founders) {
      founders.push(...raw.founders.map((f: any) => f.name));
    }
    
    if (raw.people) {
      const founderRoles = raw.people.filter((p: any) => 
        p.title?.toLowerCase().includes('founder') ||
        p.title?.toLowerCase().includes('ceo')
      );
      founders.push(...founderRoles.map((f: any) => f.name));
    }
    
    return founders.length > 0 ? founders : ['Founding Team'];
  }

  private parseEmployeeRange(range: string): number {
    const ranges: Record<string, number> = {
      'c_00_01': 1,
      'c_02_10': 5,
      'c_11_50': 20,
      'c_51_100': 75,
      'c_101_250': 150,
      'c_251_500': 350
    };
    return ranges[range] || 10;
  }

  private mapCrunchbaseStage(fundingType: string): ExtractedProject['funding_stage'] {
    const mapping: Record<string, ExtractedProject['funding_stage']> = {
      'pre_seed': 'pre-seed',
      'seed': 'seed',
      'series_a': 'series-a',
      'angel': 'pre-seed',
      'grant': 'grant-funded'
    };
    return mapping[fundingType?.toLowerCase()] || 'seed';
  }

  private inferTechStack(topics: any[]): string[] {
    const stack = [];
    const topicNames = topics.map(t => (t.name || t).toLowerCase());
    
    // Infer from topics
    if (topicNames.some(t => t.includes('react'))) stack.push('React');
    if (topicNames.some(t => t.includes('node'))) stack.push('Node.js');
    if (topicNames.some(t => t.includes('python'))) stack.push('Python');
    if (topicNames.some(t => t.includes('blockchain'))) stack.push('Solidity');
    
    return stack.length > 0 ? stack : ['JavaScript'];
  }

  private extractWeb3Founders(raw: any): string[] {
    if (raw.founders) return raw.founders;
    if (raw.team) {
      return raw.team
        .filter((m: any) => m.role?.includes('founder') || m.role?.includes('CEO'))
        .map((m: any) => m.name);
    }
    return ['Anonymous Team'];
  }

  private generateWeb3ProblemStatement(raw: any): string {
    const chain = raw.blockchain || 'blockchain';
    return `The ${chain} ecosystem lacks efficient solutions for ${raw.category || 'decentralized operations'}, leading to high costs, poor user experience, and limited adoption.`;
  }

  private extractGenericFounders(raw: any): string[] {
    // Handle direct array or nested objects
    if (Array.isArray(raw)) {
      return raw.map((f: any) => f.name || f.login || f).filter(Boolean);
    }
    
    const possibleFields = ['founders', 'team', 'members', 'creators', 'makers'];
    
    for (const field of possibleFields) {
      if (raw[field] && Array.isArray(raw[field])) {
        return raw[field].map((f: any) => f.name || f.login || f).filter(Boolean);
      }
    }
    
    return ['Founding Team'];
  }

  private inferStage(raw: any): ExtractedProject['funding_stage'] {
    if (raw.funding_stage) return raw.funding_stage;
    if (raw.stage) return raw.stage.toLowerCase();
    
    const amount = raw.funding?.raised || raw.funding || raw.raised || 0;
    if (amount > 1000000) return 'series-a';
    if (amount > 100000) return 'seed';
    return 'pre-seed';
  }

  private extractGenericTechStack(raw: any): string[] {
    const stack = [];
    const possibleFields = ['tech_stack', 'technologies', 'stack', 'built_with', 'languages', 'frameworks'];
    
    for (const field of possibleFields) {
      if (raw[field]) {
        if (Array.isArray(raw[field])) {
          stack.push(...raw[field]);
        } else if (typeof raw[field] === 'string') {
          stack.push(...raw[field].split(',').map((s: string) => s.trim()));
        }
      }
    }
    
    // Check nested structures
    if (raw.languages && Array.isArray(raw.languages)) {
      stack.push(...raw.languages);
    }
    if (raw.frameworks && Array.isArray(raw.frameworks)) {
      stack.push(...raw.frameworks);
    }
    
    return stack.length > 0 ? stack : ['Web3'];
  }

  private extractGenericCategories(raw: any): string[] {
    const categories = [];
    const possibleFields = ['categories', 'tags', 'topics', 'category', 'type'];
    
    for (const field of possibleFields) {
      if (raw[field]) {
        if (Array.isArray(raw[field])) {
          categories.push(...raw[field]);
        } else if (typeof raw[field] === 'string') {
          categories.push(raw[field]);
        }
      }
    }
    
    return categories.length > 0 ? categories : ['Web3'];
  }

  private generateGenericProblemStatement(raw: any): string {
    return `This project addresses fundamental challenges in the ${raw.category || 'Web3'} space, focusing on improving accessibility, efficiency, and user experience.`;
  }

  private extractProblemFromDescription(desc: string): string {
    // Try to find problem-related sentences
    const sentences = desc.split('.');
    const problemKeywords = ['problem', 'challenge', 'issue', 'difficult', 'lack', 'need'];
    
    const problemSentence = sentences.find(s => 
      problemKeywords.some(keyword => s.toLowerCase().includes(keyword))
    );
    
    return problemSentence || this.generateGenericProblemStatement({});
  }

  private extractSolutionFromDescription(desc: string): string {
    // Try to find solution-related sentences
    const sentences = desc.split('.');
    const solutionKeywords = ['solution', 'solve', 'provide', 'enable', 'allow', 'help'];
    
    const solutionSentence = sentences.find(s => 
      solutionKeywords.some(keyword => s.toLowerCase().includes(keyword))
    );
    
    return solutionSentence || desc.substring(0, 200);
  }

  private inferProjectNeedsFromStage(stage: string): string[] {
    const stageNeeds: Record<string, string[]> = {
      'pre-seed': ['funding', 'mentorship', 'product-market-fit'],
      'seed': ['funding', 'developers', 'partnerships'],
      'series-a': ['growth', 'enterprise-clients', 'key-hires'],
      'bootstrapped': ['revenue', 'users', 'community']
    };
    
    return stageNeeds[stage] || ['funding', 'users', 'feedback'];
  }
}

// Export singleton instance
export const projectExtractor = new ProjectExtractor();