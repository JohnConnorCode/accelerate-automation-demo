/**
 * Simple in-memory cache to prevent duplicate API calls
 */

import { logger } from './logger';

interface CacheEntry {
  data: any;
  timestamp: number;
  hits: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly DEFAULT_TTL = 15 * 60 * 1000; // 15 minutes default
  
  /**
   * Get item from cache
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.DEFAULT_TTL) {
      this.cache.delete(key);
      logger.debug(`Cache expired for ${key}`);
      return null;
    }
    
    // Update hit count
    entry.hits++;
    logger.debug(`Cache hit for ${key} (${entry.hits} hits)`);
    
    return entry.data;
  }
  
  /**
   * Set item in cache
   */
  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0
    });
    
    logger.debug(`Cached ${key}`);
    
    // Clean up old entries periodically
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }
  
  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }
  
  /**
   * Clear specific key
   */
  clear(key: string): void {
    this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clearAll(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`Cleared cache (${size} entries)`);
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.DEFAULT_TTL) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; age: number; hits: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((now - entry.timestamp) / 1000), // age in seconds
      hits: entry.hits
    }));
    
    return {
      size: this.cache.size,
      entries: entries.sort((a, b) => b.hits - a.hits) // Sort by most used
    };
  }
  
  /**
   * Generate cache key for URL
   */
  generateKey(url: string, params?: any): string {
    if (!params) {
      return url;
    }
    
    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${url}?${sortedParams}`;
  }
}

// Export singleton
export const cacheService = new CacheService();