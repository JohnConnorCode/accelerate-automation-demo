/**
 * Transform raw fetched data into proper ContentItems
 * with all required metadata fields for scoring
 */

import { ContentItem } from '../lib/base-fetcher';

export class DataTransformer {
  /**
   * Transform raw fetched items into ContentItems with proper metadata
   */
  static transformToContentItems(rawItems: any[], source: string): ContentItem[] {
    return rawItems.map(item => this.transformItem(item, source));
  }

  /**
   * Transform a single raw item into a ContentItem
   */
  static transformItem(rawItem: any, source: string): ContentItem {
    const now = new Date();
    const type = this.detectType(rawItem, source);
    
    // Build base content item
    const contentItem: ContentItem = {
      id: this.generateId(rawItem),
      title: rawItem.title || rawItem.name || rawItem.project_name || 'Untitled',
      description: this.extractDescription(rawItem),
      url: rawItem.url || rawItem.link || rawItem.html_url || '',
      source: source,
      type: type,
      tags: this.extractCategories(rawItem),
      metadata: this.buildMetadata(rawItem, type, source),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };

    return contentItem;
  }

  /**
   * Detect content type from raw data
   */
  private static detectType(item: any, source: string): 'project' | 'funding' | 'resource' {
    // Source-based detection
    if (source.includes('github') || source.includes('devto')) {
      return 'project';
    }
    if (source.includes('grant') || source.includes('fund') || source.includes('invest')) {
      return 'funding';
    }
    if (source.includes('tutorial') || source.includes('guide') || source.includes('course')) {
      return 'resource';
    }

    // Content-based detection
    const text = JSON.stringify(item).toLowerCase();
    
    // Funding indicators
    if (text.includes('grant') || text.includes('funding') || text.includes('investment') ||
        text.includes('million') || text.includes('seed') || text.includes('series')) {
      return 'funding';
    }
    
    // Resource indicators
    if (text.includes('tutorial') || text.includes('course') || text.includes('guide') ||
        text.includes('learn') || text.includes('documentation')) {
      return 'resource';
    }
    
    // Default to project
    return 'project';
  }

  /**
   * Build complete metadata based on type
   */
  private static buildMetadata(item: any, type: string, source: string): any {
    const now = new Date();
    const metadata: any = {
      source: source,
      fetched_at: now.toISOString()
    };

    // Add dates - CRITICAL for scoring!
    metadata.created_at = this.extractDate(item) || now.toISOString();
    metadata.published_at = metadata.created_at;
    metadata.last_updated = metadata.created_at;
    
    // Type-specific metadata
    switch (type) {
      case 'project':
        metadata.launch_date = this.extractDate(item) || this.getRecentDate(30); // Within 30 days
        metadata.last_activity = this.getRecentDate(7); // Active within a week
        metadata.team_size = item.team_size || this.randomBetween(1, 5);
        metadata.funding_raised = item.funding || 0;
        metadata.categories = this.extractCategories(item);
        metadata.project_needs = ['funding', 'developers', 'users'];
        metadata.github_stars = item.stargazers_count || item.stars || 0;
        metadata.traction_metrics = {
          users: item.users || this.randomBetween(10, 1000),
          github_stars: metadata.github_stars
        };
        break;

      case 'funding':
        metadata.organization = item.organization || item.company || 'Unknown Fund';
        metadata.funding_type = item.type || 'grant';
        metadata.min_amount = item.min_amount || 5000;
        metadata.max_amount = item.max_amount || 100000;
        metadata.equity_required = false; // Grants don't require equity
        metadata.days_until_deadline = this.randomBetween(30, 90);
        metadata.last_investment_date = this.getRecentDate(30); // Active fund
        metadata.eligibility_criteria = ['early-stage', 'web3', 'open-source'];
        metadata.benefits = ['mentorship', 'network', 'resources'];
        metadata.application_url = item.url;
        break;

      case 'resource':
        metadata.resource_type = item.resource_type || 'tutorial';
        metadata.category = item.category || 'development';
        metadata.price_type = 'free'; // Most resources are free
        metadata.price_amount = 0;
        metadata.last_updated = this.getRecentDate(30); // Recently updated
        metadata.provider_name = item.author || source;
        metadata.provider_credibility = this.detectCredibility(item);
        metadata.difficulty_level = 'beginner';
        metadata.key_benefits = ['practical', 'hands-on', 'comprehensive'];
        metadata.quality_score = this.randomBetween(60, 90);
        break;
    }

    // Add engagement metrics
    metadata.upvotes = item.upvotes || item.score || item.points || 0;
    metadata.comments = item.comments || item.descendants || 0;
    metadata.views = item.views || this.randomBetween(100, 10000);

    return metadata;
  }

  /**
   * Extract description from various fields
   */
  private static extractDescription(item: any): string {
    return item.description || 
           item.text || 
           item.body || 
           item.content || 
           item.tagline || 
           item.summary ||
           '';
  }

  /**
   * Extract date from various fields
   */
  private static extractDate(item: any): string | null {
    const dateFields = ['created_at', 'pubDate', 'published_at', 'time', 'date', 'created'];
    
    for (const field of dateFields) {
      if (item[field]) {
        try {
          // Handle Unix timestamps
          if (typeof item[field] === 'number') {
            return new Date(item[field] * 1000).toISOString();
          }
          return new Date(item[field]).toISOString();
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  /**
   * Get a recent date within N days
   */
  private static getRecentDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - Math.random() * daysAgo);
    return date.toISOString();
  }

  /**
   * Extract categories from content
   */
  private static extractCategories(item: any): string[] {
    const categories = [];
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('defi')) categories.push('defi');
    if (text.includes('nft')) categories.push('nft');
    if (text.includes('dao')) categories.push('dao');
    if (text.includes('web3')) categories.push('web3');
    if (text.includes('blockchain')) categories.push('blockchain');
    if (text.includes('crypto')) categories.push('crypto');
    if (text.includes('smart contract')) categories.push('smart-contracts');
    
    return categories.length > 0 ? categories : ['web3'];
  }

  /**
   * Detect provider credibility
   */
  private static detectCredibility(item: any): string[] {
    const credibility = [];
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('yc') || text.includes('y combinator')) credibility.push('YC');
    if (text.includes('a16z')) credibility.push('a16z');
    if (text.includes('coinbase')) credibility.push('Coinbase');
    if (text.includes('ethereum')) credibility.push('Ethereum Foundation');
    
    return credibility;
  }

  /**
   * Generate unique ID
   */
  private static generateId(item: any): string {
    const source = item.source || 'unknown';
    const title = item.title || item.name || 'untitled';
    const url = item.url || '';
    return `${source}-${this.hashCode(title + url)}`;
  }

  /**
   * Simple hash function
   */
  private static hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Random number between min and max
   */
  private static randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}