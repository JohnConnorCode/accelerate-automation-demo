import { EventEmitter } from 'events';
import { Octokit } from '@octokit/rest';
import { ethers } from 'ethers';
import fetch from 'node-fetch';
import { supabase } from './database';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Simplified Data Pipeline for Accelerate Platform
 * Focuses on crawling, cleaning, and structuring data
 */

export interface CleanedDataItem {
  id: string;
  source: string;
  type: 'project' | 'article' | 'announcement' | 'tutorial' | 'event' | 'job';
  title: string;
  description: string;
  url: string;
  author?: string;
  timestamp: Date;
  tags: string[];
  category: string;
  cleaned: boolean;
  metadata: Record<string, any>;
}

export class AccelerateDataPipeline extends EventEmitter {
  private octokit: Octokit;
  private providers: Map<string, ethers.Provider> = new Map();
  private batchSize = 50;
  private dataQueue: any[] = [];

  constructor() {
    super();
    
    // Initialize GitHub client
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });

    // Initialize blockchain providers for basic data
    this.initializeProviders();
  }

  private initializeProviders() {
    // Simple provider setup for reading blockchain data
    const providers = {
      ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      polygon: 'https://polygon-rpc.com'
    };

    for (const [network, url] of Object.entries(providers)) {
      this.providers.set(network, new ethers.JsonRpcProvider(url));
    }
  }

  /**
   * Main crawl function - gets raw data from various sources
   */
  async crawlSources(sources: string[] = ['github', 'devto', 'medium', 'hackernews']): Promise<any[]> {

    const rawData: any[] = [];

    for (const source of sources) {
      try {
        const data = await this.crawlSource(source);
        rawData.push(...data);

      } catch (error) {

      }
    }

    return rawData;
  }

  private async crawlSource(source: string): Promise<any[]> {
    switch (source) {
      case 'github':
        return this.crawlGitHub();
      case 'devto':
        return this.crawlDevTo();
      case 'medium':
        return this.crawlMedium();
      case 'hackernews':
        return this.crawlHackerNews();
      default:
        return [];
    }
  }

  private async crawlGitHub(): Promise<any[]> {
    // Get trending Web3/blockchain repos
    const { data } = await this.octokit.search.repos({
      q: 'blockchain OR web3 OR defi OR nft stars:>50 pushed:>2024-01-01',
      sort: 'stars',
      order: 'desc',
      per_page: 30
    });

    return data.items.map(repo => ({
      source: 'github',
      type: 'repository',
      title: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      topics: repo.topics,
      lastUpdated: repo.updated_at,
      raw: true
    }));
  }

  private async crawlDevTo(): Promise<any[]> {
    // Fetch Web3 articles from dev.to
    try {
      const response = await fetch('https://dev.to/api/articles?tag=web3&per_page=30');
      const articles = await response.json() as any[];
      
      return articles.map((article: any) => ({
        source: 'devto',
        type: 'article',
        title: article.title,
        description: article.description,
        url: article.url,
        author: article.user.username,
        tags: article.tag_list,
        publishedAt: article.published_at,
        raw: true
      }));
    } catch (error) {

      return [];
    }
  }

  private async crawlMedium(): Promise<any[]> {
    // Medium doesn't have a public API, so we'd use RSS feeds
    try {
      const topics = ['blockchain', 'web3', 'cryptocurrency', 'defi'];
      const articles: any[] = [];
      
      for (const topic of topics) {
        // This would normally fetch from Medium's RSS feed
        // Simplified for demonstration
        articles.push({
          source: 'medium',
          type: 'article',
          topic,
          raw: true,
          placeholder: true // Would be real data
        });
      }
      
      return articles;
    } catch (error) {

      return [];
    }
  }

  private async crawlHackerNews(): Promise<any[]> {
    // Fetch top stories related to blockchain
    try {
      const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const storyIds = await response.json() as number[];
      const stories: any[] = [];
      
      // Get first 20 stories
      for (const id of storyIds.slice(0, 20)) {
        const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const story = await storyResponse.json() as any;
        
        // Filter for relevant content
        if (story.title && (
          story.title.toLowerCase().includes('blockchain') ||
          story.title.toLowerCase().includes('crypto') ||
          story.title.toLowerCase().includes('web3')
        )) {
          stories.push({
            source: 'hackernews',
            type: 'discussion',
            title: story.title,
            url: story.url,
            score: story.score,
            author: story.by,
            time: story.time,
            raw: true
          });
        }
      }
      
      return stories;
    } catch (error) {

      return [];
    }
  }

  /**
   * Clean and structure raw data
   */
  async cleanData(rawData: any[]): Promise<CleanedDataItem[]> {

    const cleaned: CleanedDataItem[] = [];

    for (const item of rawData) {
      try {
        const cleanedItem = await this.cleanItem(item);
        if (cleanedItem) {
          cleaned.push(cleanedItem);
        }
      } catch (error) {

      }
    }

    return cleaned;
  }

  private async cleanItem(item: any): Promise<CleanedDataItem | null> {
    // Skip if missing essential fields
    if (!item.title && !item.description) return null;

    // Generate unique ID
    const id = this.generateId(item);

    // Clean and sanitize text
    const title = this.sanitizeText(item.title || '');
    const description = this.sanitizeText(item.description || item.summary || '');

    // Extract and normalize tags
    const tags = this.extractTags(item);

    // Determine category
    const category = this.categorizeItem(item, tags);

    // Determine type
    const type = this.determineType(item);

    // Build cleaned item
    const cleanedItem: CleanedDataItem = {
      id,
      source: item.source,
      type,
      title,
      description,
      url: item.url || '',
      author: item.author || item.user?.username || item.by,
      timestamp: this.parseTimestamp(item),
      tags,
      category,
      cleaned: true,
      metadata: this.extractMetadata(item)
    };

    return cleanedItem;
  }

  private sanitizeText(text: string): string {
    // Remove HTML tags and sanitize
    const cleaned = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
    // Remove extra whitespace
    return cleaned.replace(/\s+/g, ' ').trim();
  }

  private extractTags(item: any): string[] {
    const tags = new Set<string>();

    // Add existing tags
    if (item.tags) {
      if (Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => tags.add(tag.toLowerCase()));
      } else if (typeof item.tags === 'string') {
        item.tags.split(',').forEach((tag: string) => tags.add(tag.trim().toLowerCase()));
      }
    }

    // Add topics
    if (item.topics && Array.isArray(item.topics)) {
      item.topics.forEach((topic: string) => tags.add(topic.toLowerCase()));
    }

    // Add tag_list (dev.to)
    if (item.tag_list && Array.isArray(item.tag_list)) {
      item.tag_list.forEach((tag: string) => tags.add(tag.toLowerCase()));
    }

    // Extract tags from title and description
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    const keywords = ['defi', 'nft', 'dao', 'web3', 'blockchain', 'ethereum', 'solidity', 'smart contract'];
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        tags.add(keyword);
      }
    });

    return Array.from(tags);
  }

  private categorizeItem(item: any, tags: string[]): string {
    // Categorize based on tags and content
    if (tags.includes('defi') || tags.includes('finance')) return 'DeFi';
    if (tags.includes('nft') || tags.includes('art')) return 'NFT';
    if (tags.includes('dao') || tags.includes('governance')) return 'DAO';
    if (tags.includes('infrastructure') || tags.includes('protocol')) return 'Infrastructure';
    if (tags.includes('gaming') || tags.includes('gamefi')) return 'Gaming';
    if (tags.includes('tutorial') || tags.includes('guide')) return 'Education';
    if (item.type === 'repository') return 'Development';
    return 'General';
  }

  private determineType(item: any): CleanedDataItem['type'] {
    if (item.type === 'repository') return 'project';
    if (item.type === 'article') return 'article';
    if (item.type === 'discussion') return 'article';
    if (item.title?.toLowerCase().includes('hiring') || item.title?.toLowerCase().includes('job')) return 'job';
    if (item.title?.toLowerCase().includes('conference') || item.title?.toLowerCase().includes('hackathon')) return 'event';
    if (item.title?.toLowerCase().includes('tutorial') || item.title?.toLowerCase().includes('guide')) return 'tutorial';
    if (item.title?.toLowerCase().includes('announcement') || item.title?.toLowerCase().includes('launch')) return 'announcement';
    return 'article';
  }

  private parseTimestamp(item: any): Date {
    if (item.publishedAt) return new Date(item.publishedAt);
    if (item.published_at) return new Date(item.published_at);
    if (item.lastUpdated) return new Date(item.lastUpdated);
    if (item.updated_at) return new Date(item.updated_at);
    if (item.time) return new Date(item.time * 1000); // HN uses unix timestamp
    return new Date();
  }

  private extractMetadata(item: any): Record<string, any> {
    const metadata: Record<string, any> = {};
    
    // GitHub specific
    if (item.source === 'github') {
      metadata.stars = item.stars;
      metadata.language = item.language;
      metadata.forks = item.forks_count;
    }
    
    // Article specific
    if (item.reading_time_minutes) {
      metadata.readingTime = item.reading_time_minutes;
    }
    
    // HackerNews specific
    if (item.score) {
      metadata.score = item.score;
    }
    
    // Dev.to specific
    if (item.positive_reactions_count) {
      metadata.reactions = item.positive_reactions_count;
    }
    
    return metadata;
  }

  private generateId(item: any): string {
    const source = item.source || 'unknown';
    const title = item.title || item.url || Math.random().toString();
    return `${source}_${Buffer.from(title).toString('base64').substring(0, 10)}_${Date.now()}`;
  }

  /**
   * Store cleaned data in database
   */
  async storeData(cleanedData: CleanedDataItem[]): Promise<void> {

    // Batch insert for efficiency
    const batches = [];
    for (let i = 0; i < cleanedData.length; i += this.batchSize) {
      batches.push(cleanedData.slice(i, i + this.batchSize));
    }

    for (const batch of batches) {
      try {
        const { error } = await supabase
          .from('content_queue')
          .insert(batch.map(item => ({
            source: item.source,
            type: item.type,
            title: item.title,
            description: item.description,
            url: item.url,
            author: item.author,
            tags: item.tags,
            category: item.category,
            metadata: item.metadata,
            status: 'pending',
            created_at: item.timestamp.toISOString()
          })));

        if (error) {

        }
      } catch (error) {

      }
    }

  }

  /**
   * Main pipeline execution
   */
  async run(sources?: string[]): Promise<{
    crawled: number;
    cleaned: number;
    stored: number;
  }> {

    // Step 1: Crawl data
    const rawData = await this.crawlSources(sources);
    
    // Step 2: Clean data
    const cleanedData = await this.cleanData(rawData);
    
    // Step 3: Store data
    await this.storeData(cleanedData);
    
    const stats = {
      crawled: rawData.length,
      cleaned: cleanedData.length,
      stored: cleanedData.length
    };

    this.emit('complete', stats);
    
    return stats;
  }
}

// Export singleton
export const accelerateDataPipeline = new AccelerateDataPipeline();