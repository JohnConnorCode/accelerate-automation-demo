/**
 * Simple tests for the core system
 */
import { SimpleScorer } from './simple-scorer';

describe('SimpleScorer', () => {
  const scorer = new SimpleScorer();

  it('should score high-quality content highly', () => {
    const content = {
      title: 'AI-Powered Blockchain Development Platform',
      description: 'A comprehensive platform that leverages artificial intelligence to streamline blockchain application development. Features include smart contract generation, automated testing, and deployment optimization. Built by a team of experienced developers with backing from major VCs.',
      url: 'https://example.com',
      created_at: new Date().toISOString(),
      team_size: 5,
      funding_raised: 2000000
    };

    const result = scorer.score(content);
    
    expect(result.score).toBeGreaterThan(60);
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.recommendation).not.toBe('reject');
  });

  it('should reject low-quality content', () => {
    const content = {
      title: 'Test',
      description: 'Short desc'
    };

    const result = scorer.score(content);
    
    expect(result.score).toBeLessThan(30);
    expect(result.recommendation).toBe('reject');
  });

  it('should penalize old content', () => {
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);

    const content = {
      title: 'Old Project',
      description: 'This is an old project that was created years ago',
      created_at: oldDate.toISOString()
    };

    const result = scorer.score(content);
    
    expect(result.factors.freshness).toBe(0);
  });

  it('should reward keyword matches', () => {
    const content = {
      title: 'Blockchain AI Startup',
      description: 'Web3 DeFi platform for developers building open source ML models'
    };

    const result = scorer.score(content);
    
    expect(result.factors.relevance).toBeGreaterThan(15);
  });

  it('should batch score efficiently', () => {
    const items = Array(100).fill(null).map((_, i) => ({
      title: `Project ${i}`,
      description: `Description for project ${i}`
    }));

    const start = Date.now();
    const results = scorer.batchScore(items);
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(100); // Should be very fast
  });
});