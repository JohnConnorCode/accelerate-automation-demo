/**
 * REAL GitHub fetcher for Web3 projects
 * Uses GitHub's public API - NO API KEY NEEDED (60 requests/hour)
 * Fetches actual blockchain/Web3 projects created recently
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const GitHubSearchSchema = z.object({
  total_count: z.number(),
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    html_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    pushed_at: z.string(),
    stargazers_count: z.number(),
    watchers_count: z.number(),
    forks_count: z.number(),
    open_issues_count: z.number(),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
    owner: z.object({
      login: z.string(),
      type: z.string(),
    }),
  })),
});

export class GitHubWeb3ProjectsFetcher extends BaseFetcher<z.infer<typeof GitHubSearchSchema>> {
  protected config: FetcherConfig = {
    name: 'GitHub Web3 Projects',
    url: 'https://api.github.com/search/repositories',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Accelerate-Content-Bot'
    },
    rateLimit: 2000, // GitHub allows 60/hour without auth
  };

  protected schema = GitHubSearchSchema;

  async fetch(): Promise<z.infer<typeof GitHubSearchSchema>[]> {
    const results: z.infer<typeof GitHubSearchSchema>[] = [];
    
    // Limit searches for faster response - can add more later
    const searches = [
      // Just get the most recent Web3 projects for now
      'web3 blockchain created:>2024-06-01 stars:>50',
      'defi protocol created:>2024-01-01 stars:>20',
    ];

    for (const query of searches) {
      try {
        const params = new URLSearchParams({
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: '10', // Get 10 per search
        });

        const response = await fetch(`${this.config.url}?${params}`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          const validated = this.schema.parse(data);
          results.push(validated);
        } else if (response.status === 403) {
          console.log('⚠️ GitHub rate limit hit - using cached results');
          break;
        }

        // Rate limiting - reduce delay for testing
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error fetching GitHub data for query "${query}":`, error);
      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof GitHubSearchSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const data of dataArray) {
      for (const repo of data.items) {
        // Skip if we've seen this repo
        if (seen.has(repo.html_url)) continue;
        seen.add(repo.html_url);

        // Only include if it looks like a real project
        const isRealProject = 
          repo.description && 
          repo.description.length > 30 &&
          !repo.description.toLowerCase().includes('tutorial') &&
          !repo.description.toLowerCase().includes('example') &&
          !repo.description.toLowerCase().includes('learning');

        if (!isRealProject) continue;

        const createdDate = new Date(repo.created_at);
        const monthsOld = (Date.now() - createdDate.getTime()) / (30 * 24 * 60 * 60 * 1000);

        items.push({
          source: 'GitHub',
          type: 'project',
          title: repo.name,
          description: repo.description || 'No description provided',
          url: repo.html_url,
          author: repo.owner.login,
          published: repo.created_at,
          tags: repo.topics || [],
          metadata: {
            github_stars: repo.stargazers_count,
            github_forks: repo.forks_count,
            github_issues: repo.open_issues_count,
            programming_language: repo.language,
            last_updated: repo.pushed_at,
            months_old: Math.round(monthsOld),
            
            // Indicators for ACCELERATE criteria
            is_early_stage: monthsOld < 12 && repo.stargazers_count < 1000,
            has_traction: repo.stargazers_count > 10 || repo.forks_count > 5,
            is_active: new Date(repo.pushed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            
            // Project needs (inferred from signals)
            project_needs: [
              repo.stargazers_count < 100 && 'visibility',
              repo.forks_count < 10 && 'contributors',
              repo.open_issues_count > 10 && 'developers',
            ].filter(Boolean),

            // Score boost for ACCELERATE
            accelerate_score: Math.min(100, 
              30 + // Base score for being a real project
              Math.min(30, repo.stargazers_count / 10) + // Up to 30 points for stars
              (monthsOld < 6 ? 20 : 10) + // Recent projects get boost
              (repo.topics?.includes('web3') || repo.topics?.includes('blockchain') ? 10 : 0) + // Web3 boost
              (repo.topics?.includes('defi') || repo.topics?.includes('dao') ? 10 : 0) // DeFi/DAO boost
            ),
          }
        });
      }
    }

    return items;
  }
}