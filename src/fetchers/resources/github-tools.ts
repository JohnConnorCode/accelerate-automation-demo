import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const GitHubRepoSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    html_url: z.string(),
    stargazers_count: z.number(),
    forks_count: z.number(),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
    created_at: z.string(),
    updated_at: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  })),
});

type GitHubToolData = z.infer<typeof GitHubRepoSchema>;

export class GitHubToolsFetcher extends BaseFetcher<GitHubToolData> {
  protected config: FetcherConfig = {
    name: 'GitHub Tools',
    url: 'https://api.github.com/search/repositories',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : '',
    },
    rateLimit: 2000,
  };

  protected schema = GitHubRepoSchema;

  async fetch(): Promise<GitHubToolData[]> {
    try {
      const queries = [
        'web3 tools in:name,description stars:>10',
        'blockchain SDK in:name,description stars:>20',
        'smart contract development in:description stars:>15',
      ];

      const allData: GitHubToolData[] = [];

      for (const q of queries) {
        const params = new URLSearchParams({
          q: `${q} created:>${this.getLastWeekDate()}`,
          sort: 'stars',
          order: 'desc',
          per_page: '15',
        });

        const data = await this.fetchWithRetry(
          `${this.config.url}?${params.toString()}`
        );

        allData.push(data);
        
        await this.delay(this.config.rateLimit || 1000);
      }

      return allData;
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: GitHubToolData[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();
    
    for (const data of dataArray) {
      for (const repo of data.items) {
        // Filter and deduplicate
        if (repo.stargazers_count < 10) continue;
        if (seen.has(repo.html_url)) continue;
        seen.add(repo.html_url);
        
        items.push({
          source: 'GitHub Tools',
          type: 'resource',
          title: repo.name,
          description: (repo.description || 'No description provided').substring(0, 1000),
          url: repo.html_url,
          author: repo.owner?.login || 'Unknown',
          tags: [repo.language, ...(repo.topics || [])].filter((t): t is string => Boolean(t)),
          metadata: {
            repo_id: repo.id,
            full_name: repo.full_name,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
          }
        });
      }
    }
    
    return items;
  }

  protected getLastWeekDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for backwards compatibility
export const fetchGitHubTools = () => new GitHubToolsFetcher().fetch();