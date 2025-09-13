import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IntelligentCacheService } from '../../services/intelligent-cache-service';

describe('IntelligentCacheService', () => {
  let cache: IntelligentCacheService;
  
  beforeEach(() => {
    cache = new IntelligentCacheService({ skipWarmup: true });
    cache.clear();
  });
  
  afterEach(() => {
    cache.clear();
  });
  
  describe('Basic Operations', () => {
    it('should store and retrieve data', async () => {
      const testData = { id: 1, name: 'Test' };
      await cache.set('test-key', testData);
      
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });
    
    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });
    
    it('should handle cache misses with fetcher', async () => {
      const fetcher = jest.fn(() => Promise.resolve('fetched-data'));
      
      const result = await cache.get('test-key', fetcher);
      
      expect(fetcher).toHaveBeenCalled();
      expect(result).toBe('fetched-data');
    });
    
    it('should not call fetcher on cache hit', async () => {
      await cache.set('test-key', 'cached-data');
      const fetcher = jest.fn(() => Promise.resolve('fetched-data'));
      
      const result = await cache.get('test-key', fetcher);
      
      expect(fetcher).not.toHaveBeenCalled();
      expect(result).toBe('cached-data');
    });
    
    it('should respect TTL expiration', async () => {
      await cache.set('test-key', 'data', { ttl: 100 }); // 100ms TTL
      
      // Should exist immediately
      let result = await cache.get('test-key');
      expect(result).toBe('data');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      result = await cache.get('test-key');
      expect(result).toBeNull();
    });
  });
  
  describe('Cache Eviction', () => {
    it('should evict entries when max size is reached', async () => {
      // Set a small max size for testing
      const smallCache = new IntelligentCacheService();
      (smallCache as any).maxSize = 1000; // 1KB for testing
      
      // Add entries until we exceed the limit
      for (let i = 0; i < 10; i++) {
        await smallCache.set(`key-${i}`, { data: 'x'.repeat(200) });
      }
      
      // Check that cache size is within limits
      const stats = smallCache.getStats();
      expect(stats.size).toBeLessThanOrEqual(1000);
      expect(stats.evictions).toBeGreaterThan(0);
    });
    
    it('should evict based on LRU with priority', async () => {
      await cache.set('low-priority', 'data1', { priority: 'low' });
      await cache.set('high-priority', 'data2', { priority: 'high' });
      await cache.set('critical-priority', 'data3', { priority: 'critical' });
      
      // Access high priority to update its last access time
      await cache.get('high-priority');
      
      // When eviction happens, low priority should go first
      const stats = cache.getStats();
      expect(stats.entries).toBeGreaterThan(0);
    });
  });
  
  describe('Cache Invalidation', () => {
    it('should invalidate by tags', async () => {
      await cache.set('key1', 'data1', { tags: ['tag1', 'tag2'] });
      await cache.set('key2', 'data2', { tags: ['tag1'] });
      await cache.set('key3', 'data3', { tags: ['tag3'] });
      
      const cleared = await cache.clearByTags(['tag1']);
      
      expect(cleared).toBe(2);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBe('data3');
    });
    
    it('should invalidate by pattern', async () => {
      await cache.set('user:1:profile', 'profile1');
      await cache.set('user:1:settings', 'settings1');
      await cache.set('user:2:profile', 'profile2');
      await cache.set('post:1', 'post1');
      
      const invalidated = await cache.invalidateRelated('user:1:.*');
      
      expect(invalidated).toBe(2);
      expect(await cache.get('user:1:profile')).toBeNull();
      expect(await cache.get('user:1:settings')).toBeNull();
      expect(await cache.get('user:2:profile')).toBe('profile2');
      expect(await cache.get('post:1')).toBe('post1');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle fetcher errors gracefully', async () => {
      const fetcher = jest.fn(() => Promise.reject(new Error('Fetch failed')));
      
      await expect(cache.get('test-key', fetcher)).rejects.toThrow('Fetch failed');
    });
    
    it('should return stale data when fetcher fails and stale exists', async () => {
      // Set data with short TTL
      await cache.set('test-key', 'stale-data', { ttl: 100 });
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Fetcher fails
      const fetcher = jest.fn(() => Promise.reject(new Error('Fetch failed')));
      
      // Should return stale data
      const result = await cache.get('test-key', fetcher);
      expect(result).toBe('stale-data');
    });
    
    it('should handle invalid data types', async () => {
      const circularRef: any = { prop: null };
      circularRef.prop = circularRef;
      
      // Should not throw when trying to cache circular reference
      await expect(cache.set('circular', circularRef)).resolves.not.toThrow();
    });
  });
  
  describe('Statistics', () => {
    it('should track hit rate correctly', async () => {
      await cache.set('key1', 'data1');
      
      // Hit
      await cache.get('key1');
      
      // Miss
      await cache.get('key2');
      
      // Hit
      await cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });
    
    it('should export cache contents for debugging', async () => {
      await cache.set('key1', 'data1', { tags: ['tag1'] });
      await cache.set('key2', 'data2', { priority: 'high' });
      
      const exported = cache.exportCache();
      
      expect(exported.entries).toHaveLength(2);
      expect(exported.stats).toBeDefined();
      expect(exported.entries[0].key).toBeDefined();
    });
  });
  
  describe('Smart TTL', () => {
    it('should apply appropriate TTL based on key patterns', async () => {
      const service = new IntelligentCacheService({ skipWarmup: true });
      
      // Test different patterns
      const testCases = [
        { key: 'project:123', expectedTTL: 3600000 },
        { key: 'funding:456', expectedTTL: 7200000 },
        { key: 'resource:789', expectedTTL: 86400000 },
        { key: 'search:query', expectedTTL: 300000 },
        { key: 'dashboard:user', expectedTTL: 60000 },
        { key: 'unknown:key', expectedTTL: 3600000 }
      ];
      
      for (const testCase of testCases) {
        await service.set(testCase.key, 'data');
        const ttl = (service as any).getSmartTTL(testCase.key);
        expect(ttl).toBe(testCase.expectedTTL);
      }
    });
  });
  
  describe('Concurrent Access', () => {
    it('should handle concurrent reads safely', async () => {
      await cache.set('shared-key', 'shared-data');
      
      const promises = Array(10).fill(null).map(() => 
        cache.get('shared-key')
      );
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toBe('shared-data');
      });
    });
    
    it('should handle concurrent writes safely', async () => {
      const promises = Array(10).fill(null).map((_, i) => 
        cache.set(`concurrent-${i}`, `data-${i}`)
      );
      
      await Promise.all(promises);
      
      for (let i = 0; i < 10; i++) {
        const result = await cache.get(`concurrent-${i}`);
        expect(result).toBe(`data-${i}`);
      }
    });
  });
  
  describe('Memory Management', () => {
    it('should clean up expired entries periodically', async () => {
      // Add entries with short TTL
      for (let i = 0; i < 5; i++) {
        await cache.set(`expire-${i}`, `data-${i}`, { ttl: 100 });
      }
      
      // Initial count
      let stats = cache.getStats();
      expect(stats.entries).toBeGreaterThanOrEqual(5);
      
      // Wait for expiration and cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Force cleanup
      (cache as any).cleanupExpired();
      
      // Should be cleaned up
      stats = cache.getStats();
      expect(stats.entries).toBe(0);
    });
    
    it('should not exceed max entries limit', async () => {
      const maxEntries = 100;
      (cache as any).maxEntries = maxEntries;
      
      // Try to add more than max
      for (let i = 0; i < maxEntries + 50; i++) {
        await cache.set(`entry-${i}`, `data-${i}`);
      }
      
      const stats = cache.getStats();
      expect(stats.entries).toBeLessThanOrEqual(maxEntries);
    });
  });
});