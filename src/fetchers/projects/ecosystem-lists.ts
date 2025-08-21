import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const EcosystemProjectSchema = z.array(z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  ecosystem: z.string(),
  category: z.string(),
  github: z.string().optional(),
  twitter: z.string().optional(),
  fundingRound: z.string().optional(),
  teamSize: z.number().optional(),
  launchDate: z.string().optional(),
}));

type EcosystemProjectData = z.infer<typeof EcosystemProjectSchema>;

export class EcosystemListsFetcher extends BaseFetcher<EcosystemProjectData> {
  protected config: FetcherConfig = {
    name: 'Ecosystem Lists',
    url: 'https://api.ecosystem.example.com/projects',
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 2000,
  };

  protected schema = EcosystemProjectSchema;

  async fetch(): Promise<EcosystemProjectData[]> {
    // Would fetch from multiple ecosystem APIs (Ethereum, Polygon, Solana, etc.)
    console.log(`[${this.config.name}] Using mock data (no API configured)`);
    return [this.getMockData()];
  }

  transform(dataArray: EcosystemProjectData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const project of data) {
        items.push({
          source: 'Ecosystem Lists',
          type: 'project',
          title: project.name,
          description: project.description.substring(0, 1000),
          url: project.url,
          author: project.ecosystem,
          tags: [project.ecosystem, project.category, 'web3'],
          metadata: {
            ecosystem: project.ecosystem,
            project_category: project.category,
            github_url: project.github,
            twitter: project.twitter,
            funding_round: project.fundingRound,
            team_size: project.teamSize,
            launch_date: project.launchDate,
          }
        });
      }
    }
    
    return items;
  }

  private getMockData(): EcosystemProjectData {
    return [
      {
        name: 'Polygon Gaming Hub',
        description: 'Gaming infrastructure on Polygon',
        url: 'https://polygon-project.example.com',
        ecosystem: 'Polygon',
        category: 'gaming',
        github: 'https://github.com/polygon-gaming',
        twitter: '@polygongaming',
        fundingRound: 'Series A',
        teamSize: 8,
        launchDate: '2024-01-15',
      },
    ];
  }
}

// Export for backwards compatibility
export const fetchEcosystemLists = () => new EcosystemListsFetcher().fetch();