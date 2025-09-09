/**
 * MULTI-SOURCE DATA AGGREGATOR
 * Intelligently combines data from multiple sources into unified, rich profiles
 */

import { ContentItem } from '../lib/base-fetcher';

export interface UnifiedProfile {
  // Core Identity
  id: string;
  canonical_name: string;
  aliases: string[];
  description: string;
  
  // Identifiers for matching
  identifiers: {
    domain?: string;
    github_org?: string;
    twitter_handle?: string;
    linkedin_slug?: string;
    product_hunt_slug?: string;
    crunchbase_slug?: string;
    // Web3
    ens_domain?: string;
    contract_address?: string;
  };
  
  // Rich consolidated data
  company: {
    founded_date?: Date;
    location?: {
      city?: string;
      country?: string;
      remote?: boolean;
    };
    industry: string[];
    tags: string[];
    stage: string;
  };
  
  // Team information from multiple sources
  team: {
    founders: Array<{
      name: string;
      role?: string;
      twitter?: string;
      linkedin?: string;
      github?: string;
    }>;
    size: number;
    size_range?: string;
    growth_rate?: number;
  };
  
  // Funding consolidated from Crunchbase, news, YC
  funding: {
    total_raised?: number;
    last_round?: {
      amount: number;
      date: Date;
      type: string;
      investors: string[];
    };
    all_rounds: Array<{
      amount: number;
      date: Date;
      type: string;
      lead_investor?: string;
    }>;
    investors: string[];
    valuation?: number;
  };
  
  // Metrics from various sources
  metrics: {
    // GitHub
    github_stars?: number;
    github_forks?: number;
    github_contributors?: number;
    github_last_commit?: Date;
    
    // ProductHunt
    product_hunt_votes?: number;
    product_hunt_rank?: number;
    product_hunt_featured?: boolean;
    
    // Social
    twitter_followers?: number;
    discord_members?: number;
    telegram_members?: number;
    
    // Business
    monthly_active_users?: number;
    arr?: number; // Annual recurring revenue
    growth_rate?: number;
    
    // Web3 specific
    tvl?: number;
    token_price?: number;
    market_cap?: number;
    daily_volume?: number;
  };
  
  // Content from various sources
  content: {
    news_articles: Array<{
      title: string;
      url: string;
      source: string;
      date: Date;
      summary?: string;
    }>;
    
    launches: Array<{
      platform: string; // ProductHunt, HackerNews, etc
      url: string;
      date: Date;
      upvotes?: number;
    }>;
    
    blog_posts: Array<{
      title: string;
      url: string;
      author?: string;
      date: Date;
    }>;
    
    social_posts: Array<{
      platform: string;
      url: string;
      content?: string;
      engagement?: number;
      date: Date;
    }>;
  };
  
  // Data quality and sourcing
  metadata: {
    sources: string[];
    source_urls: Map<string, string>;
    last_updated: Date;
    last_enriched: Date;
    
    data_quality: {
      completeness: number; // 0-100
      confidence: number;   // 0-100
      verification_level: 'none' | 'partial' | 'verified';
      verified_fields: string[];
      missing_fields: string[];
    };
    
    match_confidence: {
      overall: number;
      signals: {
        domain_match?: boolean;
        name_match?: boolean;
        founder_match?: boolean;
        location_match?: boolean;
        description_similarity?: number;
      };
    };
  };
  
  // ACCELERATE specific
  accelerate: {
    score: number;
    eligible: boolean;
    criteria_met: {
      is_early_stage: boolean;
      has_web3_focus: boolean;
      under_500k_funding: boolean;
      small_team: boolean;
      launched_2024_plus: boolean;
    };
    recommendation: 'feature' | 'approve' | 'review' | 'reject';
    notes?: string;
  };
}

export class MultiSourceAggregator {
  private profiles: Map<string, UnifiedProfile> = new Map();
  
  /**
   * Process and merge data from multiple sources
   */
  async aggregate(items: ContentItem[]): Promise<UnifiedProfile[]> {
    console.log(`🔄 Aggregating ${items.length} items from multiple sources...`);
    
    // Step 1: Group by potential matches
    const groups = this.groupByEntity(items);
    console.log(`📊 Identified ${groups.size} unique entities`);
    
    // Step 2: Create unified profiles
    const profiles: UnifiedProfile[] = [];
    
    for (const [key, groupItems] of groups.entries()) {
      const profile = this.createUnifiedProfile(groupItems);
      profiles.push(profile);
      this.profiles.set(profile.id, profile);
    }
    
    // Step 3: Cross-enrich profiles
    this.crossEnrichProfiles(profiles);
    
    // Step 4: Calculate quality scores
    profiles.forEach(p => this.calculateDataQuality(p));
    
    // Step 5: Score for ACCELERATE
    profiles.forEach(p => this.scoreForAccelerate(p));
    
    console.log(`✅ Created ${profiles.length} unified profiles`);
    return profiles;
  }
  
  /**
   * Group items by entity using multiple matching strategies
   */
  private groupByEntity(items: ContentItem[]): Map<string, ContentItem[]> {
    const groups = new Map<string, ContentItem[]>();
    const processed = new Set<number>();
    
    items.forEach((item, index) => {
      if (processed.has(index)) return;
      
      // Find all matches for this item
      const matches = [item];
      processed.add(index);
      
      items.forEach((candidate, candidateIndex) => {
        if (processed.has(candidateIndex)) return;
        
        if (this.isMatch(item, candidate)) {
          matches.push(candidate);
          processed.add(candidateIndex);
        }
      });
      
      // Create group key
      const key = this.generateEntityKey(matches[0]);
      groups.set(key, matches);
    });
    
    return groups;
  }
  
  /**
   * Determine if two items represent the same entity
   */
  private isMatch(item1: ContentItem, item2: ContentItem): boolean {
    // Extract identifiers
    const id1 = this.extractIdentifiers(item1);
    const id2 = this.extractIdentifiers(item2);
    
    // Domain match (highest confidence)
    if (id1.domain && id2.domain) {
      if (this.normalizeDomain(id1.domain) === this.normalizeDomain(id2.domain)) {
        return true;
      }
    }
    
    // GitHub org match
    if (id1.github && id2.github) {
      if (id1.github.toLowerCase() === id2.github.toLowerCase()) {
        return true;
      }
    }
    
    // Twitter handle match
    if (id1.twitter && id2.twitter) {
      if (id1.twitter.toLowerCase() === id2.twitter.toLowerCase()) {
        return true;
      }
    }
    
    // Name similarity (fuzzy match)
    const name1 = this.normalizeName(item1.title);
    const name2 = this.normalizeName(item2.title);
    
    if (this.calculateSimilarity(name1, name2) > 0.85) {
      // Additional context check for fuzzy matches
      if (this.hasSharedContext(item1, item2)) {
        return true;
      }
    }
    
    // YC batch + similar name
    if (item1.metadata?.yc_batch && item2.metadata?.yc_batch) {
      if (item1.metadata.yc_batch === item2.metadata.yc_batch) {
        if (this.calculateSimilarity(name1, name2) > 0.7) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Extract identifiers from an item
   */
  private extractIdentifiers(item: ContentItem): any {
    const identifiers: any = {};
    
    // Extract domain from URL
    if (item.url) {
      try {
        const url = new URL(item.url);
        identifiers.domain = url.hostname.replace('www.', '');
      } catch {}
    }
    
    // Extract from metadata
    if (item.metadata) {
      identifiers.github = item.metadata.github_url?.match(/github\.com\/([^\/]+)/)?.[1];
      identifiers.twitter = item.metadata.twitter_url?.match(/twitter\.com\/([^\/]+)/)?.[1];
      identifiers.product_hunt = item.metadata.product_hunt_slug;
    }
    
    // Extract from description/content
    const text = `${item.title} ${item.description}`.toLowerCase();
    
    // GitHub mentions
    const githubMatch = text.match(/github\.com\/([a-z0-9-]+)/);
    if (githubMatch) identifiers.github = githubMatch[1];
    
    // Twitter mentions
    const twitterMatch = text.match(/@([a-z0-9_]+)/);
    if (twitterMatch) identifiers.twitter = twitterMatch[1];
    
    return identifiers;
  }
  
  /**
   * Create a unified profile from multiple items
   */
  private createUnifiedProfile(items: ContentItem[]): UnifiedProfile {
    // Sort by data richness
    const sorted = items.sort((a, b) => {
      const scoreA = this.calculateRichness(a);
      const scoreB = this.calculateRichness(b);
      return scoreB - scoreA;
    });
    
    const primary = sorted[0];
    const id = this.generateEntityKey(primary);
    
    // Merge all data
    const profile: UnifiedProfile = {
      id,
      canonical_name: this.selectBestName(items),
      aliases: this.collectAliases(items),
      description: this.selectBestDescription(items),
      
      identifiers: this.mergeIdentifiers(items),
      
      company: {
        founded_date: this.extractFoundedDate(items),
        location: this.extractLocation(items),
        industry: this.extractIndustries(items),
        tags: this.mergeTags(items),
        stage: this.determineStage(items)
      },
      
      team: {
        founders: this.extractFounders(items),
        size: this.extractTeamSize(items),
        size_range: this.determineTeamSizeRange(items),
        growth_rate: this.calculateTeamGrowth(items)
      },
      
      funding: this.extractFundingData(items),
      metrics: this.extractMetrics(items),
      content: this.extractContent(items),
      
      metadata: {
        sources: [...new Set(items.map(i => i.source))],
        source_urls: this.collectSourceUrls(items),
        last_updated: new Date(),
        last_enriched: new Date(),
        data_quality: {
          completeness: 0, // Calculated later
          confidence: 0,
          verification_level: 'none',
          verified_fields: [],
          missing_fields: []
        },
        match_confidence: {
          overall: items.length > 1 ? 0.9 : 0.7,
          signals: {}
        }
      },
      
      accelerate: {
        score: 0, // Calculated later
        eligible: false,
        criteria_met: {
          is_early_stage: false,
          has_web3_focus: false,
          under_500k_funding: false,
          small_team: false,
          launched_2024_plus: false
        },
        recommendation: 'review'
      }
    };
    
    return profile;
  }
  
  /**
   * Cross-enrich profiles with data from other profiles
   */
  private crossEnrichProfiles(profiles: UnifiedProfile[]): void {
    // Index profiles by various keys for cross-referencing
    const byDomain = new Map<string, UnifiedProfile[]>();
    const byFounder = new Map<string, UnifiedProfile[]>();
    
    profiles.forEach(profile => {
      // Index by domain
      if (profile.identifiers.domain) {
        const existing = byDomain.get(profile.identifiers.domain) || [];
        existing.push(profile);
        byDomain.set(profile.identifiers.domain, existing);
      }
      
      // Index by founders
      profile.team.founders.forEach(founder => {
        const key = founder.name.toLowerCase();
        const existing = byFounder.get(key) || [];
        existing.push(profile);
        byFounder.set(key, existing);
      });
    });
    
    // Enrich based on relationships
    profiles.forEach(profile => {
      // Find related companies by founders
      profile.team.founders.forEach(founder => {
        const related = byFounder.get(founder.name.toLowerCase()) || [];
        related.forEach(relatedProfile => {
          if (relatedProfile.id !== profile.id) {
            // Note the relationship
            if (!profile.metadata.match_confidence.signals) {
              profile.metadata.match_confidence.signals = {};
            }
            profile.metadata.match_confidence.signals.founder_match = true;
          }
        });
      });
    });
  }
  
  /**
   * Calculate data quality and completeness
   */
  private calculateDataQuality(profile: UnifiedProfile): void {
    const requiredFields = [
      'canonical_name', 'description', 'identifiers.domain',
      'company.founded_date', 'team.size', 'team.founders'
    ];
    
    const importantFields = [
      'funding.total_raised', 'metrics.github_stars',
      'metrics.twitter_followers', 'content.launches'
    ];
    
    let score = 0;
    let maxScore = 0;
    const missingFields: string[] = [];
    const verifiedFields: string[] = [];
    
    // Check required fields
    requiredFields.forEach(field => {
      maxScore += 3;
      if (this.getNestedValue(profile, field)) {
        score += 3;
        verifiedFields.push(field);
      } else {
        missingFields.push(field);
      }
    });
    
    // Check important fields
    importantFields.forEach(field => {
      maxScore += 2;
      if (this.getNestedValue(profile, field)) {
        score += 2;
        verifiedFields.push(field);
      } else {
        missingFields.push(field);
      }
    });
    
    // Calculate completeness
    const completeness = Math.round((score / maxScore) * 100);
    
    // Determine verification level
    let verificationLevel: 'none' | 'partial' | 'verified' = 'none';
    if (profile.metadata.sources.length >= 3) verificationLevel = 'verified';
    else if (profile.metadata.sources.length >= 2) verificationLevel = 'partial';
    
    // Update metadata
    profile.metadata.data_quality = {
      completeness,
      confidence: profile.metadata.sources.length > 1 ? 85 : 60,
      verification_level: verificationLevel,
      verified_fields: verifiedFields,
      missing_fields: missingFields
    };
  }
  
  /**
   * Score profile for ACCELERATE criteria
   */
  private scoreForAccelerate(profile: UnifiedProfile): void {
    const criteria = profile.accelerate.criteria_met;
    
    // Check early stage
    criteria.is_early_stage = 
      profile.company.stage === 'seed' || 
      profile.company.stage === 'pre-seed' ||
      (profile.funding.total_raised || 0) < 2000000;
    
    // Check Web3 focus
    criteria.has_web3_focus = 
      profile.company.tags.some(tag => 
        ['web3', 'crypto', 'blockchain', 'defi', 'nft'].includes(tag.toLowerCase())
      ) || profile.metrics.tvl !== undefined;
    
    // Check funding limit
    criteria.under_500k_funding = (profile.funding.total_raised || 0) < 500000;
    
    // Check team size
    criteria.small_team = profile.team.size <= 10;
    
    // Check launch date
    const launchYear = profile.company.founded_date?.getFullYear();
    criteria.launched_2024_plus = launchYear ? launchYear >= 2024 : false;
    
    // Calculate score
    let score = 30; // Base score
    
    if (criteria.is_early_stage) score += 20;
    if (criteria.has_web3_focus) score += 15;
    if (criteria.under_500k_funding) score += 20;
    if (criteria.small_team) score += 15;
    if (criteria.launched_2024_plus) score += 20;
    
    // Bonus for data quality
    score += Math.round(profile.metadata.data_quality.completeness * 0.2);
    
    // Bonus for multiple sources
    if (profile.metadata.sources.length >= 3) score += 10;
    
    profile.accelerate.score = Math.min(100, score);
    profile.accelerate.eligible = score >= 60;
    
    // Determine recommendation
    if (score >= 80) profile.accelerate.recommendation = 'feature';
    else if (score >= 60) profile.accelerate.recommendation = 'approve';
    else if (score >= 40) profile.accelerate.recommendation = 'review';
    else profile.accelerate.recommendation = 'reject';
  }
  
  // Helper methods
  
  private normalizeDomain(domain: string): string {
    return domain.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
  }
  
  private normalizeName(name: string): string {
    return name.toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|labs?|technologies|tech|ai|io)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  private hasSharedContext(item1: ContentItem, item2: ContentItem): boolean {
    // Check for shared YC batch
    if (item1.metadata?.yc_batch && item2.metadata?.yc_batch) {
      if (item1.metadata.yc_batch === item2.metadata.yc_batch) return true;
    }
    
    // Check for shared location
    if (item1.metadata?.location && item2.metadata?.location) {
      if (item1.metadata.location === item2.metadata.location) return true;
    }
    
    // Check for shared tags
    if (item1.tags && item2.tags) {
      const shared = item1.tags.filter(t => item2.tags?.includes(t));
      if (shared.length >= 2) return true;
    }
    
    return false;
  }
  
  private generateEntityKey(item: ContentItem): string {
    const name = this.normalizeName(item.title);
    const source = item.source.toLowerCase();
    return `${name}-${source}-${Date.now()}`.substring(0, 50);
  }
  
  private calculateRichness(item: ContentItem): number {
    let score = 0;
    
    if (item.title) score += 1;
    if (item.description?.length > 100) score += 2;
    if (item.url) score += 1;
    if (item.metadata?.funding_raised) score += 3;
    if (item.metadata?.team_size) score += 2;
    if (item.metadata?.yc_batch) score += 3;
    if (item.metadata?.github_url) score += 2;
    if (item.metadata?.twitter_url) score += 2;
    
    return score;
  }
  
  private selectBestName(items: ContentItem[]): string {
    // Prefer YC name, then ProductHunt, then others
    const ycItem = items.find(i => i.source === 'YCombinator');
    if (ycItem) return ycItem.title;
    
    const phItem = items.find(i => i.source === 'ProductHunt');
    if (phItem) return phItem.title;
    
    // Return longest name as it's likely most complete
    return items.sort((a, b) => b.title.length - a.title.length)[0].title;
  }
  
  private collectAliases(items: ContentItem[]): string[] {
    const aliases = new Set<string>();
    items.forEach(item => {
      aliases.add(item.title);
      if (item.metadata?.company_name) {
        aliases.add(item.metadata.company_name);
      }
    });
    return Array.from(aliases);
  }
  
  private selectBestDescription(items: ContentItem[]): string {
    // Prefer longest, most detailed description
    const descriptions = items
      .map(i => i.description)
      .filter(d => d && d.length > 20)
      .sort((a, b) => b.length - a.length);
    
    return descriptions[0] || items[0].description || '';
  }
  
  private mergeIdentifiers(items: ContentItem[]): any {
    const identifiers: any = {};
    
    items.forEach(item => {
      const ids = this.extractIdentifiers(item);
      Object.assign(identifiers, ids);
    });
    
    return identifiers;
  }
  
  private extractFoundedDate(items: ContentItem[]): Date | undefined {
    for (const item of items) {
      if (item.metadata?.launch_date) {
        return new Date(item.metadata.launch_date);
      }
      if (item.metadata?.founded_date) {
        return new Date(item.metadata.founded_date);
      }
    }
    return undefined;
  }
  
  private extractLocation(items: ContentItem[]): any {
    for (const item of items) {
      if (item.metadata?.location) {
        return { city: item.metadata.location };
      }
    }
    return undefined;
  }
  
  private extractIndustries(items: ContentItem[]): string[] {
    const industries = new Set<string>();
    items.forEach(item => {
      if (item.metadata?.industry) {
        industries.add(item.metadata.industry);
      }
      // Extract from tags
      if (item.tags) {
        item.tags.forEach(tag => {
          if (!['startup', 'yc', '2024'].includes(tag.toLowerCase())) {
            industries.add(tag);
          }
        });
      }
    });
    return Array.from(industries);
  }
  
  private mergeTags(items: ContentItem[]): string[] {
    const tags = new Set<string>();
    items.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => tags.add(tag.toLowerCase()));
      }
    });
    return Array.from(tags);
  }
  
  private determineStage(items: ContentItem[]): string {
    for (const item of items) {
      if (item.metadata?.funding_stage) {
        return item.metadata.funding_stage;
      }
      if (item.metadata?.funding_round) {
        return item.metadata.funding_round;
      }
    }
    
    // Determine from funding amount
    const funding = this.extractFundingData(items);
    if (funding.total_raised) {
      if (funding.total_raised < 150000) return 'pre-seed';
      if (funding.total_raised < 2000000) return 'seed';
      if (funding.total_raised < 15000000) return 'series-a';
      return 'series-b+';
    }
    
    return 'unknown';
  }
  
  private extractFounders(items: ContentItem[]): any[] {
    const founders: any[] = [];
    const seen = new Set<string>();
    
    items.forEach(item => {
      if (item.metadata?.founders) {
        if (Array.isArray(item.metadata.founders)) {
          item.metadata.founders.forEach((f: any) => {
            const name = typeof f === 'string' ? f : f.name;
            if (name && !seen.has(name.toLowerCase())) {
              founders.push({ name });
              seen.add(name.toLowerCase());
            }
          });
        }
      }
      
      // Extract from author
      if (item.author && !item.author.includes('Bot')) {
        if (!seen.has(item.author.toLowerCase())) {
          founders.push({ name: item.author });
          seen.add(item.author.toLowerCase());
        }
      }
    });
    
    return founders;
  }
  
  private extractTeamSize(items: ContentItem[]): number {
    for (const item of items) {
      if (item.metadata?.team_size) {
        return item.metadata.team_size;
      }
    }
    return 2; // Default for startups
  }
  
  private determineTeamSizeRange(items: ContentItem[]): string {
    const size = this.extractTeamSize(items);
    if (size <= 1) return 'solo';
    if (size <= 5) return '2-5';
    if (size <= 10) return '6-10';
    if (size <= 25) return '11-25';
    if (size <= 50) return '26-50';
    return '50+';
  }
  
  private calculateTeamGrowth(items: ContentItem[]): number | undefined {
    // Would need historical data
    return undefined;
  }
  
  private extractFundingData(items: ContentItem[]): any {
    const funding: any = {
      total_raised: 0,
      investors: [],
      all_rounds: []
    };
    
    items.forEach(item => {
      if (item.metadata?.funding_raised) {
        funding.total_raised = Math.max(
          funding.total_raised,
          item.metadata.funding_raised
        );
      }
      
      if (item.metadata?.funding_amount) {
        funding.total_raised = Math.max(
          funding.total_raised,
          item.metadata.funding_amount
        );
      }
      
      if (item.metadata?.investors) {
        funding.investors.push(...item.metadata.investors);
      }
    });
    
    funding.investors = [...new Set(funding.investors)];
    
    return funding;
  }
  
  private extractMetrics(items: ContentItem[]): any {
    const metrics: any = {};
    
    items.forEach(item => {
      if (item.metadata) {
        // GitHub metrics
        if (item.metadata.github_stars) {
          metrics.github_stars = Math.max(
            metrics.github_stars || 0,
            item.metadata.github_stars
          );
        }
        
        // Social metrics
        if (item.metadata.twitter_followers) {
          metrics.twitter_followers = Math.max(
            metrics.twitter_followers || 0,
            item.metadata.twitter_followers
          );
        }
        
        // Web3 metrics
        if (item.metadata.tvl) {
          metrics.tvl = Math.max(
            metrics.tvl || 0,
            item.metadata.tvl
          );
        }
      }
    });
    
    return metrics;
  }
  
  private extractContent(items: ContentItem[]): any {
    const content: any = {
      news_articles: [],
      launches: [],
      blog_posts: [],
      social_posts: []
    };
    
    items.forEach(item => {
      // Categorize by source and type
      if (item.source.includes('RSS') || item.source.includes('TechCrunch')) {
        content.news_articles.push({
          title: item.title,
          url: item.url,
          source: item.source,
          date: new Date(item.published || Date.now()),
          summary: item.description?.substring(0, 200)
        });
      } else if (item.source === 'ProductHunt' || item.source === 'HackerNews') {
        content.launches.push({
          platform: item.source,
          url: item.url,
          date: new Date(item.published || Date.now()),
          upvotes: item.metadata?.upvotes
        });
      } else if (item.source === 'Reddit' || item.source.includes('Twitter')) {
        content.social_posts.push({
          platform: item.source,
          url: item.url,
          content: item.description?.substring(0, 280),
          engagement: item.metadata?.upvotes || item.metadata?.likes,
          date: new Date(item.published || Date.now())
        });
      }
    });
    
    return content;
  }
  
  private collectSourceUrls(items: ContentItem[]): Map<string, string> {
    const urls = new Map<string, string>();
    items.forEach(item => {
      urls.set(item.source, item.url);
    });
    return urls;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

export const multiSourceAggregator = new MultiSourceAggregator();