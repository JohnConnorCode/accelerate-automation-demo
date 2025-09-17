/**
 * Simple, robust content fetcher with built-in rate limiting
 * Now enhanced with retry logic and circuit breakers
 */
import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase-client';
import { retryFetcher } from '../lib/retry-fetcher';

interface FetchResult {
  source: string;
  items: any[];
  errors: string[];
}

interface RateLimitConfig {
  requestsPerMinute: number;
  retryAfter: number;
}

class SimpleFetcher {
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  private readonly config: RateLimitConfig = {
    requestsPerMinute: 30,
    retryAfter: 60000 // 1 minute
  };

  /**
   * Fetch content from a source with automatic rate limiting
   */
  async fetch(source: string, url: string): Promise<FetchResult> {
    const result: FetchResult = {
      source,
      items: [],
      errors: []
    };

    try {
      // Check rate limit
      if (!this.checkRateLimit(source)) {
        result.errors.push(`Rate limit exceeded for ${source}`);
        return result;
      }

      // Use retry fetcher with exponential backoff
      const response = await retryFetcher.fetchWithRetry(url, {
        headers: {
          'User-Agent': 'Accelerate-Content-Bot/1.0'
        }
      }, {
        maxRetries: 3,
        initialDelay: 1000,
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      result.items = this.normalizeData(source, data);
      
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Batch fetch from multiple sources
   */
  async fetchAll(sources: Map<string, string>): Promise<FetchResult[]> {
    const results: FetchResult[] = [];
    
    // Process in batches of 3 for controlled concurrency
    const entries = Array.from(sources.entries());
    for (let i = 0; i < entries.length; i += 3) {
      const batch = entries.slice(i, i + 3);
      const batchResults = await Promise.all(
        batch.map(([source, url]) => this.fetch(source, url))
      );
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + 3 < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Simple rate limiting
   */
  private checkRateLimit(source: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(source);
    
    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(source, {
        count: 1,
        resetTime: now + 60000
      });
      return true;
    }
    
    if (limit.count >= this.config.requestsPerMinute) {
      return false;
    }
    
    limit.count++;
    return true;
  }

  /**
   * Normalize data to consistent format
   */
  private normalizeData(source: string, data: any): any[] {
    // Simple normalization based on source
    switch (source) {
      case 'github':
        return Array.isArray(data) ? data : data.items || [];
      case 'producthunt':
        return data.posts?.edges?.map((e: any) => e.node) || [];
      case 'hackernews':
        return data.hits || [];
      default:
        return Array.isArray(data) ? data : [data];
    }
  }

  /**
   * Store results in database
   */
  async store(results: FetchResult[]): Promise<{ stored: number; errors: string[] }> {
    const errors: string[] = [];
    let stored = 0;

    for (const result of results) {
      if (result.items.length === 0) {continue;}

      try {
        const insertData = result.items.map(item => ({
          source: result.source,
          data: item,
          fetched_at: new Date().toISOString()
        }));
        
        const { error } = await supabase
          .from('content_raw')
          .insert(insertData as any);

        if (error) {throw error;}
        stored += result.items.length;
      } catch (error) {
        errors.push(`Failed to store ${result.source}: ${error}`);
      }
    }

    return { stored, errors };
  }
}

export const fetcher = new SimpleFetcher();