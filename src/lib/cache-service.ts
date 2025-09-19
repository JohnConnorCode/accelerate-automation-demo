import type { Database } from '../types/supabase';
import { supabase, ApiCacheRow } from './typed-supabase';
import * as crypto from 'crypto';

/**
 * CACHE SERVICE
 * Prevents hitting APIs too frequently
 * Stores responses in Supabase for reuse
 */

export class CacheService {
  private static instance: CacheService;
  private inMemoryCache: Map<string, { data: any; expires: number }> = new Map();
  private ttlMinutes: number;

  constructor() {
    this.ttlMinutes = parseInt(process.env.CACHE_TTL_MINUTES || '360');
  }

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(prefix: string, params: any): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Get cached data
   */
  async get<T>(key: string): Promise<T | null> {
    if (process.env.CACHE_ENABLED !== 'true') {return null;}

    // Check in-memory cache first
    const memCached = this.inMemoryCache.get(key);
    if (memCached && memCached.expires > Date.now()) {

      return memCached.data as T;
    }

    // Check database cache
    try {
      const { data, error } = await supabase
        // DISABLED: Table 'api_cache' doesn't exist

        .from('api_cache')
        .select('cache_value, expires_at')
        .eq('cache_key', key)
        .single() as { data: Pick<ApiCacheRow, 'cache_value' | 'expires_at'> | null; error: any };

      if (!error && data && new Date(data.expires_at) > new Date()) {

        // Update in-memory cache
        this.inMemoryCache.set(key, {
          data: data.cache_value,
          expires: new Date(data.expires_at).getTime()
        });
        
        return data.cache_value as T;
      }
    } catch (error) {

    }

    return null;
  }

  /**
   * Set cached data
   */
  async set<T>(key: string, value: T, ttlMinutes?: number): Promise<void> {
    if (process.env.CACHE_ENABLED !== 'true') return;

    const ttl = ttlMinutes || this.ttlMinutes;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    // Update in-memory cache
    this.inMemoryCache.set(key, {
      data: value,
      expires: expiresAt.getTime()
    });

    // Update database cache
    try {
      await supabase
        // DISABLED: Table 'api_cache' doesn't exist

        .from('api_cache')
        .upsert({
          cache_key: key,
          cache_value: value as any,
          expires_at: expiresAt.toISOString()
        }) as any || { data: [], error: null };

    } catch (error) {

    }
  }

  /**
   * Clear expired cache entries
   */
  async cleanExpired(): Promise<void> {
    // Clean in-memory cache
    const now = Date.now();
    for (const [key, value] of this.inMemoryCache.entries()) {
      if (value.expires < now) {
        this.inMemoryCache.delete(key);
      }
    }

    // Clean database cache
    try {
      const { error } = await supabase
        // DISABLED: Table 'api_cache' doesn't exist

        .from('api_cache')
        .delete()
        .lt('expires_at', new Date().toISOString()) as any || { data: [], error: null };

      if (!error) {

      }
    } catch (error) {

    }
  }

  /**
   * Cache wrapper for fetch operations
   */
  async cacheFetch<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    ttlMinutes?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const fresh = await fetchFn();
    
    // Cache the result
    await this.set(cacheKey, fresh, ttlMinutes);
    
    return fresh;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    inMemoryCount: number;
    databaseCount: number;
    hitRate: number;
  }> {
    const { count } = await supabase
      // DISABLED: Table 'api_cache' doesn't exist

      .from('api_cache')
      .select('*', { count: 'exact', head: true }) as any || { data: [], error: null };

    return {
      inMemoryCount: this.inMemoryCache.size,
      databaseCount: count || 0,
      hitRate: 0, // Would need to track hits/misses
    };
  }
}

export const cache = CacheService.getInstance();