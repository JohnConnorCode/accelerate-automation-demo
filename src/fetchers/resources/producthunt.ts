import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const ProductHuntSchema = z.object({
  data: z.object({
    posts: z.object({
      edges: z.array(z.object({
        node: z.object({
          id: z.string(),
          name: z.string(),
          tagline: z.string(),
          description: z.string().nullable().optional(),
          url: z.string(),
          website: z.string().nullable().optional(),
          votesCount: z.number(),
          createdAt: z.string(),
          topics: z.object({
            edges: z.array(z.object({
              node: z.object({
                name: z.string(),
              }),
            })),
          }).optional(),
          makers: z.object({
            edges: z.array(z.object({
              node: z.object({
                name: z.string(),
              }),
            })),
          }).optional(),
        }),
      })),
    }),
  }),
});

type ProductHuntResponse = z.infer<typeof ProductHuntSchema>;

export class ProductHuntFetcher extends BaseFetcher<ProductHuntResponse> {
  protected config: FetcherConfig = {
    name: 'ProductHunt',
    url: 'https://api.producthunt.com/v2/api/graphql',
    headers: {
      'Authorization': `Bearer ${process.env.PRODUCTHUNT_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
    rateLimit: 2000,
    maxRetries: 3,
    timeout: 30000
  };

  protected schema = ProductHuntSchema;

  async fetch(): Promise<ProductHuntResponse[]> {
    try {
      // Skip if no token configured
      if (!process.env.PRODUCTHUNT_TOKEN) {
        console.log('[ProductHunt] No API token configured, skipping...');
        return [];
      }

      const query = `
        query {
          posts(first: 30, topic: "web3", postedAfter: "${this.getLastWeekDate()}") {
            edges {
              node {
                id
                name
                tagline
                description
                url
                website
                votesCount
                createdAt
                topics {
                  edges {
                    node {
                      name
                    }
                  }
                }
                makers {
                  edges {
                    node {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const data = await this.fetchWithRetry(this.config.url, {
        method: 'POST',
        body: JSON.stringify({ query }),
      });

      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(data: ProductHuntResponse[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const response of data) {
      const posts = response.data?.posts?.edges || [];
      
      for (const edge of posts) {
        // Quality filter - minimum 10 votes
        if (edge.node.votesCount < 10) continue;
        
        // Extract topics as tags
        const tags = edge.node.topics?.edges?.map(t => t.node.name.toLowerCase()) || [];
        
        // Check if Web3 related
        if (!this.isWeb3Related(edge.node.name, edge.node.tagline, tags)) {
          continue;
        }
        
        items.push({
          source: 'ProductHunt',
          type: 'tool',
          title: edge.node.name,
          description: `${edge.node.tagline}. ${edge.node.description || ''}`.substring(0, 1000),
          url: edge.node.website || edge.node.url,
          author: edge.node.makers?.edges?.[0]?.node?.name,
          tags: [...tags, 'producthunt', 'web3'],
          metadata: {
            product_id: edge.node.id,
            votes: edge.node.votesCount,
            created_at: edge.node.createdAt,
            makers: edge.node.makers?.edges?.map(m => m.node.name) || []
          }
        });
      }
    }
    
    return items;
  }

  /**
   * Check if content is Web3 related
   */
  private isWeb3Related(name: string, tagline: string, tags: string[]): boolean {
    const web3Keywords = [
      'web3', 'blockchain', 'crypto', 'defi', 'nft',
      'ethereum', 'solana', 'polygon', 'dao', 'dapp',
      'smart contract', 'wallet', 'token', 'metaverse'
    ];
    
    const text = `${name} ${tagline} ${tags.join(' ')}`.toLowerCase();
    return web3Keywords.some(keyword => text.includes(keyword));
  }
}

// Export for backwards compatibility
export const fetchProductHunt = () => new ProductHuntFetcher().fetch();