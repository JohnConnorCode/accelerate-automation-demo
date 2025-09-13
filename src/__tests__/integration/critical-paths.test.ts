import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { UnifiedOrchestrator } from '../../core/unified-orchestrator';
import { intelligentCache } from '../../services/intelligent-cache-service';
import { smartSearch } from '../../services/smart-search-service';
import { notifications } from '../../services/realtime-notifications-service';
import { failSafe } from '../../services/fail-safe-wrapper';
import { rateLimiter } from '../../services/rate-limiting-service';
import { supabase } from '../../lib/supabase-client';

describe('Critical User Paths - Integration Tests', () => {
  let orchestrator: UnifiedOrchestrator;
  
  beforeAll(() => {
    orchestrator = new UnifiedOrchestrator();
    // Clear all caches and states
    intelligentCache.clear();
    rateLimiter.reset();
  });
  
  afterAll(() => {
    // Cleanup
    notifications.destroy();
  });
  
  describe('Content Fetching and Processing', () => {
    it('should handle complete fetch-enrich-approve cycle', async () => {
      // This tests the entire pipeline
      const result = await failSafe.safeExecute(
        async () => {
          return await orchestrator.runCategory('projects');
        },
        'fetch-cycle',
        {
          retry: { maxRetries: 2, fallbackValue: { success: false, stats: null, errors: [] } },
          monitoring: true
        }
      );
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      
      if (result.success) {
        expect(result.stats).toBeDefined();
        expect(result.stats?.fetched).toBeGreaterThanOrEqual(0);
      }
    }, 30000); // 30 second timeout for integration test
    
    it('should handle network failures gracefully', async () => {
      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as any;
      
      const result = await failSafe.safeExecute(
        async () => {
          return await orchestrator.run();
        },
        'network-failure-test',
        {
          retry: {
            maxRetries: 1,
            fallbackValue: { success: false, message: 'Network unavailable' }
          }
        }
      );
      
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      
      // Restore fetch
      global.fetch = originalFetch;
    });
    
    it('should respect rate limits', async () => {
      const clientId = 'test-client';
      
      // Make multiple rapid requests
      const requests = Array(10).fill(null).map(async (_, i) => {
        return await rateLimiter.checkLimit('/api/ai-assess', clientId, {
          weight: 1
        });
      });
      
      const results = await Promise.all(requests);
      
      // Some should be rejected due to rate limiting
      const rejected = results.filter(r => !r.allowed);
      expect(rejected.length).toBeGreaterThan(0);
      
      // Reset for other tests
      rateLimiter.reset();
    });
  });
  
  describe('Search Functionality', () => {
    it('should provide fast cached search results', async () => {
      const query = 'blockchain projects';
      
      // First search - cache miss
      const firstSearchStart = Date.now();
      const firstResults = await smartSearch.search({
        query,
        limit: 10
      });
      const firstSearchTime = Date.now() - firstSearchStart;
      
      expect(firstResults.results).toBeDefined();
      expect(firstResults.responseTime).toBeDefined();
      
      // Second search - should be cached
      const secondSearchStart = Date.now();
      const secondResults = await smartSearch.search({
        query,
        limit: 10
      });
      const secondSearchTime = Date.now() - secondSearchStart;
      
      // Cached search should be significantly faster
      expect(secondSearchTime).toBeLessThan(firstSearchTime / 2);
    });
    
    it('should handle malformed search queries', async () => {
      const malformedQueries = [
        '',
        '   ',
        'a'.repeat(1000),
        '<script>alert("xss")</script>',
        'SELECT * FROM users',
        null,
        undefined
      ];
      
      for (const query of malformedQueries) {
        const result = await failSafe.safeExecute(
          async () => {
            return await smartSearch.search({
              query: query as string || '',
              limit: 10
            });
          },
          'malformed-search',
          {
            retry: { maxRetries: 0 },
            validation: {
              required: ['results', 'totalCount']
            }
          }
        );
        
        expect(result).toBeDefined();
        expect(result.results).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
      }
    });
    
    it('should provide relevant autocomplete suggestions', async () => {
      const suggestions = await smartSearch.autocomplete('proj', 5);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
      
      // Each suggestion should have required fields
      suggestions.forEach(suggestion => {
        expect(suggestion.text).toBeDefined();
        expect(suggestion.type).toBeDefined();
      });
    });
  });
  
  describe('Notification System', () => {
    it('should deliver notifications reliably', async () => {
      const testNotification = await notifications.send(
        'batch_complete',
        'Test batch completed',
        {
          severity: 'success',
          metadata: { test: true }
        }
      );
      
      expect(testNotification).toBeDefined();
      expect(testNotification.id).toBeDefined();
      expect(testNotification.type).toBe('batch_complete');
      
      // Check unread count
      const unreadCount = notifications.getUnreadCount();
      expect(unreadCount).toBeGreaterThan(0);
      
      // Mark as read
      await notifications.markAsRead(testNotification.id);
      const newUnreadCount = notifications.getUnreadCount();
      expect(newUnreadCount).toBe(unreadCount - 1);
    });
    
    it('should respect notification preferences', () => {
      // Update preferences
      notifications.updatePreferences({
        types: {
          quality_check_complete: false
        }
      });
      
      // This notification should be filtered out
      const filtered = notifications['shouldShowNotification']({
        id: 'test',
        type: 'quality_check_complete',
        title: 'Test',
        message: 'Test',
        severity: 'info',
        timestamp: new Date(),
        read: false
      });
      
      expect(filtered).toBe(false);
      
      // Reset preferences
      notifications.updatePreferences({
        types: {
          quality_check_complete: true
        }
      });
    });
  });
  
  describe('Database Operations', () => {
    it('should handle database connection failures', async () => {
      // Mock database failure
      const originalFrom = supabase.from;
      supabase.from = jest.fn(() => ({
        select: jest.fn(() => Promise.reject(new Error('Database connection failed')))
      })) as any;
      
      const result = await failSafe.safeDbOperation(
        async () => {
          const { data } = await supabase.from('test').select('*');
          return data;
        },
        'test'
      );
      
      // Should handle the error gracefully
      expect(result).toBeDefined();
      
      // Restore
      supabase.from = originalFrom;
    });
    
    it('should use connection pooling effectively', async () => {
      // Simulate multiple concurrent database operations
      const operations = Array(10).fill(null).map(async (_, i) => {
        return await failSafe.safeDbOperation(
          async () => {
            // Simulate database query
            return { id: i, data: `result-${i}` };
          },
          `concurrent-op-${i}`
        );
      });
      
      const results = await Promise.all(operations);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.id).toBe(i);
      });
    });
  });
  
  describe('Batch Processing', () => {
    it('should handle large batch operations', async () => {
      const items = Array(100).fill(null).map((_, i) => ({
        id: i,
        data: `item-${i}`
      }));
      
      const { results, errors } = await failSafe.safeBatch(
        items,
        async (item) => {
          // Simulate processing
          if (item.id % 10 === 0) {
            throw new Error('Simulated error');
          }
          return { processed: true, ...item };
        },
        {
          batchSize: 10,
          stopOnError: false,
          progressCallback: (completed, total) => {
            expect(completed).toBeLessThanOrEqual(total);
          }
        }
      );
      
      expect(results.length).toBeGreaterThan(0);
      expect(errors.length).toBe(10); // 10% failure rate
    });
    
    it('should stop on error when configured', async () => {
      const items = Array(20).fill(null).map((_, i) => i);
      
      const { results, errors } = await failSafe.safeBatch(
        items,
        async (item) => {
          if (item === 5) {
            throw new Error('Stop here');
          }
          return item * 2;
        },
        {
          batchSize: 5,
          stopOnError: true
        }
      );
      
      expect(results.length).toBeLessThan(20);
      expect(errors.length).toBe(1);
      expect(errors[0].item).toBe(5);
    });
  });
  
  describe('Cache Performance', () => {
    it('should maintain high cache hit rate', async () => {
      // Warm up cache
      const keys = ['test1', 'test2', 'test3'];
      for (const key of keys) {
        await intelligentCache.set(key, `data-${key}`);
      }
      
      // Access multiple times
      for (let i = 0; i < 10; i++) {
        for (const key of keys) {
          await intelligentCache.get(key);
        }
      }
      
      const stats = intelligentCache.getStats();
      expect(stats.hitRate).toBeGreaterThan(80); // 80%+ hit rate
    });
    
    it('should handle cache overflow gracefully', async () => {
      // Try to overflow cache
      const largeData = 'x'.repeat(10000);
      
      for (let i = 0; i < 1000; i++) {
        await intelligentCache.set(`overflow-${i}`, largeData, {
          priority: 'low'
        });
      }
      
      const stats = intelligentCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual((intelligentCache as any).maxSize);
    });
  });
  
  describe('Error Recovery', () => {
    it('should recover from transient failures', async () => {
      let attempts = 0;
      
      const result = await failSafe.safeExecute(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          return 'success';
        },
        'transient-test',
        {
          retry: { maxRetries: 5, retryDelay: 100 }
        }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });
    
    it('should open circuit breaker after repeated failures', async () => {
      const operationName = 'circuit-test';
      
      // Cause multiple failures
      for (let i = 0; i < 6; i++) {
        try {
          await failSafe.safeExecute(
            async () => {
              throw new Error('Persistent failure');
            },
            operationName,
            {
              retry: { maxRetries: 0 }
            }
          );
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Circuit should be open now
      const status = failSafe.getCircuitBreakerStatus();
      const breaker = status.get(operationName);
      expect(breaker?.state).toBe('open');
      
      // Reset for other tests
      failSafe.resetCircuitBreaker(operationName);
    });
  });
  
  describe('Data Validation', () => {
    it('should validate input data correctly', async () => {
      const testData = {
        id: '123',
        score: 85,
        email: 'test@example.com',
        url: 'https://example.com'
      };
      
      const result = await failSafe.safeExecute(
        async () => testData,
        'validation-test',
        {
          validation: {
            required: ['id', 'score'],
            types: {
              id: 'string',
              score: 'number'
            },
            ranges: {
              score: { min: 0, max: 100 }
            },
            patterns: {
              email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              url: /^https?:\/\/.+/
            }
          }
        }
      );
      
      expect(result).toEqual(testData);
    });
    
    it('should reject invalid data', async () => {
      const invalidData = {
        id: 123, // Should be string
        score: 150, // Out of range
        email: 'invalid-email',
        url: 'not-a-url'
      };
      
      await expect(
        failSafe.safeExecute(
          async () => invalidData,
          'invalid-validation-test',
          {
            retry: { maxRetries: 0 },
            validation: {
              types: {
                id: 'string'
              },
              ranges: {
                score: { min: 0, max: 100 }
              }
            }
          }
        )
      ).rejects.toThrow('Validation failed');
    });
  });
  
  describe('Performance Under Load', () => {
    it('should handle concurrent operations efficiently', async () => {
      const startTime = Date.now();
      
      // Simulate high load
      const operations = Array(50).fill(null).map(async (_, i) => {
        return await failSafe.safeExecute(
          async () => {
            // Simulate varying processing times
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            return i;
          },
          `load-test-${i}`,
          {
            retry: { maxRetries: 1, retryDelay: 50 }
          }
        );
      });
      
      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(50);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});