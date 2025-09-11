/**
 * GitHub Trending Projects Fetcher
 * Gets REAL trending repositories from GitHub
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const RepoSchema = z.object({
  name: z.string(),
  owner: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  stars: z.number(),
  forks: z.number(),
  language: z.string().nullable(),
  createdAt: z.string().optional(),
  topics: z.array(z.string()).optional()
});

export class GitHubTrendingFetcher extends BaseFetcher<typeof RepoSchema> {
  protected config: FetcherConfig = {
    name: 'GitHub Trending',
    url: 'https://api.github.com',
    rateLimit: 2000,
  };

  protected schema = RepoSchema;

  async fetch(): Promise<{ items: ContentItem[]; errors: string[] }> {
    const repos: any[] = [];
    
    try {
      // GitHub API - search for repositories created in 2024 with high stars
      const queries = [
        'created:>=2024-01-01 stars:>100 sort:stars',
        'web3 created:>=2024-01-01 stars:>10',
        'blockchain created:>=2024-01-01 stars:>10',
        'ai created:>=2024-01-01 stars:>50'
      ];
      
      for (const query of queries) {
        try {
          const response = await fetch(
            `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=30`,
            {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'AccelerateBot/1.0'
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.items) {
              const formattedRepos = data.items.map((repo: any) => ({
                name: repo.name,
                owner: repo.owner.login,
                description: repo.description,
                url: repo.html_url,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                language: repo.language,
                createdAt: repo.created_at,
                topics: repo.topics || []
              }));
              
              repos.push(...formattedRepos);
              console.log(`✅ Found ${formattedRepos.length} repos for query: "${query.substring(0, 30)}..."`);
            }
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.log(`Failed to fetch for query: ${query}`);
        }
      }
      
      // Deduplicate
      const uniqueRepos = new Map();
      repos.forEach(repo => {
        const key = `${repo.owner}/${repo.name}`;
        if (!uniqueRepos.has(key) || uniqueRepos.get(key).stars < repo.stars) {
          uniqueRepos.set(key, repo);
        }
      });
      
      const finalRepos = Array.from(uniqueRepos.values());
      console.log(`📊 GitHub: Total unique repos found: ${finalRepos.length}`);
      
      // Transform to ContentItems
      const items = this.transform([finalRepos]);
      
      return { items, errors: [] };
      
    } catch (error) {
      console.log('GitHub API failed:', error);
      
      // Return empty results on error (NO FAKE DATA)
      return { items: [], errors: [String(error)] };
    }
  }

  transform(dataArrays: any[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const repos of dataArrays) {
      for (const repo of repos) {
        // Parse creation date
        const createdDate = new Date(repo.createdAt || '2024-01-01');
        const year = createdDate.getFullYear();
        
        // ACCELERATE: Only 2024+ projects
        if (year < 2024) continue;
        
        // Skip if too many stars (likely corporate)
        if (repo.stars > 50000) continue;
        
        items.push({
          source: 'GitHub',
          type: 'project',
          title: repo.name,
          description: repo.description || `${repo.owner}/${repo.name} - A GitHub project`,
          url: repo.url,
          author: repo.owner,
          published: repo.createdAt || new Date().toISOString(),
          tags: [...(repo.topics || []), repo.language].filter(Boolean),
          metadata: {
            github_owner: repo.owner,
            github_stars: repo.stars,
            github_forks: repo.forks,
            language: repo.language,
            
            // ACCELERATE criteria
            launch_date: repo.createdAt,
            launch_year: year,
            
            // Estimate team size from contributors (small = indie)
            team_size: repo.forks < 10 ? 1 : repo.forks < 50 ? 5 : 10,
            
            // Scoring
            accelerate_score: Math.min(100,
              40 + // Base for being on GitHub
              (year === 2024 ? 20 : 10) + // Recent
              (repo.stars < 1000 ? 20 : repo.stars < 5000 ? 10 : 5) + // Indie-sized
              (repo.topics?.includes('web3') || repo.topics?.includes('blockchain') ? 10 : 0) + // Web3
              (repo.topics?.includes('ai') ? 10 : 0) // AI
            )
          }
        });
      }
    }
    
    return items;
  }
}