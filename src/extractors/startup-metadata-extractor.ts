/**
 * STARTUP METADATA EXTRACTOR
 * Extracts ACCELERATE-critical metadata from various content sources
 * Focus: Launch date, funding, team size, active needs
 */

import { ContentItem } from '../lib/base-fetcher';

export interface StartupMetadata {
  // ACCELERATE CRITERIA (MANDATORY)
  launch_date?: string;
  launch_year?: number;
  funding_raised?: number;
  funding_round?: string;
  team_size?: number;
  
  // PROJECT NEEDS (CRITICAL)
  seeking_funding?: boolean;
  seeking_cofounders?: boolean;
  seeking_developers?: boolean;
  seeking_users?: boolean;
  
  // ADDITIONAL VALUABLE DATA
  yc_batch?: string;
  is_yc_backed?: boolean;
  github_stars?: number;
  product_hunt_votes?: number;
  monthly_revenue?: number;
  user_count?: number;
  is_hiring?: boolean;
  tech_stack?: string[];
  location?: string;
  industry?: string;
}

export class StartupMetadataExtractor {
  /**
   * Extract metadata from HackerNews Show HN posts
   */
  static extractFromHackerNews(item: any): StartupMetadata {
    const text = `${item.title || ''} ${item.text || ''}`.toLowerCase();
    const created = new Date(item.created_at || item.created_at_i * 1000);
    
    return {
      // Launch date from post date (Show HN = launch)
      launch_date: created.toISOString(),
      launch_year: created.getFullYear(),
      
      // Parse funding mentions
      funding_raised: this.extractFundingAmount(text),
      funding_round: this.extractFundingRound(text),
      
      // Detect needs from text
      seeking_funding: text.includes('looking for funding') || 
                      text.includes('raising') ||
                      text.includes('seeking investment'),
      seeking_cofounders: text.includes('looking for co-founder') ||
                         text.includes('seeking co-founder'),
      seeking_developers: text.includes('hiring') ||
                        text.includes('looking for developers'),
      seeking_users: text.includes('early access') ||
                    text.includes('beta users') ||
                    text.includes('looking for users'),
      
      // Team size hints
      team_size: this.extractTeamSize(text),
      
      // Additional signals
      is_hiring: text.includes('hiring') || text.includes('we\'re hiring'),
    };
  }
  
  /**
   * Extract metadata from ProductHunt posts
   */
  static extractFromProductHunt(item: any): StartupMetadata {
    const description = (item.description || item.tagline || '').toLowerCase();
    
    return {
      launch_date: item.created_at || item.featured_at || new Date().toISOString(),
      launch_year: new Date(item.created_at || Date.now()).getFullYear(),
      
      // ProductHunt specific
      product_hunt_votes: item.votes_count || item.votes || 0,
      
      // Parse from tagline/description
      seeking_funding: description.includes('funding') || 
                      description.includes('investment'),
      seeking_users: true, // ProductHunt launches always seek users
      
      // Makers count as team size
      team_size: item.makers?.length || 1,
    };
  }
  
  /**
   * Extract metadata from GitHub repos
   */
  static extractFromGitHub(item: any): StartupMetadata {
    const description = (item.description || '').toLowerCase();
    const readme = (item.readme || '').toLowerCase();
    const fullText = `${description} ${readme}`;
    
    return {
      launch_date: item.created_at || new Date().toISOString(),
      launch_year: new Date(item.created_at || Date.now()).getFullYear(),
      
      // GitHub signals
      github_stars: item.stargazers_count || item.stars || 0,
      
      // Parse from description/readme
      seeking_developers: fullText.includes('contributions welcome') ||
                        fullText.includes('looking for contributors'),
      seeking_funding: fullText.includes('sponsor') ||
                      fullText.includes('funding'),
      
      // Contributors as team size
      team_size: item.contributors?.length || 1,
      
      // Tech stack from languages
      tech_stack: item.languages || [item.language].filter(Boolean),
    };
  }
  
  /**
   * Extract metadata from YC companies
   */
  static extractFromYCombinator(item: any): StartupMetadata {
    const batch = item.batch || '';
    const year = this.extractYearFromBatch(batch);
    
    return {
      launch_year: year,
      launch_date: year ? `${year}-01-01` : undefined,
      
      // YC specific
      yc_batch: batch,
      is_yc_backed: true,
      
      // YC companies typically have raised
      funding_raised: 500000, // YC standard investment
      funding_round: 'seed',
      
      // Default team size for YC
      team_size: 2, // YC prefers co-founders
      
      // Most YC companies are hiring
      is_hiring: true,
      seeking_developers: true,
    };
  }
  
  /**
   * Extract metadata from Reddit posts
   */
  static extractFromReddit(item: any): StartupMetadata {
    const text = `${item.title || ''} ${item.selftext || ''}`.toLowerCase();
    const created = new Date((item.created_utc || item.created) * 1000);
    
    return {
      launch_date: created.toISOString(),
      launch_year: created.getFullYear(),
      
      // Parse from post content
      funding_raised: this.extractFundingAmount(text),
      seeking_funding: text.includes('looking for funding') ||
                      text.includes('seeking investment'),
      seeking_cofounders: text.includes('looking for co-founder'),
      seeking_users: text.includes('beta') || text.includes('early users'),
      
      team_size: this.extractTeamSize(text),
    };
  }
  
  /**
   * Extract funding amount from text
   */
  private static extractFundingAmount(text: string): number | undefined {
    // Match patterns like $100k, $1M, $1.5m
    const patterns = [
      /\$(\d+(?:\.\d+)?)\s*k/i,  // $XXk
      /\$(\d+(?:\.\d+)?)\s*m/i,  // $XXm
      /raised\s+\$(\d+(?:,\d{3})*)/i,  // raised $XXX,XXX
      /funding.*\$(\d+(?:,\d{3})*)/i,  // funding ... $XXX
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = parseFloat(match[1].replace(/,/g, ''));
        if (pattern.source.includes('k')) amount *= 1000;
        if (pattern.source.includes('m')) amount *= 1000000;
        return amount;
      }
    }
    
    // Check for unfunded/bootstrapped
    if (text.includes('bootstrapped') || text.includes('unfunded')) {
      return 0;
    }
    
    return undefined;
  }
  
  /**
   * Extract funding round from text
   */
  private static extractFundingRound(text: string): string | undefined {
    const rounds = ['pre-seed', 'seed', 'series a', 'series b'];
    for (const round of rounds) {
      if (text.includes(round)) return round;
    }
    return undefined;
  }
  
  /**
   * Extract team size from text
   */
  private static extractTeamSize(text: string): number | undefined {
    // Match patterns like "team of 3", "3-person team", "solo founder"
    const patterns = [
      /team\s+of\s+(\d+)/i,
      /(\d+)[\s-]person\s+team/i,
      /(\d+)\s+employees/i,
      /(\d+)\s+people/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    if (text.includes('solo') || text.includes('solopreneur')) {
      return 1;
    }
    
    if (text.includes('co-founder') || text.includes('cofounder')) {
      return 2; // At least 2 if looking for co-founder
    }
    
    return undefined;
  }
  
  /**
   * Extract year from YC batch format (W25, S24, etc)
   */
  private static extractYearFromBatch(batch: string): number | undefined {
    const match = batch.match(/[WS](\d{2})/);
    if (match) {
      const year = parseInt(match[1]);
      // Convert 2-digit year to 4-digit
      return year < 50 ? 2000 + year : 1900 + year;
    }
    return undefined;
  }
  
  /**
   * Apply metadata extraction based on source
   */
  static enrichContentItem(item: ContentItem): ContentItem {
    let metadata: StartupMetadata = {};
    
    // Apply source-specific extraction
    switch (item.source?.toLowerCase()) {
      case 'hackernews':
      case 'hackernews-showhn':
        metadata = this.extractFromHackerNews(item);
        break;
        
      case 'producthunt':
      case 'producthunt-rss':
        metadata = this.extractFromProductHunt(item);
        break;
        
      case 'github':
      case 'github-trending':
        metadata = this.extractFromGitHub(item);
        break;
        
      case 'ycombinator':
      case 'ycombinator-companies':
        metadata = this.extractFromYCombinator(item);
        break;
        
      case 'reddit':
      case 'reddit-startups':
        metadata = this.extractFromReddit(item);
        break;
    }
    
    // Merge with existing metadata
    return {
      ...item,
      metadata: {
        ...item.metadata,
        ...metadata,
        
        // Calculate project needs array
        project_needs: [
          metadata.seeking_funding && 'funding',
          metadata.seeking_cofounders && 'co-founder',
          metadata.seeking_developers && 'developers',
          metadata.seeking_users && 'users',
        ].filter(Boolean) as string[],
        
        // Add extraction timestamp
        metadata_extracted_at: new Date().toISOString(),
      }
    };
  }
  
  /**
   * Batch enrich multiple items
   */
  static enrichItems(items: ContentItem[]): ContentItem[] {
    return items.map(item => this.enrichContentItem(item));
  }
  
  /**
   * Validate item meets ACCELERATE criteria
   */
  static meetsAccelerateCriteria(item: ContentItem): boolean {
    const meta = item.metadata || {};
    
    // Must be 2024+ project
    if (meta.launch_year && meta.launch_year < 2024) {
      return false;
    }
    
    // Must be under $500k funding
    if (meta.funding_raised && meta.funding_raised > 500000) {
      return false;
    }
    
    // Team size should be 1-10
    if (meta.team_size && (meta.team_size < 1 || meta.team_size > 10)) {
      return false;
    }
    
    // Should have at least one need
    const needs = meta.project_needs || [];
    if (needs.length === 0 && item.type === 'project') {
      return false; // Projects without needs aren't valuable
    }
    
    return true;
  }
}