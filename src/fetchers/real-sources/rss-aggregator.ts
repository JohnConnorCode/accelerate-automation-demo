import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';
import { z } from 'zod';

/**
 * RSS FEED AGGREGATOR
 * Fetches from multiple RSS feeds that provide startup and funding news
 * These are all public RSS feeds that don't require authentication
 */

const RSSItemSchema = z.object({
  title: z.string(),
  link: z.string(),
  description: z.string().optional(),
  pubDate: z.string().optional(),
  author: z.string().optional(),
  categories: z.array(z.string()).optional(),
  source: z.string(),
});

type RSSItem = z.infer<typeof RSSItemSchema>;

export class RSSAggregatorFetcher extends BaseFetcher<RSSItem[]> {
  protected config: FetcherConfig = {
    name: 'RSS Aggregator',
    url: 'various',
    rateLimit: 2000,
    timeout: 10000,
  };

  protected schema = z.array(RSSItemSchema);

  // Web3-focused RSS feeds for ACCELERATE platform
  private rssFeeds = [
    // YC-specific feeds
    {
      name: 'YCombinator Blog',
      url: 'https://www.ycombinator.com/blog/rss',
      type: 'news',
    },
    {
      name: 'Launch YC',
      url: 'https://www.launch.ycombinator.com/feed',
      type: 'news',
    },
    // Web3/Crypto primary sources
    {
      name: 'CoinDesk',
      url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
      type: 'news',
    },
    {
      name: 'CoinTelegraph Startups',
      url: 'https://cointelegraph.com/rss/tag/startups',
      type: 'funding',
    },
    {
      name: 'CoinTelegraph Funding',
      url: 'https://cointelegraph.com/rss/tag/funding',
      type: 'funding',
    },
    {
      name: 'The Block',
      url: 'https://www.theblockcrypto.com/rss.xml',
      type: 'news',
    },
    {
      name: 'Decrypt',
      url: 'https://decrypt.co/feed',
      type: 'news',
    },
    {
      name: 'CryptoSlate',
      url: 'https://cryptoslate.com/feed/',
      type: 'news',
    },
    {
      name: 'The Defiant',
      url: 'https://thedefiant.io/api/feed',
      type: 'news',
    },
    {
      name: 'Bankless',
      url: 'https://newsletter.banklesshq.com/feed',
      type: 'resources',
    },
    {
      name: 'Messari',
      url: 'https://messari.io/rss',
      type: 'news',
    },
    {
      name: 'DeFi Pulse',
      url: 'https://www.defipulse.com/blog/feed',
      type: 'news',
    },
    // Some general tech for YC coverage
    {
      name: 'TechCrunch Crypto',
      url: 'https://techcrunch.com/category/cryptocurrency/feed/',
      type: 'news',
    },
    {
      name: 'Crunchbase News',
      url: 'https://news.crunchbase.com/feed/',
      type: 'funding',
    },
  ];

  async fetch(): Promise<RSSItem[][]> {
    const allItems: RSSItem[] = [];
    
    for (const feed of this.rssFeeds) {
      try {
        console.log(`Fetching RSS: ${feed.name}...`);
        
        const response = await fetch(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml',
          },
        });

        if (response.ok) {
          const xml = await response.text();
          const items = this.parseRSS(xml, feed.name);
          
          // Filter for 2024+ content
          const recentItems = items.filter(item => {
            if (!item.pubDate) return true; // Keep if no date
            const date = new Date(item.pubDate);
            return date.getFullYear() >= 2024;
          });
          
          allItems.push(...recentItems.slice(0, 10)); // Limit per feed
          console.log(`  ✓ Found ${recentItems.length} recent items from ${feed.name}`);
        }
      } catch (error) {
        console.log(`  ✗ Failed to fetch ${feed.name}:`, error);
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📰 RSS Aggregator: Found ${allItems.length} total items from ${this.rssFeeds.length} feeds`);
    
    return [allItems];
  }

  private parseRSS(xml: string, sourceName: string): RSSItem[] {
    const items: RSSItem[] = [];
    
    try {
      // Extract all <item> or <entry> elements
      const itemMatches = xml.match(/<item[^>]*>[\s\S]*?<\/item>|<entry[^>]*>[\s\S]*?<\/entry>/gi) || [];
      
      for (const itemXml of itemMatches.slice(0, 20)) {
        const title = this.extractXMLValue(itemXml, 'title');
        const link = this.extractXMLValue(itemXml, 'link') || this.extractXMLAttribute(itemXml, 'link', 'href');
        const description = this.extractXMLValue(itemXml, 'description') || this.extractXMLValue(itemXml, 'summary');
        const pubDate = this.extractXMLValue(itemXml, 'pubDate') || this.extractXMLValue(itemXml, 'published');
        const author = this.extractXMLValue(itemXml, 'author') || this.extractXMLValue(itemXml, 'dc:creator');
        
        // Extract categories
        const categoryMatches = itemXml.match(/<category[^>]*>([^<]+)<\/category>/gi) || [];
        const categories = categoryMatches.map(cat => 
          cat.replace(/<[^>]+>/g, '').trim()
        );
        
        if (title && link) {
          items.push({
            title: this.cleanText(title),
            link: link,
            description: description ? this.cleanText(description) : undefined,
            pubDate: pubDate,
            author: author ? this.cleanText(author) : undefined,
            categories: categories.length > 0 ? categories : undefined,
            source: sourceName,
          });
        }
      }
    } catch (error) {
      console.error(`Error parsing RSS from ${sourceName}:`, error);
    }
    
    return items;
  }

  private extractXMLValue(xml: string, tag: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]+)<\\/${tag}>`, 'i');
    const match = xml.match(regex);
    return match ? (match[1] || match[2]) : undefined;
  }

  private extractXMLAttribute(xml: string, tag: string, attr: string): string | undefined {
    const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : undefined;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  transform(data: RSSItem[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const rssItems of data) {
      for (const item of rssItems) {
        // Extract startup info from the content
        const startupInfo = this.extractStartupInfo(item);
        
        // Determine type based on content
        const type = this.determineContentType(item);
        
        const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
        
        items.push({
          type: type,
          title: startupInfo.companyName || item.title,
          description: (item.description || item.title).substring(0, 1000),
          url: item.link,
          source: `RSS: ${item.source}`,
          author: item.author,
          published: pubDate.toISOString(),
          tags: [
            ...(item.categories || []),
            item.source.toLowerCase().replace(/\s+/g, '-'),
            type,
          ].filter(Boolean),
          metadata: {
            rss_source: item.source,
            original_title: item.title,
            
            // Extracted startup info
            company_name: startupInfo.companyName,
            funding_amount: startupInfo.fundingAmount,
            funding_round: startupInfo.fundingRound,
            investors: startupInfo.investors,
            
            // Estimated metadata
            launch_year: startupInfo.isNew ? pubDate.getFullYear() : undefined,
            is_funding_news: startupInfo.isFunding,
            is_launch_news: startupInfo.isLaunch,
            
            // Scoring
            credibility_score: this.calculateCredibility(item.source),
            accelerate_score: this.calculateScore(item, startupInfo),
          }
        });
      }
    }
    
    return items;
  }

  private extractStartupInfo(item: RSSItem): {
    companyName?: string;
    fundingAmount?: number;
    fundingRound?: string;
    investors?: string[];
    isFunding: boolean;
    isLaunch: boolean;
    isNew: boolean;
  } {
    const text = `${item.title} ${item.description || ''}`.toLowerCase();
    
    // Extract company name (usually at start of title)
    const nameMatch = item.title.match(/^([A-Z][A-Za-z0-9\s]+)(?:\s+raises|\s+launches|\s+gets|\s+secures|\s+announces)/);
    const companyName = nameMatch ? nameMatch[1].trim() : undefined;
    
    // Extract funding amount
    let fundingAmount: number | undefined;
    const amountMatch = text.match(/\$(\d+(?:\.\d+)?)\s*(million|billion|m|b|k)/i);
    if (amountMatch) {
      const num = parseFloat(amountMatch[1]);
      const unit = amountMatch[2].toLowerCase();
      if (unit.startsWith('b')) fundingAmount = num * 1000000000;
      else if (unit.startsWith('m')) fundingAmount = num * 1000000;
      else if (unit === 'k') fundingAmount = num * 1000;
      else fundingAmount = num;
    }
    
    // Extract funding round
    const roundMatch = text.match(/\b(pre-?seed|seed|series\s+[a-z]|angel)\b/i);
    const fundingRound = roundMatch ? roundMatch[1] : undefined;
    
    // Extract investors
    const investors: string[] = [];
    const investorMatch = text.match(/led by ([^,\.]+)|from ([^,\.]+)/i);
    if (investorMatch) {
      investors.push(investorMatch[1] || investorMatch[2]);
    }
    
    // Detect content type
    const isFunding = /raises|funding|investment|secures|closes|led by/i.test(text);
    const isLaunch = /launches|launching|launched|unveils|introduces|debuts/i.test(text);
    const isNew = /new|startup|early-stage|founded|emerging/i.test(text);
    
    return {
      companyName,
      fundingAmount,
      fundingRound,
      investors: investors.length > 0 ? investors : undefined,
      isFunding,
      isLaunch,
      isNew,
    };
  }

  private determineContentType(item: RSSItem): 'project' | 'funding' | 'resource' {
    const text = `${item.title} ${item.description || ''}`.toLowerCase();
    
    if (/raises|funding|investment|secures|closes|series|seed/i.test(text)) {
      return 'funding';
    }
    
    if (/launches|launching|startup|founded|builds|creating/i.test(text)) {
      return 'project';
    }
    
    return 'resource';
  }

  private calculateCredibility(source: string): number {
    const credibilityScores: Record<string, number> = {
      'TechCrunch Startups': 90,
      'TechCrunch Funding': 90,
      'VentureBeat': 85,
      'The Information': 95,
      'Crunchbase News': 90,
      'Sifted': 80,
      'EU-Startups': 75,
      'First Round Review': 85,
      'CoinDesk': 80,
      'The Block': 80,
    };
    
    return credibilityScores[source] || 70;
  }

  private calculateScore(item: RSSItem, startupInfo: any): number {
    let score = 30; // Base score for RSS content
    
    // Source quality
    score += this.calculateCredibility(item.source) / 10;
    
    // Recency
    if (item.pubDate) {
      const daysOld = (Date.now() - new Date(item.pubDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld < 7) score += 15;
      else if (daysOld < 30) score += 10;
      else if (daysOld < 90) score += 5;
    }
    
    // Content relevance
    if (startupInfo.isFunding) score += 15;
    if (startupInfo.isLaunch) score += 15;
    if (startupInfo.companyName) score += 10;
    if (startupInfo.fundingAmount && startupInfo.fundingAmount < 500000) score += 20; // Early stage
    
    // Categories
    if (item.categories?.some(cat => /web3|crypto|blockchain|defi/i.test(cat))) score += 10;
    if (item.categories?.some(cat => /ai|ml|artificial/i.test(cat))) score += 5;
    
    return Math.min(100, score);
  }
}