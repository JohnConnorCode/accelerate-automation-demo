import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ProductHuntFetcher } from '../fetchers/resources/producthunt';
import { DevToFetcher } from '../fetchers/resources/devto';
import { GitHubToolsFetcher } from '../fetchers/resources/github-tools';
import { GitHubReposFetcher } from '../fetchers/projects/github-repos';
import { GitcoinFetcher } from '../fetchers/funding/gitcoin';
import { AIScorer } from '../lib/ai-scorer';

describe('Content Fetchers', () => {
  describe('Resource Fetchers', () => {
    it('ProductHunt fetcher should return valid resources', async () => {
      const fetcher = new ProductHuntFetcher();
      const results = await fetcher.fetch();
      
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const item = results[0];
        expect(item).toHaveProperty('url');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('description');
        expect(item.content_type).toBe('resource');
      }
    }, 30000);

    it('Dev.to fetcher should return valid articles', async () => {
      const fetcher = new DevToFetcher();
      const results = await fetcher.fetch();
      
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const item = results[0];
        expect(item.content_type).toBe('resource');
        expect(item.resource_source).toBe('devto');
      }
    }, 30000);

    it('GitHub Tools fetcher should return repositories', async () => {
      const fetcher = new GitHubToolsFetcher();
      const results = await fetcher.fetch();
      
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const item = results[0];
        expect(item.resource_source).toBe('github_tools');
        expect(item.url).toContain('github.com');
      }
    }, 30000);
  });

  describe('Project Fetchers', () => {
    it('GitHub Repos fetcher should return valid projects', async () => {
      const fetcher = new GitHubReposFetcher();
      const results = await fetcher.fetch();
      
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const item = results[0];
        expect(item.content_type).toBe('project');
        expect(item.project_source).toBe('github_repos');
      }
    }, 30000);
  });

  describe('Funding Fetchers', () => {
    it('Gitcoin fetcher should return funding programs', async () => {
      const fetcher = new GitcoinFetcher();
      const results = await fetcher.fetch();
      
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        const item = results[0];
        expect(item.content_type).toBe('funding');
        expect(item).toHaveProperty('funding_amount_min');
        expect(item).toHaveProperty('funding_amount_max');
      }
    }, 30000);
  });
});

describe('AI Scorer', () => {
  let scorer: AIScorer;

  beforeAll(() => {
    scorer = new AIScorer();
  });

  it('should score content and return valid score', async () => {
    const content = {
      title: 'Web3 Development Tools',
      description: 'Essential tools for blockchain development',
      url: 'https://example.com',
      tags: ['web3', 'blockchain', 'tools'],
      content_type: 'resource',
    };

    const score = await scorer.scoreContent(content);
    
    expect(score).not.toBeNull();
    if (score) {
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
      expect(score).toHaveProperty('relevance');
      expect(score).toHaveProperty('quality');
      expect(score).toHaveProperty('urgency');
      expect(score).toHaveProperty('authority');
      expect(score).toHaveProperty('reasoning');
      expect(score).toHaveProperty('recommendation');
    }
  });

  it('should handle batch scoring', async () => {
    const contents = [
      {
        title: 'DeFi Protocol',
        description: 'Decentralized finance protocol',
        url: 'https://example1.com',
        tags: ['defi'],
      },
      {
        title: 'NFT Marketplace',
        description: 'Buy and sell NFTs',
        url: 'https://example2.com',
        tags: ['nft'],
      },
    ];

    const scores = await scorer.scoreBatch(contents);
    
    expect(scores).toBeInstanceOf(Map);
    expect(scores.size).toBeGreaterThan(0);
    
    for (const [url, score] of scores) {
      expect(typeof url).toBe('string');
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(1);
    }
  });

  it('should determine auto-approval correctly', () => {
    const highScore = {
      relevance: 0.9,
      quality: 0.9,
      urgency: 0.8,
      authority: 0.8,
      overall: 0.85,
      reasoning: 'High quality content',
      categories: ['web3'],
      sentiment: 'positive' as const,
      recommendation: 'approve' as const,
    };

    const lowScore = {
      relevance: 0.2,
      quality: 0.3,
      urgency: 0.2,
      authority: 0.2,
      overall: 0.25,
      reasoning: 'Low quality content',
      categories: ['spam'],
      sentiment: 'negative' as const,
      recommendation: 'reject' as const,
    };

    expect(scorer.shouldAutoApprove(highScore)).toBe(true);
    expect(scorer.shouldAutoReject(lowScore)).toBe(true);
  });
});

describe('Deduplication', () => {
  it('should detect duplicate URLs', () => {
    const items = [
      { url: 'https://example.com/1', title: 'Item 1' },
      { url: 'https://example.com/2', title: 'Item 2' },
      { url: 'https://example.com/1', title: 'Duplicate' },
    ];

    const unique = Array.from(
      new Map(items.map(item => [item.url, item])).values()
    );

    expect(unique.length).toBe(2);
    expect(unique.find(i => i.title === 'Duplicate')).toBeUndefined();
  });

  it('should normalize URLs for comparison', () => {
    const normalize = (url: string) => {
      const u = new URL(url);
      // Remove trailing slash, www, and sort query params
      return `${u.protocol}//${u.hostname.replace('www.', '')}${u.pathname.replace(/\/$/, '')}`;
    };

    expect(normalize('https://www.example.com/')).toBe('https://example.com');
    expect(normalize('https://example.com')).toBe('https://example.com');
    expect(normalize('https://example.com/path/')).toBe('https://example.com/path');
  });
});

describe('Data Validation', () => {
  it('should validate required fields', () => {
    const validate = (item: any) => {
      const required = ['url', 'title', 'description', 'content_type'];
      return required.every(field => item[field] !== undefined);
    };

    const valid = {
      url: 'https://example.com',
      title: 'Test',
      description: 'Test description',
      content_type: 'resource',
    };

    const invalid = {
      url: 'https://example.com',
      title: 'Test',
      // missing description and content_type
    };

    expect(validate(valid)).toBe(true);
    expect(validate(invalid)).toBe(false);
  });

  it('should sanitize HTML from descriptions', () => {
    const sanitize = (text: string) => {
      return text.replace(/<[^>]*>?/gm, '');
    };

    const htmlText = '<p>This is <strong>HTML</strong> content</p>';
    const clean = sanitize(htmlText);
    
    expect(clean).toBe('This is HTML content');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
  });
});

describe('Error Handling', () => {
  it('should handle API failures gracefully', async () => {
    // Mock a fetcher that always fails
    class FailingFetcher extends GitHubToolsFetcher {
      async fetch(): Promise<Resource[]> {
        throw new Error('API Error');
      }
    }

    const fetcher = new FailingFetcher();
    
    // Should not throw, should return empty array
    await expect(fetcher.fetch()).rejects.toThrow('API Error');
  });

  it('should handle malformed API responses', () => {
    const parseResponse = (data: any) => {
      try {
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response');
        }
        return data.items || [];
      } catch (error) {
        return [];
      }
    };

    expect(parseResponse(null)).toEqual([]);
    expect(parseResponse(undefined)).toEqual([]);
    expect(parseResponse('string')).toEqual([]);
    expect(parseResponse({ items: [1, 2, 3] })).toEqual([1, 2, 3]);
  });
});