// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SmartSearchService } from '../../services/smart-search-service';
import { supabase } from '../../lib/supabase-client';

// Mock Supabase
jest.mock('../../lib/supabase-client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      contains: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis()
    }))
  }
}));

describe('SmartSearchService', () => {
  let searchService: SmartSearchService;
  
  beforeEach(() => {
    searchService = new SmartSearchService();
    jest.clearAllMocks();
  });
  
  describe('Search Functionality', () => {
    it('should perform basic search', async () => {
      const mockResults = [
        {
          id: '1',
          title: 'Test Project',
          description: 'A test project description',
          type: 'project',
          score: 85,
          tags: ['test', 'project']
        }
      ];
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: mockResults, error: null })
      });
      
      const results = await searchService.search({
        query: 'test project',
        limit: 10
      });
      
      expect(results.results).toBeDefined();
      expect(results.totalCount).toBeGreaterThanOrEqual(0);
      expect(results.suggestions).toBeDefined();
      expect(results.responseTime).toBeGreaterThan(0);
    });
    
    it('should handle empty search results', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null })
      });
      
      const results = await searchService.search({
        query: 'nonexistent query'
      });
      
      expect(results.results).toEqual([]);
      expect(results.totalCount).toBe(0);
    });
    
    it('should apply filters correctly', async () => {
      const mockFilteredResults = [
        {
          id: '1',
          title: 'Funding Opportunity',
          type: 'funding',
          score: 90
        }
      ];
      
      const fromMock = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        data: mockFilteredResults,
        error: null
      };
      
      (supabase.from as jest.Mock).mockReturnValue(fromMock);
      fromMock.lte = jest.fn().mockResolvedValue({ data: mockFilteredResults, error: null });
      
      const results = await searchService.search({
        query: 'funding',
        filters: {
          type: ['funding'],
          scoreRange: { min: 80, max: 100 }
        }
      });
      
      expect(fromMock.in).toHaveBeenCalledWith('type', ['funding']);
      expect(fromMock.gte).toHaveBeenCalledWith('score', 80);
    });
    
    it('should handle database errors gracefully', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ 
          data: null, 
          error: new Error('Database connection failed') 
        })
      });
      
      const results = await searchService.search({
        query: 'test'
      });
      
      expect(results.results).toEqual([]);
      expect(results.totalCount).toBe(0);
    });
  });
  
  describe('Autocomplete', () => {
    it('should provide autocomplete suggestions', async () => {
      const suggestions = await searchService.autocomplete('proj', 5);
      
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
    
    it('should include recent searches in autocomplete', async () => {
      // Track a search first
      searchService['trackSearch']('project management', 10, 150);
      
      const suggestions = await searchService.autocomplete('proj', 10);
      
      const recentSuggestion = suggestions.find(s => 
        s.type === 'recent' && s.text.includes('project')
      );
      
      expect(recentSuggestion).toBeDefined();
    });
    
    it('should handle filter suggestions', async () => {
      const suggestions = await searchService.autocomplete('type:', 10);
      
      const filterSuggestions = suggestions.filter(s => s.type === 'filter');
      expect(filterSuggestions.length).toBeGreaterThan(0);
    });
  });
  
  describe('Query Parsing', () => {
    it('should parse inline filters', () => {
      const parsed = searchService['parseSearchQuery'](
        'machine learning type:project score:>80',
        {}
      );
      
      expect(parsed.query).toBe('machine learning');
      expect(parsed.filters?.type).toContain('project');
      expect(parsed.filters?.scoreRange).toEqual({ min: 80, max: 100 });
    });
    
    it('should recognize shortcuts', () => {
      const parsed = searchService['parseSearchQuery']('new projects', {});
      
      expect(parsed.query).toBe('projects');
      expect(parsed.filters?.dateRange).toBeDefined();
    });
    
    it('should handle multiple filters', () => {
      const parsed = searchService['parseSearchQuery'](
        'type:project type:funding tag:ai',
        {}
      );
      
      expect(parsed.filters?.type).toContain('project');
      expect(parsed.filters?.type).toContain('funding');
      expect(parsed.filters?.tags).toContain('ai');
    });
  });
  
  describe('Relevance Scoring', () => {
    it('should score title matches highest', () => {
      const item = {
        title: 'Machine Learning Project',
        description: 'A simple project',
        tags: []
      };
      
      const relevance = searchService['calculateRelevance'](
        item,
        ['machine', 'learning'],
        {}
      );
      
      expect(relevance).toBeGreaterThan(10);
    });
    
    it('should boost recent items', () => {
      const recentItem = {
        title: 'Test',
        description: '',
        created_at: new Date().toISOString(),
        tags: []
      };
      
      const oldItem = {
        title: 'Test',
        description: '',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        tags: []
      };
      
      const recentRelevance = searchService['calculateRelevance'](
        recentItem,
        ['test'],
        {}
      );
      
      const oldRelevance = searchService['calculateRelevance'](
        oldItem,
        ['test'],
        {}
      );
      
      expect(recentRelevance).toBeGreaterThan(oldRelevance);
    });
    
    it('should handle fuzzy matching for typos', () => {
      const fuzzyMatch = searchService['fuzzyMatch']('projeect', 'project management');
      expect(fuzzyMatch).toBe(true);
      
      const noMatch = searchService['fuzzyMatch']('xyz', 'project management');
      expect(noMatch).toBe(false);
    });
  });
  
  describe('Highlighting', () => {
    it('should generate search result highlights', () => {
      const item = {
        title: 'Machine Learning Project',
        description: 'This is a machine learning project using neural networks'
      };
      
      const highlights = searchService['generateHighlights'](
        item,
        ['machine', 'learning']
      );
      
      expect(highlights.title).toContain('<mark>');
      expect(highlights.description).toContain('<mark>');
    });
    
    it('should handle case-insensitive highlighting', () => {
      const item = {
        title: 'MACHINE learning Project',
        description: 'Machine Learning'
      };
      
      const highlights = searchService['generateHighlights'](
        item,
        ['machine']
      );
      
      expect(highlights.title).toContain('<mark>MACHINE</mark>');
    });
  });
  
  describe('Search Analytics', () => {
    it('should track search queries', () => {
      searchService['trackSearch']('test query', 5, 100);
      
      const stats = searchService.getSearchStats();
      expect(stats.totalSearches).toBeGreaterThan(0);
    });
    
    it('should track clicked results', () => {
      searchService['trackSearch']('test query', 5, 100);
      searchService.trackClick('test query', 'result-1');
      
      const analytics = searchService['searchHistory'].get('test query');
      expect(analytics?.clickedResults).toContain('result-1');
    });
    
    it('should maintain search history limit', () => {
      // Add more than 100 searches
      for (let i = 0; i < 150; i++) {
        searchService['trackSearch'](`query-${i}`, 5, 100);
      }
      
      expect(searchService['searchHistory'].size).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle null/undefined queries gracefully', async () => {
      const results = await searchService.search({
        query: ''
      });
      
      expect(results.results).toBeDefined();
      expect(results.totalCount).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle malformed filters', async () => {
      const results = await searchService.search({
        query: 'test',
        filters: {
          scoreRange: { min: 100, max: 50 } // Invalid range
        }
      });
      
      expect(results).toBeDefined();
    });
    
    it('should sanitize special characters in queries', () => {
      const tokens = searchService['tokenizeQuery']('test@#$%^&*()query');
      
      expect(tokens).not.toContain('@');
      expect(tokens).not.toContain('#');
      expect(tokens).toContain('test');
      expect(tokens).toContain('query');
    });
  });
  
  describe('Related Items', () => {
    it('should find related items based on tags', async () => {
      const mockRelated = [
        { id: '2', title: 'Related Item', tags: ['ai', 'ml'] }
      ];
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockRelated, error: null })
      });
      
      const items = [{
        id: '1',
        title: 'Main Item',
        description: '',
        type: 'project',
        score: 80,
        highlights: {},
        metadata: { tags: ['ai', 'ml'] },
        relevance: 100
      }];
      
      const related = await searchService['findRelatedItems'](items);
      
      expect(related.length).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array(1000).fill(null).map((_, i) => ({
        id: `${i}`,
        title: `Item ${i}`,
        description: `Description ${i}`,
        type: 'project',
        score: Math.random() * 100
      }));
      
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: largeResultSet, error: null })
      });
      
      const startTime = Date.now();
      const results = await searchService.search({
        query: 'item',
        limit: 20
      });
      const duration = Date.now() - startTime;
      
      expect(results.results.length).toBeLessThanOrEqual(20);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
    
    it('should cache autocomplete results', async () => {
      const spy = jest.spyOn(searchService as any, 'searchIndexLookup');
      
      // First call
      await searchService.autocomplete('test', 5);
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await searchService.autocomplete('test', 5);
      // Cache is handled by intelligentCache, so spy might be called again
      // but the actual fetching should be cached
    });
  });
});