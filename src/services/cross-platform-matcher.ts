/**
 * CROSS-PLATFORM MATCHER
 * Finds the same company across ProductHunt, GitHub, Twitter, LinkedIn, etc.
 */

import { ContentItem } from '../lib/base-fetcher';

export interface PlatformIdentity {
  platform: string;
  identifier: string;
  url: string;
  confidence: number;
  verified: boolean;
  metadata?: any;
}

export interface CrossPlatformProfile {
  company_name: string;
  platforms: Map<string, PlatformIdentity>;
  connections: {
    from: string;
    to: string;
    confidence: number;
    method: string; // How we found the connection
  }[];
  enrichment_opportunities: string[]; // Platforms we should fetch from
}

export class CrossPlatformMatcher {
  
  /**
   * Find a company across all platforms starting from one known identity
   */
  async findAcrossPlatforms(
    knownIdentity: { platform: string; identifier: string }
  ): Promise<CrossPlatformProfile> {
    console.log(`🔍 Finding ${knownIdentity.identifier} across platforms...`);
    
    const profile: CrossPlatformProfile = {
      company_name: knownIdentity.identifier,
      platforms: new Map(),
      connections: [],
      enrichment_opportunities: []
    };
    
    // Add known identity
    profile.platforms.set(knownIdentity.platform, {
      platform: knownIdentity.platform,
      identifier: knownIdentity.identifier,
      url: this.buildPlatformUrl(knownIdentity.platform, knownIdentity.identifier),
      confidence: 1.0,
      verified: true
    });
    
    // Search other platforms
    if (knownIdentity.platform === 'yc') {
      await this.findFromYC(knownIdentity.identifier, profile);
    } else if (knownIdentity.platform === 'producthunt') {
      await this.findFromProductHunt(knownIdentity.identifier, profile);
    } else if (knownIdentity.platform === 'github') {
      await this.findFromGitHub(knownIdentity.identifier, profile);
    }
    
    // Identify missing platforms for enrichment
    this.identifyEnrichmentOpportunities(profile);
    
    return profile;
  }
  
  /**
   * Match items from different sources
   */
  async matchItems(items: ContentItem[]): Promise<Map<string, ContentItem[]>> {
    const matches = new Map<string, ContentItem[]>();
    const processed = new Set<string>();
    
    for (const item of items) {
      const itemKey = this.getItemKey(item);
      if (processed.has(itemKey)) continue;
      
      // Find all potential matches
      const matchGroup = [item];
      processed.add(itemKey);
      
      for (const candidate of items) {
        const candidateKey = this.getItemKey(candidate);
        if (processed.has(candidateKey)) continue;
        
        const matchResult = await this.compareItems(item, candidate);
        if (matchResult.isMatch) {
          matchGroup.push(candidate);
          processed.add(candidateKey);
        }
      }
      
      // Store match group
      const groupKey = this.generateGroupKey(matchGroup);
      matches.set(groupKey, matchGroup);
    }
    
    return matches;
  }
  
  /**
   * Find company starting from YC
   */
  private async findFromYC(ycSlug: string, profile: CrossPlatformProfile): Promise<void> {
    // YC companies often have predictable patterns
    
    // 1. Try to find ProductHunt
    const possiblePHSlugs = [
      ycSlug.toLowerCase(),
      ycSlug.replace(/-/g, ''),
      ycSlug.replace(/-ai$/, ''),
      ycSlug.replace(/-io$/, '')
    ];
    
    for (const slug of possiblePHSlugs) {
      const phUrl = `https://www.producthunt.com/products/${slug}`;
      // In real implementation, we'd check if this URL exists
      // For now, we'll add it as a potential match
      if (await this.checkUrlExists(phUrl)) {
        profile.platforms.set('producthunt', {
          platform: 'producthunt',
          identifier: slug,
          url: phUrl,
          confidence: 0.8,
          verified: false
        });
        
        profile.connections.push({
          from: 'yc',
          to: 'producthunt',
          confidence: 0.8,
          method: 'slug_similarity'
        });
      }
    }
    
    // 2. Try to find GitHub
    const possibleGitHubOrgs = [
      ycSlug.toLowerCase(),
      ycSlug.replace(/-/g, ''),
      ycSlug + '-inc',
      ycSlug + '-labs'
    ];
    
    for (const org of possibleGitHubOrgs) {
      const ghUrl = `https://github.com/${org}`;
      if (await this.checkGitHubOrgExists(org)) {
        profile.platforms.set('github', {
          platform: 'github',
          identifier: org,
          url: ghUrl,
          confidence: 0.85,
          verified: false
        });
        
        profile.connections.push({
          from: 'yc',
          to: 'github',
          confidence: 0.85,
          method: 'org_name_match'
        });
      }
    }
    
    // 3. Try to find Twitter
    // YC companies often tweet their launch
    const possibleTwitterHandles = [
      ycSlug.toLowerCase(),
      ycSlug.replace(/-/g, ''),
      ycSlug + 'hq',
      ycSlug + '_app'
    ];
    
    for (const handle of possibleTwitterHandles) {
      // Would check Twitter API
      profile.platforms.set('twitter', {
        platform: 'twitter',
        identifier: handle,
        url: `https://twitter.com/${handle}`,
        confidence: 0.7,
        verified: false
      });
    }
  }
  
  /**
   * Find company starting from ProductHunt
   */
  private async findFromProductHunt(phSlug: string, profile: CrossPlatformProfile): Promise<void> {
    // ProductHunt profiles often link to other platforms
    
    // Would scrape ProductHunt page for:
    // - Website URL -> extract domain
    // - Twitter handle
    // - GitHub repo
    // - Maker profiles -> founder LinkedIn
    
    // For now, add common patterns
    profile.platforms.set('website', {
      platform: 'website',
      identifier: `${phSlug}.com`,
      url: `https://${phSlug}.com`,
      confidence: 0.6,
      verified: false
    });
  }
  
  /**
   * Find company starting from GitHub
   */
  private async findFromGitHub(ghOrg: string, profile: CrossPlatformProfile): Promise<void> {
    // GitHub orgs often have:
    // - Website in org profile
    // - Twitter in org profile
    // - Contributors who are founders
    
    // Would use GitHub API to get org details
    // For now, predict common patterns
    
    const companyName = ghOrg.replace(/-/g, '');
    
    profile.platforms.set('website', {
      platform: 'website',
      identifier: `${companyName}.com`,
      url: `https://${companyName}.com`,
      confidence: 0.7,
      verified: false
    });
    
    profile.platforms.set('producthunt', {
      platform: 'producthunt',
      identifier: ghOrg,
      url: `https://www.producthunt.com/products/${ghOrg}`,
      confidence: 0.6,
      verified: false
    });
  }
  
  /**
   * Compare two items to see if they match
   */
  private async compareItems(item1: ContentItem, item2: ContentItem): Promise<{
    isMatch: boolean;
    confidence: number;
    signals: string[];
  }> {
    const signals: string[] = [];
    let score = 0;
    
    // 1. Domain match
    const domain1 = this.extractDomain(item1);
    const domain2 = this.extractDomain(item2);
    
    if (domain1 && domain2 && domain1 === domain2) {
      score += 0.9;
      signals.push('same_domain');
    }
    
    // 2. Name similarity
    const name1 = this.normalizeName(item1.title);
    const name2 = this.normalizeName(item2.title);
    const nameSimilarity = this.calculateSimilarity(name1, name2);
    
    if (nameSimilarity > 0.9) {
      score += 0.8;
      signals.push('exact_name_match');
    } else if (nameSimilarity > 0.7) {
      score += 0.4;
      signals.push('similar_name');
    }
    
    // 3. Social handle match
    const social1 = this.extractSocialHandles(item1);
    const social2 = this.extractSocialHandles(item2);
    
    if (social1.twitter && social2.twitter && social1.twitter === social2.twitter) {
      score += 0.7;
      signals.push('same_twitter');
    }
    
    if (social1.github && social2.github && social1.github === social2.github) {
      score += 0.8;
      signals.push('same_github');
    }
    
    // 4. Founder match
    const founders1 = this.extractFounders(item1);
    const founders2 = this.extractFounders(item2);
    
    const commonFounders = founders1.filter(f1 => 
      founders2.some(f2 => this.normalizeName(f1) === this.normalizeName(f2))
    );
    
    if (commonFounders.length > 0) {
      score += 0.6;
      signals.push('common_founders');
    }
    
    // 5. Description similarity
    if (item1.description && item2.description) {
      const descSimilarity = this.calculateTextSimilarity(
        item1.description.substring(0, 200),
        item2.description.substring(0, 200)
      );
      
      if (descSimilarity > 0.7) {
        score += 0.3;
        signals.push('similar_description');
      }
    }
    
    // 6. Temporal proximity
    if (item1.published && item2.published) {
      const date1 = new Date(item1.published);
      const date2 = new Date(item2.published);
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        score += 0.2;
        signals.push('temporal_proximity');
      }
    }
    
    // 7. YC batch match
    if (item1.metadata?.yc_batch && item2.metadata?.yc_batch) {
      if (item1.metadata.yc_batch === item2.metadata.yc_batch) {
        if (nameSimilarity > 0.6) {
          score += 0.5;
          signals.push('same_yc_batch');
        }
      }
    }
    
    return {
      isMatch: score >= 0.7,
      confidence: Math.min(1.0, score),
      signals
    };
  }
  
  /**
   * Identify which platforms we should fetch from
   */
  private identifyEnrichmentOpportunities(profile: CrossPlatformProfile): void {
    const allPlatforms = [
      'yc', 'producthunt', 'github', 'twitter', 'linkedin',
      'crunchbase', 'angellist', 'website', 'reddit', 'hackernews'
    ];
    
    const existing = new Set(profile.platforms.keys());
    
    profile.enrichment_opportunities = allPlatforms.filter(p => !existing.has(p));
  }
  
  // Helper methods
  
  private buildPlatformUrl(platform: string, identifier: string): string {
    const urls: Record<string, string> = {
      yc: `https://www.ycombinator.com/companies/${identifier}`,
      producthunt: `https://www.producthunt.com/products/${identifier}`,
      github: `https://github.com/${identifier}`,
      twitter: `https://twitter.com/${identifier}`,
      linkedin: `https://www.linkedin.com/company/${identifier}`,
      crunchbase: `https://www.crunchbase.com/organization/${identifier}`,
      angellist: `https://angel.co/${identifier}`,
      reddit: `https://www.reddit.com/r/${identifier}`,
      hackernews: `https://news.ycombinator.com/from?site=${identifier}`
    };
    
    return urls[platform] || `https://${identifier}`;
  }
  
  private async checkUrlExists(url: string): Promise<boolean> {
    // In real implementation, would make HEAD request
    // For now, return probability based on patterns
    return Math.random() > 0.5;
  }
  
  private async checkGitHubOrgExists(org: string): Promise<boolean> {
    // Would use GitHub API
    // For now, return probability
    return Math.random() > 0.4;
  }
  
  private getItemKey(item: ContentItem): string {
    return `${item.source}:${item.title}:${item.url}`;
  }
  
  private generateGroupKey(items: ContentItem[]): string {
    const names = items.map(i => this.normalizeName(i.title)).sort();
    return names.join(':');
  }
  
  private extractDomain(item: ContentItem): string | null {
    if (!item.url) return null;
    
    try {
      const url = new URL(item.url);
      return url.hostname.replace('www.', '');
    } catch {
      return null;
    }
  }
  
  private normalizeName(name: string): string {
    return name.toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|labs?|technologies|tech|ai|io)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
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
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
  
  private extractSocialHandles(item: ContentItem): any {
    const handles: any = {};
    
    // From metadata
    if (item.metadata?.twitter_url) {
      const match = item.metadata.twitter_url.match(/twitter\.com\/([^\/]+)/);
      if (match) handles.twitter = match[1].toLowerCase();
    }
    
    if (item.metadata?.github_url) {
      const match = item.metadata.github_url.match(/github\.com\/([^\/]+)/);
      if (match) handles.github = match[1].toLowerCase();
    }
    
    // From description
    const text = `${item.title} ${item.description}`.toLowerCase();
    
    const twitterMatch = text.match(/@([a-z0-9_]+)/);
    if (twitterMatch) handles.twitter = twitterMatch[1];
    
    const githubMatch = text.match(/github\.com\/([a-z0-9-]+)/);
    if (githubMatch) handles.github = githubMatch[1];
    
    return handles;
  }
  
  private extractFounders(item: ContentItem): string[] {
    const founders: string[] = [];
    
    if (item.metadata?.founders) {
      if (Array.isArray(item.metadata.founders)) {
        founders.push(...item.metadata.founders);
      }
    }
    
    if (item.author && !item.author.includes('Bot')) {
      founders.push(item.author);
    }
    
    // Extract from description
    const founderMatch = item.description?.match(/(?:founded by|created by|built by) ([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (founderMatch) {
      founders.push(founderMatch[1]);
    }
    
    return founders;
  }
}

export const crossPlatformMatcher = new CrossPlatformMatcher();