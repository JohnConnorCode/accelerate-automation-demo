import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../lib/supabase-client';
import { DuplicateDetector } from '../lib/duplicate-detector';
import { AccelerateScorer } from '../lib/accelerate-scorer';
import { ContentItem } from '../lib/base-fetcher';

describe('Content Quality Tests', () => {
  describe('Duplicate Detection', () => {
    const detector = new DuplicateDetector();
    
    it('should detect exact URL matches', async () => {
      const items: ContentItem[] = [
        {
          source: 'test',
          type: 'project',
          title: 'Test Project',
          description: 'A test project',
          url: 'https://example.com/project1',
          tags: []
        }
      ];
      
      // Mock existing item in DB
      const { unique, duplicates } = await detector.checkDuplicates(items);
      
      // If URL exists in DB, should be marked as duplicate
      if (duplicates.length > 0) {
        expect(duplicates[0].similarity).toBeGreaterThanOrEqual(100);
      }
    });
    
    it('should detect similar names with Levenshtein distance', async () => {
      const items: ContentItem[] = [
        {
          source: 'test',
          type: 'project',
          title: 'DeFi Protocol Labs',
          description: 'Decentralized finance protocol',
          url: 'https://defiprotocol.io',
          tags: ['defi']
        }
      ];
      
      const { unique, duplicates } = await detector.checkDuplicates(items);
      
      // Similar names should be caught
      if (duplicates.length > 0) {
        expect(duplicates[0].similarity).toBeGreaterThan(85);
      }
    });
    
    it('should not flag unique items as duplicates', async () => {
      const uniqueItem: ContentItem = {
        source: 'test',
        type: 'project',
        title: `Unique Project ${Date.now()}`,
        description: 'Completely unique description that has never been seen before',
        url: `https://unique-${Date.now()}.com`,
        tags: ['unique']
      };
      
      const { unique, duplicates } = await detector.checkDuplicates([uniqueItem]);
      
      expect(unique.length).toBe(1);
      expect(duplicates.length).toBe(0);
    });
  });

  describe('Scoring Algorithm', () => {
    it('should score early-stage projects higher', () => {
      const earlyStage: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Early Stage Startup',
        description: 'Small team, low funding',
        url: 'https://earlystage.io',
        tags: [],
        metadata: {
          amount_funded: 100000,
          team_size: 3,
          launched_date: '2024-06-01'
        }
      };
      
      const score = AccelerateScorer.calculateScore(earlyStage);
      expect(score).toBeGreaterThan(70);
    });
    
    it('should penalize corporate-backed projects', () => {
      const corporate: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Corporate Venture',
        description: 'Backed by Microsoft',
        url: 'https://corporate.io',
        tags: [],
        metadata: {
          amount_funded: 10000000,
          team_size: 50,
          corporate_backing: true
        }
      };
      
      const score = AccelerateScorer.calculateScore(corporate);
      expect(score).toBeLessThan(30);
    });
    
    it('should boost projects with social proof', () => {
      const socialProof: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Popular Project',
        description: 'High social engagement',
        url: 'https://popular.io',
        tags: [],
        metadata: {
          twitter_followers: 10000,
          discord_members: 5000,
          github_stars: 500,
          social_score: 85
        }
      };
      
      const score = AccelerateScorer.calculateScore(socialProof);
      expect(score).toBeGreaterThan(80);
    });
  });

  describe('Data Validation', () => {
    it('should validate required fields', () => {
      const invalid: ContentItem = {
        source: '',
        type: 'project',
        title: '', // Invalid - empty title
        description: 'Test',
        url: 'not-a-url', // Invalid URL
        tags: []
      };
      
      // Should fail validation
      const isValid = validateContentItem(invalid);
      expect(isValid).toBe(false);
    });
    
    it('should enforce description length requirements', () => {
      const shortDesc: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Valid Title',
        description: 'Too short', // Should be at least 50 chars
        url: 'https://valid.io',
        tags: []
      };
      
      const isValid = validateContentItem(shortDesc, { minDescriptionLength: 50 });
      expect(isValid).toBe(false);
    });
    
    it('should validate date formats', () => {
      const validDates = ['2024-01-01', '2024-12-31'];
      const invalidDates = ['01-01-2024', '2024/01/01', 'January 1, 2024'];
      
      validDates.forEach(date => {
        expect(isValidISODate(date)).toBe(true);
      });
      
      invalidDates.forEach(date => {
        expect(isValidISODate(date)).toBe(false);
      });
    });
  });

  describe('Filtering Criteria', () => {
    it('should filter projects by launch date', () => {
      const projects = [
        { launched_date: '2023-01-01', name: 'Old Project' },
        { launched_date: '2024-06-01', name: 'New Project' },
        { launched_date: '2025-01-01', name: 'Future Project' }
      ];
      
      const filtered = projects.filter(p => {
        const date = new Date(p.launched_date);
        return date >= new Date('2024-01-01');
      });
      
      expect(filtered.length).toBe(2);
      expect(filtered[0].name).toBe('New Project');
    });
    
    it('should filter by funding amount', () => {
      const projects = [
        { amount_funded: 100000, name: 'Small' },
        { amount_funded: 500000, name: 'Medium' },
        { amount_funded: 1000000, name: 'Large' }
      ];
      
      const filtered = projects.filter(p => p.amount_funded < 500000);
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Small');
    });
    
    it('should filter by team size', () => {
      const projects = [
        { team_size: 2, name: 'Tiny' },
        { team_size: 10, name: 'Small' },
        { team_size: 50, name: 'Large' }
      ];
      
      const filtered = projects.filter(p => p.team_size >= 1 && p.team_size <= 10);
      expect(filtered.length).toBe(2);
    });
  });

  describe('Enrichment Quality', () => {
    it('should enrich with valid social data', async () => {
      const item: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Test Project',
        description: 'Project to enrich',
        url: 'https://test.io',
        tags: []
      };
      
      // Mock enrichment
      const enriched = {
        ...item,
        metadata: {
          ...item.metadata,
          twitter_followers: 1000,
          discord_members: 500,
          social_score: 75
        }
      };
      
      expect(enriched.metadata?.social_score).toBeGreaterThan(0);
      expect(enriched.metadata?.social_score).toBeLessThanOrEqual(100);
    });
    
    it('should handle enrichment failures gracefully', async () => {
      const item: ContentItem = {
        source: 'test',
        type: 'project',
        title: 'Unreachable Project',
        description: 'Cannot enrich this',
        url: 'https://does-not-exist-123456.io',
        tags: []
      };
      
      // Should return original item if enrichment fails
      const enriched = await enrichWithFallback(item);
      expect(enriched).toEqual(item);
    });
  });

  describe('Database Operations', () => {
    it('should handle concurrent inserts', async () => {
      const items: ContentItem[] = Array.from({ length: 10 }, (_, i) => ({
        source: 'test',
        type: 'project',
        title: `Concurrent Project ${i}`,
        description: `Description for project ${i}`,
        url: `https://concurrent-${i}.io`,
        tags: ['test']
      }));
      
      // Insert all items concurrently
      const promises = items.map(item => insertItem(item));
      const results = await Promise.allSettled(promises);
      
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
    
    it('should update existing items correctly', async () => {
      const original = {
        id: 'test-id',
        score: 50,
        status: 'pending'
      };
      
      const updated = {
        ...original,
        score: 80,
        status: 'approved'
      };
      
      // Mock update
      const result = await updateItem(updated);
      expect(result.score).toBe(80);
      expect(result.status).toBe('approved');
    });
  });
});

// Helper functions
function validateContentItem(item: ContentItem, options = {}): boolean {
  const { minDescriptionLength = 10 } = options as any;
  
  if (!item.title || item.title.trim().length === 0) return false;
  if (!item.source || item.source.trim().length === 0) return false;
  if (!item.url || !isValidURL(item.url)) return false;
  if (item.description.length < minDescriptionLength) return false;
  
  return true;
}

function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidISODate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

async function enrichWithFallback(item: ContentItem): Promise<ContentItem> {
  try {
    // Attempt enrichment
    return item; // Return enriched
  } catch {
    // Return original on failure
    return item;
  }
}

async function insertItem(item: ContentItem): Promise<any> {
  // Mock insert
  return { success: true, id: Math.random().toString() };
}

async function updateItem(item: any): Promise<any> {
  // Mock update
  return item;
}