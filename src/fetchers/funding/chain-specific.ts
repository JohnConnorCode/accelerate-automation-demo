import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const ChainProgramSchema = z.array(z.object({
  id: z.string(),
  chain: z.string(),
  name: z.string(),
  description: z.string(),
  program_type: z.string(),
  website: z.string(),
  funding: z.object({
    min_usd: z.number(),
    max_usd: z.number(),
    token: z.string().optional(),
  }),
  application_deadline: z.string().nullable(),
  requirements: z.object({
    chain_specific: z.array(z.string()),
    general: z.array(z.string()),
  }),
  benefits: z.array(z.string()),
  contact: z.string().optional(),
}));

type ChainProgramData = z.infer<typeof ChainProgramSchema>;

export class ChainSpecificFetcher extends BaseFetcher<ChainProgramData> {
  protected config: FetcherConfig = {
    name: 'Chain-Specific Programs',
    url: 'https://api.chain-programs.example.com/programs',
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 3000,
  };

  protected schema = ChainProgramSchema;

  async fetch(): Promise<ChainProgramData[]> {
    // Would fetch from multiple chain-specific APIs (Polygon, Avalanche, Solana, etc.)
    console.log(`[${this.config.name}] Using mock data (no API configured)`);
    return [this.getMockData()];
  }

  transform(dataArray: ChainProgramData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const program of data) {
        items.push({
          source: 'Chain-Specific Programs',
          type: 'funding',
          title: `${program.chain} - ${program.name}`,
          description: `${program.description} (Chain: ${program.chain})`.substring(0, 1000),
          url: program.website,
          author: program.chain,
          tags: [program.chain.toLowerCase(), program.program_type, 'blockchain'],
          metadata: {
            program_id: program.id,
            chain: program.chain,
            program_type: program.program_type,
            funding_amount_min: program.funding.min_usd,
            funding_amount_max: program.funding.max_usd,
            funding_token: program.funding.token,
            deadline: program.application_deadline,
            benefits: program.benefits,
            contact: program.contact,
            eligibility_criteria: [
              ...program.requirements.chain_specific,
              ...program.requirements.general,
            ],
          }
        });
      }
    }
    
    return items;
  }

  private getMockData(): ChainProgramData {
    return [
      {
        id: 'polygon-village-1',
        chain: 'Polygon',
        name: 'Village Program',
        description: 'Polygon Village accelerator for Web3 startups',
        program_type: 'accelerator',
        website: 'https://polygon.technology/village',
        funding: {
          min_usd: 25000,
          max_usd: 250000,
          token: 'MATIC',
        },
        application_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        requirements: {
          chain_specific: ['Building on Polygon', 'Polygon SDK integration'],
          general: ['Early-stage startup', 'Innovative use case'],
        },
        benefits: ['Funding', 'Technical support', 'Marketing'],
        contact: 'village@polygon.technology',
      },
      {
        id: 'solana-grant-1',
        chain: 'Solana',
        name: 'Foundation Grants',
        description: 'Solana Foundation grants for ecosystem development',
        program_type: 'grant',
        website: 'https://solana.com/grants',
        funding: {
          min_usd: 5000,
          max_usd: 100000,
          token: 'SOL',
        },
        application_deadline: null,
        requirements: {
          chain_specific: ['Building on Solana', 'Solana Web3.js usage'],
          general: ['Open source contribution', 'Clear impact on ecosystem'],
        },
        benefits: ['Funding', 'Technical mentorship', 'Ecosystem connections'],
      },
    ];
  }
}

// Export for backwards compatibility
export const fetchChainSpecific = () => new ChainSpecificFetcher().fetch();