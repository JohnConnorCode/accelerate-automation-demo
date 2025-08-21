import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const DevToArticleSchema = z.array(z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  published_at: z.string(),
  positive_reactions_count: z.number(),
  comments_count: z.number(),
  reading_time_minutes: z.number(),
  tag_list: z.array(z.string()),
  user: z.object({
    name: z.string(),
    username: z.string(),
  }),
}));

type DevToResponse = z.infer<typeof DevToArticleSchema>;

export class DevToFetcher extends BaseFetcher<DevToResponse> {
  protected config: FetcherConfig = {
    name: 'Dev.to',
    url: 'https://dev.to/api/articles',
    headers: {
      'api-key': process.env.DEVTO_API_KEY || '',
    },
    rateLimit: 1000,
    maxRetries: 3,
    timeout: 30000
  };

  protected schema = DevToArticleSchema;

  async fetch(): Promise<DevToResponse[]> {
    try {
      const params = new URLSearchParams({
        tag: 'web3,blockchain',
        state: 'rising',
        per_page: '30',
      });

      const data = await this.fetchWithRetry(
        `${this.config.url}?${params.toString()}`
      );

      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: DevToResponse[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const article of data) {
        // Quality filter - minimum 5 reactions
        if (article.positive_reactions_count < 5) continue;
        
        // Check if Web3 related
        if (!this.isWeb3Related(article.title, article.description, article.tag_list)) {
          continue;
        }
        
        items.push({
          source: 'Dev.to',
          type: 'article',
          title: article.title,
          description: article.description.substring(0, 1000),
          url: article.url,
          author: article.user.name,
          tags: [...article.tag_list, 'devto'],
          metadata: {
            article_id: article.id,
            reactions: article.positive_reactions_count,
            comments: article.comments_count,
            reading_time: article.reading_time_minutes,
            published_at: article.published_at,
          }
        });
      }
    }
    
    // Limit to top 20 articles
    return items.slice(0, 20);
  }
  
  /**
   * Check if content is Web3 related
   */
  private isWeb3Related(title: string, description: string, tags: string[]): boolean {
    const web3Keywords = [
      'web3', 'blockchain', 'crypto', 'defi', 'nft',
      'ethereum', 'solana', 'polygon', 'smart contract',
      'dapp', 'dao', 'wallet', 'metamask'
    ];
    
    const text = `${title} ${description} ${tags.join(' ')}`.toLowerCase();
    return web3Keywords.some(keyword => text.includes(keyword));
  }
}

// Export for backwards compatibility
export const fetchDevTo = () => new DevToFetcher().fetch();