/**
 * Data fetchers that work WITHOUT API keys
 * These use public endpoints, RSS feeds, and web scraping
 */

interface PublicSource {
  name: string;
  url: string;
  type: 'rss' | 'json' | 'html' | 'graphql';
  parser: (data: any) => any[];
}

export class NoApiDataFetcher {
  /**
   * Sources that work without any API key
   */
  private publicSources: PublicSource[] = [
    // 1. HACKER NEWS - Public API
    {
      name: 'hackernews-top',
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      type: 'json',
      parser: async (storyIds: number[]) => {
        // Fetch top 30 stories
        const stories = await Promise.all(
          storyIds.slice(0, 30).map(id => 
            fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
              .then(r => r.json())
          )
        );
        return stories.filter(s => s && s.url);
      }
    },

    // 2. PRODUCT HUNT - RSS Feed (No API needed!)
    {
      name: 'producthunt-rss',
      url: 'https://www.producthunt.com/feed',
      type: 'rss',
      parser: (xmlText: string) => {
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        return items.map(item => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1],
          url: item.match(/<link>(.*?)<\/link>/)?.[1],
          description: item.match(/<description>(.*?)<\/description>/)?.[1],
          pubDate: item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1],
          source: 'producthunt'
        }));
      }
    },

    // 3. DEV.TO - Public API (No auth needed!)
    {
      name: 'devto-articles',
      url: 'https://dev.to/api/articles?per_page=30&tag=web3,blockchain,startup',
      type: 'json',
      parser: (articles: any[]) => articles.map(a => ({
        title: a.title,
        description: a.description,
        url: a.url,
        tags: a.tag_list,
        created_at: a.created_at,
        user: a.user?.name,
        source: 'devto'
      }))
    },

    // 4. REDDIT - Public JSON API
    {
      name: 'reddit-startups',
      url: 'https://www.reddit.com/r/startups/top.json?limit=25',
      type: 'json',
      parser: (data: any) => data.data.children.map((post: any) => ({
        title: post.data.title,
        url: post.data.url,
        selftext: post.data.selftext,
        score: post.data.score,
        created: new Date(post.data.created_utc * 1000),
        source: 'reddit-startups'
      }))
    },

    // 5. TECHCRUNCH - RSS Feed
    {
      name: 'techcrunch-startups',
      url: 'https://techcrunch.com/category/startups/feed/',
      type: 'rss',
      parser: (xmlText: string) => {
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        return items.map(item => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1],
          url: item.match(/<link>(.*?)<\/link>/)?.[1],
          description: item.match(/<description>(.*?)<\/description>/)?.[1]?.replace(/<[^>]*>/g, ''),
          source: 'techcrunch'
        }));
      }
    },

    // 6. INDIE HACKERS - Public trending API
    {
      name: 'indiehackers',
      url: 'https://www.indiehackers.com/forum/posts.json?order=trending',
      type: 'json',
      parser: (data: any) => data.posts?.map((post: any) => ({
        title: post.title,
        url: `https://www.indiehackers.com${post.url}`,
        body: post.body,
        upvotes: post.upvotes,
        source: 'indiehackers'
      })) || []
    },

    // 7. GITHUB TRENDING - No API key needed!
    {
      name: 'github-trending',
      url: 'https://github.com/trending/developers?since=weekly',
      type: 'html',
      parser: async (html: string) => {
        // Parse trending repos from HTML
        const repos = html.match(/href="\/[^\/]+\/[^"]+" class=".*?Link/g) || [];
        return repos.slice(0, 20).map(match => {
          const repo = match.match(/href="\/([^"]+)"/)?.[1];
          return {
            name: repo?.split('/')[1],
            owner: repo?.split('/')[0],
            url: `https://github.com/${repo}`,
            source: 'github-trending'
          };
        });
      }
    },

    // 8. ANGELLIST/WELLFOUND - Public company pages
    {
      name: 'wellfound-trending',
      url: 'https://wellfound.com/trending',
      type: 'html',
      parser: (html: string) => {
        // Extract company data from HTML
        const companies = html.match(/<div class="company-card"[\s\S]*?<\/div>/g) || [];
        return companies.map(card => ({
          name: card.match(/company-name">(.*?)</)?.[1],
          tagline: card.match(/tagline">(.*?)</)?.[1],
          url: card.match(/href="([^"]+)"/)?.[1],
          source: 'wellfound'
        }));
      }
    },

    // 9. Y COMBINATOR - Public company directory
    {
      name: 'ycombinator-companies',
      url: 'https://www.ycombinator.com/companies',
      type: 'html',
      parser: (html: string) => {
        // Parse YC companies
        const companies = html.match(/<a class=".*?company.*?"[\s\S]*?<\/a>/g) || [];
        return companies.slice(0, 30).map(company => ({
          name: company.match(/>([^<]+)</)?.[1],
          url: company.match(/href="([^"]+)"/)?.[1],
          batch: company.match(/\((W\d{2}|S\d{2})\)/)?.[1],
          source: 'ycombinator'
        }));
      }
    },

    // 10. CRUNCHBASE - News RSS (public)
    {
      name: 'crunchbase-news',
      url: 'https://news.crunchbase.com/feed/',
      type: 'rss',
      parser: (xmlText: string) => {
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        return items.map(item => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1],
          url: item.match(/<link>(.*?)<\/link>/)?.[1],
          description: item.match(/<description>(.*?)<\/description>/)?.[1],
          source: 'crunchbase-news'
        }));
      }
    },

    // 11. DEFI PULSE - Public API
    {
      name: 'defipulse',
      url: 'https://api.defipulse.com/api/v1/defipulse/api/GetProjects',
      type: 'json',
      parser: (projects: any[]) => projects.map(p => ({
        name: p.name,
        symbol: p.symbol,
        category: p.category,
        tvl: p.value?.tvl?.USD,
        chains: p.chains,
        source: 'defipulse'
      }))
    },

    // 12. CRYPTO PANIC - RSS Feed
    {
      name: 'cryptopanic',
      url: 'https://cryptopanic.com/news/rss/',
      type: 'rss',
      parser: (xmlText: string) => {
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        return items.map(item => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1],
          url: item.match(/<link>(.*?)<\/link>/)?.[1],
          source: 'cryptopanic'
        }));
      }
    }
  ];

  /**
   * Fetch from all public sources without API keys
   */
  async fetchAllPublicSources(): Promise<any[]> {
    const results = [];
    
    for (const source of this.publicSources) {
      try {
        console.log(`Fetching from ${source.name} (no API key needed)...`);
        
        let data;
        if (source.type === 'rss' || source.type === 'html') {
          // Fetch as text for RSS/HTML
          const response = await fetch(source.url);
          data = await response.text();
        } else {
          // Fetch as JSON
          const response = await fetch(source.url);
          data = await response.json();
        }
        
        // Parse the data
        const items = await source.parser(data);
        console.log(`✅ Got ${items.length} items from ${source.name}`);
        
        results.push(...items);
      } catch (error) {
        console.log(`⚠️ Failed to fetch ${source.name}:`, error);
        // Continue with other sources
      }
    }
    
    return results;
  }

  /**
   * Additional scraping for specific high-value sources
   */
  async scrapeWeb3Projects(): Promise<any[]> {
    const projects = [];
    
    // Scrape from various Web3 directories
    const directories = [
      'https://www.stateofthedapps.com/rankings',
      'https://dappradar.com/rankings',
      'https://defillama.com/protocols',
      'https://www.coingecko.com/en/categories/decentralized-finance-defi',
      'https://messari.io/screener',
      'https://chain.link/ecosystem',
      'https://ethereum.org/en/dapps/',
      'https://alchemy.com/dapps',
      'https://www.quicknode.com/guides/web3-sdks/how-to-build-a-dapp'
    ];
    
    // We can use Puppeteer or Playwright for more sophisticated scraping
    // For now, using simple fetch where possible
    
    return projects;
  }

  /**
   * Get data from blockchain explorers (all public!)
   */
  async fetchBlockchainData(): Promise<any[]> {
    const blockchainSources = [
      // Ethereum - Recent contracts
      'https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=LATEST',
      
      // BSC - Recent tokens
      'https://api.bscscan.com/api?module=token&action=tokentx&page=1&offset=100',
      
      // Polygon - Recent transactions
      'https://api.polygonscan.com/api?module=account&action=txlist&page=1&offset=100'
    ];
    
    // These often have free tiers without API keys
    return [];
  }

  /**
   * Use Google Custom Search (100 free queries/day)
   */
  async searchGoogle(query: string): Promise<any[]> {
    // Google offers 100 free searches per day
    // You need to create a Custom Search Engine (free)
    const cx = 'YOUR_SEARCH_ENGINE_ID'; // Create at https://cse.google.com
    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.items || [];
    } catch {
      return [];
    }
  }

  /**
   * RSS Aggregation from multiple sources
   */
  async aggregateRSSFeeds(): Promise<any[]> {
    const rssFeeds = [
      'https://bitcoinmagazine.com/feed',
      'https://cointelegraph.com/rss',
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://decrypt.co/feed',
      'https://www.theblockcrypto.com/rss.xml',
      'https://blog.ethereum.org/feed.xml',
      'https://a16zcrypto.com/feed/',
      'https://medium.com/feed/@VitalikButerin'
    ];
    
    const allItems = [];
    for (const feed of rssFeeds) {
      try {
        const response = await fetch(feed);
        const xml = await response.text();
        // Parse RSS items
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        allItems.push(...items.map(item => ({
          title: item.match(/<title>(.*?)<\/title>/)?.[1],
          url: item.match(/<link>(.*?)<\/link>/)?.[1],
          source: new URL(feed).hostname
        })));
      } catch {
        // Skip failed feeds
      }
    }
    
    return allItems;
  }
}

// Export singleton instance
export const noApiDataFetcher = new NoApiDataFetcher();

/**
 * Example usage in your orchestrator:
 * 
 * import { noApiDataFetcher } from './fetchers/no-api-sources';
 * 
 * // In your run() method:
 * const publicData = await noApiDataFetcher.fetchAllPublicSources();
 * console.log(`Fetched ${publicData.length} items without any API keys!`);
 */