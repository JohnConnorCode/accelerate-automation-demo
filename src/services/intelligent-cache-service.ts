import { supabase } from '../lib/supabase-client';
import { createHash } from 'crypto';

/**
 * Intelligent Caching Service for Lightning-Fast Responses
 * Dramatically improves everyday performance
 */

interface CacheEntry {
  key: string;
  data: any;
  metadata: {
    created: number;
    lastAccessed: number;
    accessCount: number;
    ttl: number;
    size: number;
    tags: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  entries: number;
  hitRate: number;
}

export class IntelligentCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    entries: 0,
    hitRate: 0
  };
  
  // Cache configuration
  private readonly maxSize = 100 * 1024 * 1024; // 100MB
  private readonly maxEntries = 10000;
  private readonly defaultTTL = 3600000; // 1 hour
  
  // Smart TTL based on data type
  private readonly ttlConfig = {
    projects: 3600000,      // 1 hour - changes moderately
    funding: 7200000,       // 2 hours - changes less frequently  
    resources: 86400000,    // 24 hours - rarely changes
    ai_assessment: 1800000, // 30 minutes - expensive to compute
    quality_check: 900000,  // 15 minutes - quick to recompute
    search_results: 300000, // 5 minutes - very dynamic
    user_dashboard: 60000,  // 1 minute - needs freshness
    analytics: 600000,      // 10 minutes - aggregated data
    system_config: 3600000  // 1 hour - rarely changes
  };

  constructor() {
    // Start cache cleanup interval
    this.startCleanupInterval();
    
    // Warm up cache with frequently accessed data
    this.warmupCache();
  }

  /**
   * Get data from cache with smart fallback
   */
  async get<T>(
    key: string,
    fetcher?: () => Promise<T>,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry['metadata']['priority'];
      forceRefresh?: boolean;
    }
  ): Promise<T | null> {
    // Generate cache key
    const cacheKey = this.generateKey(key);
    
    // Force refresh if requested
    if (options?.forceRefresh) {
      await this.delete(cacheKey);
    }
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    
    if (cached && !this.isExpired(cached)) {
      // Update access metadata
      cached.metadata.lastAccessed = Date.now();
      cached.metadata.accessCount++;
      
      // Update stats
      this.stats.hits++;
      this.updateHitRate();

      return cached.data as T;
    }
    
    // Cache miss
    this.stats.misses++;
    this.updateHitRate();
    
    // If no fetcher provided, return null
    if (!fetcher) {

      return null;
    }

    try {
      // Fetch fresh data
      const data = await fetcher();
      
      // Store in cache
      await this.set(cacheKey, data, {
        ttl: options?.ttl || this.getSmartTTL(key),
        tags: options?.tags || this.generateTags(key),
        priority: options?.priority || 'medium'
      });
      
      return data;
    } catch (error) {

      // Return stale cache if available
      if (cached) {

        return cached.data as T;
      }
      
      throw error;
    }
  }

  /**
   * Set data in cache with intelligent eviction
   */
  async set(
    key: string,
    data: any,
    options?: {
      ttl?: number;
      tags?: string[];
      priority?: CacheEntry['metadata']['priority'];
    }
  ): Promise<void> {
    const cacheKey = this.generateKey(key);
    const dataSize = this.calculateSize(data);
    
    // Check if we need to evict entries
    if (this.needsEviction(dataSize)) {
      await this.evictEntries(dataSize);
    }
    
    // Create cache entry
    const entry: CacheEntry = {
      key: cacheKey,
      data,
      metadata: {
        created: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        ttl: options?.ttl || this.defaultTTL,
        size: dataSize,
        tags: options?.tags || [],
        priority: options?.priority || 'medium'
      }
    };
    
    // Store in cache
    this.cache.set(cacheKey, entry);
    
    // Update stats
    this.stats.size += dataSize;
    this.stats.entries = this.cache.size;

  }

  /**
   * Delete from cache
   */
  async delete(key: string): Promise<boolean> {
    const cacheKey = this.generateKey(key);
    const entry = this.cache.get(cacheKey);
    
    if (entry) {
      this.stats.size -= entry.metadata.size;
      this.cache.delete(cacheKey);
      this.stats.entries = this.cache.size;

      return true;
    }
    
    return false;
  }

  /**
   * Clear cache by tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (tags.some(tag => entry.metadata.tags.includes(tag))) {
        this.stats.size -= entry.metadata.size;
        this.cache.delete(key);
        cleared++;
      }
    }
    
    this.stats.entries = this.cache.size;

    return cleared;
  }

  /**
   * Invalidate related cache entries
   */
  async invalidateRelated(pattern: string): Promise<number> {
    let invalidated = 0;
    const regex = new RegExp(pattern);
    
    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(key)) {
        this.stats.size -= entry.metadata.size;
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    this.stats.entries = this.cache.size;

    return invalidated;
  }

  /**
   * Warm up cache with frequently accessed data
   */
  private async warmupCache(): Promise<void> {

    try {
      // Cache system settings
      const { data: settings } = await supabase
        .from('system_settings')
        .select('*');
      
      if (settings) {
        for (const setting of settings) {
          await this.set(`settings:${setting.key}`, setting.value, {
            ttl: this.ttlConfig.system_config,
            tags: ['settings'],
            priority: 'high'
          });
        }
      }
      
      // Cache recent approved content
      const { data: approved } = await supabase
        .from('approved_content')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (approved) {
        await this.set('recent:approved', approved, {
          ttl: this.ttlConfig.projects,
          tags: ['content', 'approved'],
          priority: 'medium'
        });
      }
      
      // Cache scoring criteria
      const { data: criteria } = await supabase
        .from('scoring_criteria')
        .select('*')
        .eq('active', true);
      
      if (criteria) {
        await this.set('scoring:criteria', criteria, {
          ttl: this.ttlConfig.system_config,
          tags: ['scoring'],
          priority: 'high'
        });
      }

    } catch (error) {

    }
  }

  /**
   * Smart TTL based on key pattern
   */
  private getSmartTTL(key: string): number {
    // Match key patterns to appropriate TTL
    if (key.includes('project')) return this.ttlConfig.projects;
    if (key.includes('funding')) return this.ttlConfig.funding;
    if (key.includes('resource')) return this.ttlConfig.resources;
    if (key.includes('ai_assessment')) return this.ttlConfig.ai_assessment;
    if (key.includes('quality')) return this.ttlConfig.quality_check;
    if (key.includes('search')) return this.ttlConfig.search_results;
    if (key.includes('dashboard')) return this.ttlConfig.user_dashboard;
    if (key.includes('analytics')) return this.ttlConfig.analytics;
    if (key.includes('settings') || key.includes('config')) return this.ttlConfig.system_config;
    
    return this.defaultTTL;
  }

  /**
   * Generate tags based on key
   */
  private generateTags(key: string): string[] {
    const tags: string[] = [];
    
    // Add type tags
    if (key.includes('project')) tags.push('project');
    if (key.includes('funding')) tags.push('funding');
    if (key.includes('resource')) tags.push('resource');
    if (key.includes('content')) tags.push('content');
    
    // Add operation tags
    if (key.includes('search')) tags.push('search');
    if (key.includes('list')) tags.push('list');
    if (key.includes('detail')) tags.push('detail');
    if (key.includes('analytics')) tags.push('analytics');
    
    // Add status tags
    if (key.includes('approved')) tags.push('approved');
    if (key.includes('rejected')) tags.push('rejected');
    if (key.includes('pending')) tags.push('pending');
    
    return tags;
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.metadata.created > entry.metadata.ttl;
  }

  /**
   * Check if eviction is needed
   */
  private needsEviction(newDataSize: number): boolean {
    return (
      this.stats.size + newDataSize > this.maxSize ||
      this.cache.size >= this.maxEntries
    );
  }

  /**
   * Evict entries using LRU with priority
   */
  private async evictEntries(requiredSpace: number): Promise<void> {

    // Sort entries by priority and last access time
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry,
      score: this.calculateEvictionScore(entry)
    }));
    
    // Sort by score (lower score = evict first)
    entries.sort((a, b) => a.score - b.score);
    
    let freedSpace = 0;
    let evicted = 0;
    
    for (const { key, entry } of entries) {
      if (freedSpace >= requiredSpace) break;
      
      // Don't evict critical entries unless necessary
      if (entry.metadata.priority === 'critical' && freedSpace < requiredSpace * 0.8) {
        continue;
      }
      
      freedSpace += entry.metadata.size;
      this.stats.size -= entry.metadata.size;
      this.cache.delete(key);
      evicted++;
      this.stats.evictions++;
    }
    
    this.stats.entries = this.cache.size;

  }

  /**
   * Calculate eviction score (higher = keep longer)
   */
  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.metadata.created;
    const recency = Date.now() - entry.metadata.lastAccessed;
    const frequency = entry.metadata.accessCount;
    
    // Priority weights
    const priorityWeights = {
      critical: 1000,
      high: 100,
      medium: 10,
      low: 1
    };
    
    const priorityWeight = priorityWeights[entry.metadata.priority];
    
    // Calculate score (higher = keep)
    // Consider: frequency of access, recency, priority, and age
    const score = (frequency * priorityWeight) / (recency + age);
    
    return score;
  }

  /**
   * Generate cache key
   */
  private generateKey(key: string): string {
    // Normalize key
    return key.toLowerCase().replace(/[^a-z0-9:_-]/g, '_');
  }

  /**
   * Calculate data size
   */
  private calculateSize(data: any): number {
    // Rough estimation of object size
    const str = JSON.stringify(data);
    return str.length * 2; // 2 bytes per character (Unicode)
  }

  /**
   * Update hit rate
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.stats.size -= entry.metadata.size;
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.entries = this.cache.size;

    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      hitRate: Math.round(this.stats.hitRate * 100) / 100
    };
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      entries: 0,
      hitRate: 0
    };

  }

  /**
   * Export cache for debugging
   */
  exportCache(): any {
    const entries: any[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        size: entry.metadata.size,
        created: new Date(entry.metadata.created).toISOString(),
        lastAccessed: new Date(entry.metadata.lastAccessed).toISOString(),
        accessCount: entry.metadata.accessCount,
        priority: entry.metadata.priority,
        tags: entry.metadata.tags,
        expired: this.isExpired(entry)
      });
    }
    
    return {
      stats: this.getStats(),
      entries: entries.sort((a, b) => b.accessCount - a.accessCount)
    };
  }
}

// Export singleton instance
export const intelligentCache = new IntelligentCacheService();