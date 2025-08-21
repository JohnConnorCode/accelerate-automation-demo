import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

// Mock schema for Web3 directory APIs (would need real API schemas)
const Web3DirectorySchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  website: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  social: z.object({
    twitter: z.string().optional(),
    discord: z.string().optional(),
    github: z.string().optional(),
  }).optional(),
  metrics: z.object({
    tvl: z.number().optional(),
    users: z.number().optional(),
    transactions: z.number().optional(),
  }).optional(),
}));

type Web3DirectoryData = z.infer<typeof Web3DirectorySchema>;

export class Web3DirectoriesFetcher extends BaseFetcher<Web3DirectoryData> {
  protected config: FetcherConfig = {
    name: 'Web3 Directories',
    url: 'https://api.web3directory.example.com/projects', // Would need real API
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 3000,
  };

  protected schema = Web3DirectorySchema;

  async fetch(): Promise<Web3DirectoryData[]> {
    // For now, return mock data as we don't have a real Web3 directory API
    console.log(`[${this.config.name}] Using mock data (no API configured)`);
    return [this.getMockData()];
  }

  transform(dataArray: Web3DirectoryData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const project of data) {
        items.push({
          source: 'Web3 Directories',
          type: 'project',
          title: project.name,
          description: project.description.substring(0, 1000),
          url: project.website,
          author: 'Web3 Directory',
          tags: [...project.tags, project.category],
          metadata: {
            directory_id: project.id,
            project_category: this.mapCategory(project.category),
            github_url: project.social?.github,
            twitter: project.social?.twitter,
            discord: project.social?.discord,
            tvl: project.metrics?.tvl,
            users: project.metrics?.users,
            transactions: project.metrics?.transactions,
          }
        });
      }
    }
    
    return items;
  }

  private mapCategory(category: string): string {
    const lower = category.toLowerCase();
    if (lower.includes('defi') || lower.includes('finance')) return 'defi';
    if (lower.includes('nft') || lower.includes('collectible')) return 'nft';
    if (lower.includes('game')) return 'gaming';
    if (lower.includes('social') || lower.includes('community')) return 'social';
    return 'infrastructure';
  }

  private getMockData(): Web3DirectoryData {
    return [
      {
        id: 'defi-1',
        name: 'Example DeFi Protocol',
        description: 'Next-generation DeFi protocol for Web3 builders',
        website: 'https://example-defi.com',
        category: 'DeFi',
        tags: ['defi', 'protocol', 'web3'],
        social: {
          twitter: '@exampledefi',
          github: 'https://github.com/example-defi',
        },
        metrics: {
          tvl: 1000000,
          users: 5000,
          transactions: 100000,
        },
      },
    ];
  }
}

// Export for backwards compatibility
export const fetchWeb3Directories = () => new Web3DirectoriesFetcher().fetch();