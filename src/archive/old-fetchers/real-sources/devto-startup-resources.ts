/**
 * REAL Dev.to fetcher for startup resources
 * Uses Dev.to's public API - NO API KEY NEEDED
 * Fetches actual articles about startups, funding, and building
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const DevToArticleSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  published_at: z.string(),
  tag_list: z.array(z.string()),
  user: z.object({
    name: z.string(),
    username: z.string(),
  }),
  positive_reactions_count: z.number(),
  comments_count: z.number(),
  reading_time_minutes: z.number(),
});

export class DevToStartupResourcesFetcher extends BaseFetcher<DevToArticleSchema[]> {
  protected config: FetcherConfig = {
    name: 'Dev.to Startup Resources',
    url: 'https://dev.to/api/articles',
    headers: {
      'Accept': 'application/json',
    },
    rateLimit: 1000,
  };

  protected schema = z.array(DevToArticleSchema);

  async fetch(): Promise<DevToArticleSchema[][]> {
    const results: DevToArticleSchema[][] = [];
    
    // Search for different startup-related content
    const searches = [
      { tag: 'startup', per_page: 10 },
      { tag: 'funding', per_page: 5 },
      { tag: 'entrepreneurship', per_page: 5 },
      { tag: 'web3', per_page: 10 },
      { tag: 'blockchain', per_page: 5 },
    ];

    for (const search of searches) {
      try {
        const params = new URLSearchParams({
          tag: search.tag,
          per_page: search.per_page.toString(),
          state: 'rising', // Get trending content
        });

        const response = await fetch(`${this.config.url}?${params}`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          const validated = this.schema.parse(data);
          results.push(validated);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimit));
      } catch (error) {
        console.error(`Error fetching Dev.to data for tag "${search.tag}":`, error);
      }
    }

    return results;
  }

  transform(dataArrays: DevToArticleSchema[][]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const articles of dataArrays) {
      for (const article of articles) {
        // Skip if we've seen this article
        if (seen.has(article.url)) continue;
        seen.add(article.url);

        // Filter for quality content
        const isQualityContent = 
          article.positive_reactions_count > 5 &&
          article.reading_time_minutes > 2 &&
          article.description.length > 50;

        if (!isQualityContent) continue;

        // Determine if it's about funding, tools, or general resources
        const tags = article.tag_list.map(t => t.toLowerCase());
        const isFunding = tags.some(t => 
          t.includes('funding') || t.includes('investor') || 
          t.includes('grant') || t.includes('accelerator')
        );
        const isTool = tags.some(t => 
          t.includes('tool') || t.includes('productivity') || 
          t.includes('saas') || t.includes('api')
        );

        items.push({
          source: 'Dev.to',
          type: isFunding ? 'funding' : isTool ? 'resource' : 'resource',
          title: article.title,
          description: article.description,
          url: article.url,
          author: article.user.name,
          published: article.published_at,
          tags: article.tag_list,
          metadata: {
            reading_time: article.reading_time_minutes,
            reactions_count: article.positive_reactions_count,
            comments_count: article.comments_count,
            
            // Quality indicators
            engagement_score: article.positive_reactions_count + (article.comments_count * 2),
            is_popular: article.positive_reactions_count > 50,
            is_detailed: article.reading_time_minutes > 5,
            
            // Resource classification
            resource_type: isFunding ? 'funding_guide' : isTool ? 'tool' : 'article',
            topics: tags,
            
            // Score for ACCELERATE
            accelerate_score: Math.min(100,
              40 + // Base score for being real content
              Math.min(20, article.positive_reactions_count / 5) + // Up to 20 for reactions
              Math.min(10, article.reading_time_minutes * 2) + // Up to 10 for depth
              (tags.includes('startup') ? 10 : 0) + // Startup relevance
              (tags.includes('web3') || tags.includes('blockchain') ? 10 : 0) + // Web3 relevance
              (isFunding ? 10 : 0) // Funding content bonus
            ),
          }
        });
      }
    }

    return items;
  }
}