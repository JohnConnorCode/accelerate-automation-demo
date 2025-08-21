import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const GitHubProjectSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable(),
    html_url: z.string(),
    homepage: z.string().nullable().optional(),
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

type GitHubProjectData = z.infer<typeof GitHubProjectSchema>;

export class GitHubReposFetcher extends BaseFetcher<GitHubProjectData> {
  protected config: FetcherConfig = {
    name: 'GitHub Projects',
    url: 'https://api.github.com/search/repositories',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : '',
    },
    rateLimit: 2000,
  };

  protected schema = GitHubProjectSchema;

  async fetch(): Promise<GitHubProjectData[]> {
    try {
      const params = new URLSearchParams({
        q: `web3 blockchain created:>${this.getLastWeekDate()}`,
        sort: 'stars',
        order: 'desc',
        per_page: '50',
      });

      const data = await this.fetchWithRetry(
        `${this.config.url}?${params.toString()}`
      );

      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [{ items: [] }];
    }
  }

  protected getLastWeekDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  }

  transform(dataArray: GitHubProjectData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const repo of data.items) {
        // Filter out low-quality repos
        if (repo.stargazers_count < 5) continue;
        
        const category = this.determineProjectCategory(repo);
        
        items.push({
          source: 'GitHub',
          type: 'project',
          title: repo.name,
          description: (repo.description || 'No description provided').substring(0, 1000),
          url: repo.html_url,
          author: repo.owner?.login || 'Unknown',
          tags: [repo.language, ...(repo.topics || [])].filter((t): t is string => Boolean(t)),
          metadata: {
            repo_id: repo.id,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            project_category: category,
            homepage: repo.homepage,
            created_at: repo.created_at,
            updated_at: repo.updated_at,
          }
        });
      }
    }
    
    return items;
  }

  private determineProjectCategory(repo: any): string {
    const description = (repo.description || '').toLowerCase();
    const topics = (repo.topics || []).join(' ').toLowerCase();
    const combined = `${description} ${topics}`;

    if (combined.includes('defi') || combined.includes('finance')) return 'defi';
    if (combined.includes('nft')) return 'nft';
    if (combined.includes('game') || combined.includes('gaming')) return 'gaming';
    if (combined.includes('social')) return 'social';
    return 'infrastructure';
  }
}

// Export for backwards compatibility
export const fetchGitHubRepos = () => new GitHubReposFetcher().fetch();