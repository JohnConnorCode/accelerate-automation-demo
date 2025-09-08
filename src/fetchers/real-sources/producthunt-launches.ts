/**
 * ProductHunt Fetcher - REAL startup launches
 * Uses ProductHunt's RSS feed - NO API KEY NEEDED
 * Gets actual products launching TODAY
 */

import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

// ProductHunt doesn't have a public API, but RSS works
const ProductHuntItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  description: z.string(),
  pubDate: z.string(),
  author: z.string().optional(),
  categories: z.array(z.string()).optional(),
});

export class ProductHuntLaunchesFetcher extends BaseFetcher<ProductHuntItemSchema[]> {
  protected config: FetcherConfig = {
    name: 'ProductHunt Launches',
    url: 'https://www.producthunt.com/feed',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
    },
    rateLimit: 1000,
  };

  protected schema = z.array(ProductHuntItemSchema);

  async fetch(): Promise<ProductHuntItemSchema[][]> {
    try {
      const response = await fetch(this.config.url, {
        headers: this.config.headers as HeadersInit,
      });

      if (!response.ok) {
        console.error('ProductHunt RSS fetch failed:', response.status);
        return [];
      }

      const text = await response.text();
      
      // Parse RSS feed
      const items = this.parseRSS(text);
      
      // Return as array of arrays for consistency
      return [items];
    } catch (error) {
      console.error('Error fetching ProductHunt:', error);
      return [];
    }
  }

  private parseRSS(xml: string): ProductHuntItemSchema[] {
    const items: ProductHuntItemSchema[] = [];
    
    // Extract all items from RSS
    const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    
    for (const itemXml of itemMatches) {
      try {
        const title = this.extractTag(itemXml, 'title');
        const link = this.extractTag(itemXml, 'link');
        const description = this.extractTag(itemXml, 'description');
        const pubDate = this.extractTag(itemXml, 'pubDate');
        const author = this.extractTag(itemXml, 'author') || this.extractTag(itemXml, 'dc:creator');
        
        // Extract categories
        const categoryMatches = itemXml.match(/<category>([^<]+)<\/category>/g) || [];
        const categories = categoryMatches.map(cat => 
          cat.replace(/<\/?category>/g, '')
        );
        
        if (title && link) {
          items.push({
            title,
            link,
            description: description || '',
            pubDate: pubDate || new Date().toISOString(),
            author,
            categories,
          });
        }
      } catch (error) {
        console.error('Error parsing RSS item:', error);
      }
    }
    
    return items;
  }

  private extractTag(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`)) ||
                  xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  }

  transform(dataArrays: ProductHuntItemSchema[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const products of dataArrays) {
      for (const product of products) {
        // Parse the description to extract more info
        const descParts = product.description.split(' - ');
        const tagline = descParts.length > 1 ? descParts[1] : product.description;
        
        // Calculate how recent this is
        const launchDate = new Date(product.pubDate);
        const daysOld = (Date.now() - launchDate.getTime()) / (24 * 60 * 60 * 1000);
        
        // Determine if it's Web3/startup related
        const isWeb3 = 
          product.categories?.some(cat => 
            cat.toLowerCase().includes('crypto') ||
            cat.toLowerCase().includes('blockchain') ||
            cat.toLowerCase().includes('web3') ||
            cat.toLowerCase().includes('defi')
          ) ||
          product.description.toLowerCase().includes('blockchain') ||
          product.description.toLowerCase().includes('web3') ||
          product.description.toLowerCase().includes('crypto');
        
        const isStartupTool = 
          product.categories?.some(cat =>
            cat.toLowerCase().includes('productivity') ||
            cat.toLowerCase().includes('developer') ||
            cat.toLowerCase().includes('saas') ||
            cat.toLowerCase().includes('marketing')
          );
        
        // Skip if not relevant
        if (!isWeb3 && !isStartupTool && daysOld > 7) continue;
        
        items.push({
          source: 'ProductHunt',
          type: 'project', // Most ProductHunt launches are projects
          title: product.title,
          description: tagline,
          url: product.link,
          author: product.author || 'Unknown',
          published: product.pubDate,
          tags: product.categories || [],
          metadata: {
            // ProductHunt specific
            product_hunt_url: product.link,
            launch_date: product.pubDate,
            days_since_launch: Math.round(daysOld),
            
            // ACCELERATE criteria fields
            is_new_launch: daysOld < 1,
            is_recent: daysOld < 7,
            is_web3: isWeb3,
            is_startup_tool: isStartupTool,
            
            // Inferred project details (we'd need to fetch more for accuracy)
            launch_year: launchDate.getFullYear(),
            launch_month: launchDate.getMonth() + 1,
            
            // Score for ACCELERATE
            accelerate_score: Math.min(100,
              50 + // Base for being on ProductHunt
              (daysOld < 1 ? 30 : daysOld < 3 ? 20 : daysOld < 7 ? 10 : 0) + // Recency
              (isWeb3 ? 15 : 0) + // Web3 bonus
              (isStartupTool ? 5 : 0) // Tool bonus
            ),
            
            // Needs enrichment to get:
            // - funding_raised
            // - team_size
            // - github_url
            // - twitter_url
            // These would need to be fetched from the actual ProductHunt page
          }
        });
      }
    }
    
    return items;
  }
}