/**
 * Web3 News Aggregator - REAL crypto news and projects
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

const NewsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  description: z.string().optional(),
  published: z.string().optional(),
  category: z.string().optional()
});

type NewsItem = z.infer<typeof NewsItemSchema>;

export class Web3NewsFetcher extends BaseFetcher<NewsItem[]> {
  constructor() {
    const config: FetcherConfig = {
      sourceId: 'web3-news',
      requiresAuth: false,
      rateLimit: {
        requestsPerMinute: 30,
        cooldownMs: 2000
      },
      timeout: 10000
    };
    super(config);
  }

  async fetch(): Promise<NewsItem[]> {
    const sources = [
      // RSS feeds that work without authentication
      'https://cointelegraph.com/rss',
      'https://bitcoinmagazine.com/feed',
      'https://cryptoslate.com/feed/',
      'https://decrypt.co/feed',
      'https://thedefiant.io/feed'
    ];

    const allNews: NewsItem[] = [];

    for (const feedUrl of sources) {
      try {
        console.log(`📰 Fetching from ${feedUrl}...`);
        
        // Use a simple RSS to JSON converter
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`);
        
        if (!response.ok) continue;
        
        const data = await response.json();
        
        if (data.items && Array.isArray(data.items)) {
          const newsItems: NewsItem[] = data.items.slice(0, 5).map((item: any) => ({
            title: item.title || '',
            url: item.link || item.guid || '',
            description: item.description || item.content || '',
            published: item.pubDate || new Date().toISOString(),
            category: 'crypto-news'
          }));
          
          allNews.push(...newsItems);
        }
      } catch (error) {
        console.log(`⚠️ Failed to fetch from ${feedUrl}`);
        // Continue with other sources
      }
    }

    // Add direct API sources that work without auth
    try {
      // CoinGecko trending (no auth needed)
      const trendingResponse = await fetch('https://api.coingecko.com/api/v3/search/trending');
      if (trendingResponse.ok) {
        const trending = await trendingResponse.json();
        if (trending.coins) {
          const trendingProjects = trending.coins.slice(0, 10).map((coin: any) => ({
            title: `${coin.item.name} - Trending Crypto Project`,
            url: `https://www.coingecko.com/en/coins/${coin.item.slug}`,
            description: `Market Cap Rank: ${coin.item.market_cap_rank || 'N/A'}`,
            published: new Date().toISOString(),
            category: 'trending-crypto'
          }));
          allNews.push(...trendingProjects);
        }
      }
    } catch (error) {
      console.log('⚠️ CoinGecko API failed');
    }

    return allNews;
  }

  transform(data: NewsItem[]): ContentItem[] {
    return data.map(item => {
      // Look for project needs in the content
      const needs: string[] = [];
      const content = `${item.title} ${item.description}`.toLowerCase();
      
      if (content.includes('funding') || content.includes('raise') || content.includes('investment')) {
        needs.push('funding');
      }
      if (content.includes('developer') || content.includes('engineer') || content.includes('hiring')) {
        needs.push('developers');
      }
      if (content.includes('community') || content.includes('dao') || content.includes('governance')) {
        needs.push('community');
      }
      if (content.includes('partner') || content.includes('collaboration') || content.includes('integrate')) {
        needs.push('partnerships');
      }

      return {
        title: item.title,
        description: item.description?.substring(0, 500) || '',
        url: item.url,
        platform: 'web3-news',
        contentType: 'news',
        publishedAt: item.published || new Date().toISOString(),
        metadata: {
          category: item.category,
          project_needs: needs,
          source: 'web3-news-aggregator'
        }
      };
    });
  }
}