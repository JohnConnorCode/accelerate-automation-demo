import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const EcosystemProgramSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ecosystem: z.string(),
  program_type: z.enum(['accelerator', 'incubator', 'grant', 'bounty']),
  website: z.string(),
  funding_range: z.object({
    min: z.number(),
    max: z.number(),
  }),
  duration: z.string().optional(),
  deadline: z.string().nullable(),
  benefits: z.array(z.string()),
  requirements: z.array(z.string()),
  focus_areas: z.array(z.string()),
}));

type EcosystemProgramData = z.infer<typeof EcosystemProgramSchema>;

export class EcosystemProgramsFetcher extends BaseFetcher<EcosystemProgramData> {
  protected config: FetcherConfig = {
    name: 'Ecosystem Programs',
    url: 'https://api.ecosystem-programs.example.com/programs',
    headers: {
      'Content-Type': 'application/json',
    },
    rateLimit: 2500,
  };

  protected schema = EcosystemProgramSchema;

  async fetch(): Promise<EcosystemProgramData[]> {
    // Would fetch from multiple ecosystem program APIs

    return [this.getMockData()];
  }

  transform(dataArray: EcosystemProgramData[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const program of data) {
        items.push({
          source: 'Ecosystem Programs',
          type: 'funding',
          title: `${program.ecosystem} ${program.name}`,
          description: program.description.substring(0, 1000),
          url: program.website,
          author: program.ecosystem,
          tags: [program.ecosystem, program.program_type, ...program.focus_areas],
          metadata: {
            program_id: program.id,
            program_type: program.program_type,
            funding_amount_min: program.funding_range.min,
            funding_amount_max: program.funding_range.max,
            deadline: program.deadline,
            duration: program.duration,
            benefits: program.benefits,
            focus_areas: program.focus_areas,
            eligibility_criteria: program.requirements,
          }
        });
      }
    }
    
    return items;
  }

  private getMockData(): EcosystemProgramData {
    return [
      {
        id: 'eth-acc-1',
        name: 'Foundation Accelerator',
        description: 'Accelerating Ethereum ecosystem projects',
        ecosystem: 'Ethereum',
        program_type: 'accelerator' as const,
        website: 'https://ethereum.org/accelerator',
        funding_range: {
          min: 50000,
          max: 500000,
        },
        duration: '3 months',
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        benefits: ['Funding', 'Mentorship', 'Network access'],
        requirements: [
          'Building on Ethereum',
          'Team of 2+ people',
          'MVP or prototype',
        ],
        focus_areas: ['DeFi', 'Infrastructure', 'Developer tools'],
      },
    ];
  }
}

// Export for backwards compatibility
export const fetchEcosystemPrograms = () => new EcosystemProgramsFetcher().fetch();