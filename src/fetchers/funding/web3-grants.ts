import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const Web3GrantSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  website: z.string(),
  min_amount: z.number(),
  max_amount: z.number(),
  deadline: z.string().nullable(),
  organization: z.string(),
  categories: z.array(z.string()),
  requirements: z.array(z.string()),
  application_process: z.string(),
}));

const Web3GrantResponse = z.array(z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  website: z.string(),
  min_amount: z.number(),
  max_amount: z.number(),
  deadline: z.string().nullable(),
  organization: z.string(),
  categories: z.array(z.string()),
  requirements: z.array(z.string()),
  application_process: z.string(),
}));

type Web3GrantData = z.infer<typeof Web3GrantResponse>;

export class Web3GrantsFetcher extends BaseFetcher<Web3GrantData> {
  protected config: FetcherConfig = {
    name: 'Web3 Grants',
    url: 'https://api.web3grants.example.com/grants',
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 2000,
  };

  protected schema = Web3GrantResponse;

  async fetch(): Promise<Web3GrantData[]> {
    // Mock implementation - would aggregate from multiple grant platforms

    return [this.getMockData()];
  }

  transform(dataArray: Web3GrantData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const grant of data) {
        // Filter out expired grants
        if (grant.deadline && new Date(grant.deadline) < new Date()) {
          continue;
        }
        
        items.push({
          source: 'Web3 Grants',
          type: 'funding',
          title: grant.name,
          description: grant.description.substring(0, 1000),
          url: grant.website,
          author: grant.organization,
          tags: [...grant.categories, 'grant', 'web3'],
          metadata: {
            grant_id: grant.id,
            funding_amount_min: grant.min_amount,
            funding_amount_max: grant.max_amount,
            deadline: grant.deadline,
            organization: grant.organization,
            application_process: grant.application_process,
            eligibility_criteria: grant.requirements,
          }
        });
      }
    }
    
    return items;
  }

  private getMockData(): Web3GrantData {
    return [
      {
        id: 'w3f-grant-1',
        name: 'Web3 Foundation Grant',
        description: 'Supporting open-source Web3 infrastructure',
        website: 'https://foundation.example.com/grants',
        min_amount: 10000,
        max_amount: 100000,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        organization: 'Web3 Foundation',
        categories: ['infrastructure', 'open-source', 'web3'],
        requirements: [
          'Open source project',
          'Web3 ecosystem benefit',
          'Clear milestones',
        ],
        application_process: 'Submit proposal through online form',
      },
      {
        id: 'pl-grant-1',
        name: 'Protocol Labs Grants',
        description: 'Funding for IPFS and Filecoin ecosystem',
        website: 'https://protocollabs.example.com/grants',
        min_amount: 5000,
        max_amount: 250000,
        deadline: null,
        organization: 'Protocol Labs',
        categories: ['ipfs', 'filecoin', 'storage', 'infrastructure'],
        requirements: [
          'IPFS or Filecoin integration',
          'Technical team',
        ],
        application_process: 'Apply through grants portal',
      },
    ];
  }
}

// Export for backwards compatibility
export const fetchWeb3Grants = () => new Web3GrantsFetcher().fetch();