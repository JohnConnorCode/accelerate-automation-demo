import type { Database } from '../types/supabase';
import { z } from 'zod';
import { supabase } from './database';
import { v4 as uuidv4 } from 'uuid';

export interface FetcherConfig {
  name: string;
  url: string;
  headers?: Record<string, string>;
  rateLimit?: number; // ms between requests
  maxRetries?: number;
  timeout?: number;
}

export interface ContentItem {
  id?: string;
  source: string;
  type: 'resource' | 'project' | 'funding' | 'article' | 'tool' | 'blockchain' | 'analytics' | 'social';
  title: string;
  description: string;
  url: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  fetched_at?: Date;
  created_at?: string;
  updated_at?: string;
}

// Base schema for content validation
export const contentItemSchema = z.object({
  source: z.string(),
  type: z.enum(['resource', 'project', 'funding', 'article', 'tool', 'blockchain', 'analytics', 'social']),
  title: z.string().min(1),
  description: z.string(),
  url: z.string().url(),
  author: z.string().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.any()).optional()
});

export abstract class BaseFetcher<T> {
  protected abstract config: FetcherConfig;
  protected abstract schema: z.ZodSchema<any>;
  private lastFetchTime: number = 0;
  
  /**
   * Main execution method - handles the full fetch cycle
   */
  async execute(): Promise<{
    success: boolean;
    fetched: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let items: ContentItem[] = [];

    try {
      // Enforce rate limiting
      await this.enforceRateLimit();
      
      // Fetch raw data
      const rawData = await this.fetch();
      
      // Transform to content items
      items = await this.transform(rawData);
      
      // Validate items
      const validItems = this.validateItems(items);
      
      // Check for duplicates
      const uniqueItems = await this.checkDuplicates(validItems);
      
      // Store in database
      if (uniqueItems.length > 0) {
        await this.store(uniqueItems);
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      return {
        success: true,
        fetched: uniqueItems.length,
        errors
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      console.error(`[${this.config.name}] Error:`, error);

      // Log to database
      await this.logError(errorMessage);
      
      return {
        success: false,
        fetched: 0,
        errors
      };
    }
  }
  
  /**
   * Rate limiting enforcement
   */
  private async enforceRateLimit(): Promise<void> {
    const rateLimit = this.config.rateLimit || 1000;
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;
    
    if (timeSinceLastFetch < rateLimit) {
      const waitTime = rateLimit - timeSinceLastFetch;
      await this.delay(waitTime);
    }
    
    this.lastFetchTime = Date.now();
  }
  
  /**
   * Fetch with retry logic and timeout
   */
  protected async fetchWithRetry(
    url: string, 
    options?: RequestInit,
    retries = this.config.maxRetries || 3
  ): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 30000);
        
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.config.headers,
            ...options?.headers,
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 429 && i < retries - 1) {
            // Rate limited, wait and retry with exponential backoff
            await this.delay(Math.pow(2, i) * 1000);
            continue;
          }
          throw new Error(`${this.config.name} API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return this.schema.parse(data); // Validate with Zod
      } catch (error) {
        if (i === retries - 1) {throw error;}

        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
  
  /**
   * Validate items using content schema
   */
  private validateItems(items: ContentItem[]): ContentItem[] {
    const validated: ContentItem[] = [];
    
    for (const item of items) {
      try {
        const validItem = contentItemSchema.parse(item);
        validated.push({
          ...validItem,
          id: uuidv4(),
          fetched_at: new Date()
        });
      } catch (error) {

      }
    }
    
    return validated;
  }
  
  /**
   * Check for duplicates in the database
   */
  private async checkDuplicates(items: ContentItem[]): Promise<ContentItem[]> {
    if (items.length === 0) {return [];}
    
    try {
      const urls = items.map(item => item.url);
      
      const { data: existing } = await supabase
        .from('content_queue')
        .select('url')
        .in('url', urls);
      
      const existingUrls = new Set(existing?.map(e => e.url) || []);
      const unique = items.filter(item => !existingUrls.has(item.url));
      
      const duplicateCount = items.length - unique.length;
      if (duplicateCount > 0) {

      }
      
      return unique;
    } catch (error) {

      return items;
    }
  }
  
  /**
   * Store items in the database
   */
  private async store(items: ContentItem[]): Promise<void> {
    const batchSize = 50;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('content_queue')
        .insert(batch.map(item => ({
          id: item.id,
          source: this.config.name,
          type: item.type,
          title: item.title,
          description: item.description.length >= 50 ? item.description : 
            `${item.description}. This ${item.type} is awaiting further enrichment and validation.`, // Ensure min 50 chars
          url: item.url,
          metadata: {
            ...item.metadata,
            author: item.author,
            tags: item.tags,
            fetched_at: item.fetched_at
          },
          category: item.type, // Use type as category
          status: 'pending_review', // Use correct status value
          enriched: false,
          created_at: new Date(),
          updated_at: new Date()
        })));
      
      if (error) {
        throw error;
      }
    }
    
    // Log successful fetch
    await supabase
      .from('fetch_history')
      .insert({
        fetcher_name: this.config.name,
        items_fetched: items.length,
        success: true,
        fetched_at: new Date()
      });
  }
  
  /**
   * Log errors to database
   */
  private async logError(errorMessage: string): Promise<void> {
    try {
      await supabase
        .from('fetch_history')
        .insert({
          fetcher_name: this.config.name,
          items_fetched: 0,
          success: false,
          error_message: errorMessage,
          fetched_at: new Date()
        });
    } catch (error) {

    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected getLastWeekDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  abstract fetch(): Promise<T[]>;
  abstract transform(data: T[]): ContentItem[] | Promise<ContentItem[]>;
}