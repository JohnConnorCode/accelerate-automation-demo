import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

// Real VC/Funding Data Sources

// 1. Crunchbase API (requires paid key)
const CrunchbaseSchema = z.object({
  data: z.object({
    items: z.array(z.object({
      uuid: z.string(),
      name: z.string(),
      short_description: z.string().optional(),
      funding_total: z.object({
        value_usd: z.number(),
        currency: z.string(),
      }).optional(),
      last_funding_at: z.string().optional(),
      categories: z.array(z.string()).optional(),
      website_url: z.string().optional(),
    }))
  })
});

export class CrunchbaseFetcher extends BaseFetcher<z.infer<typeof CrunchbaseSchema>> {
  protected config: FetcherConfig = {
    name: 'Crunchbase',
    url: 'https://api.crunchbase.com/v4/searches/funding_rounds',
    headers: {
      'X-cb-user-key': process.env.CRUNCHBASE_API_KEY || '',
    },
    rateLimit: 1000,
  };

  protected schema = CrunchbaseSchema;

  async fetch(): Promise<z.infer<typeof CrunchbaseSchema>[]> {
    if (!process.env.CRUNCHBASE_API_KEY) {
      console.warn('[Crunchbase] No API key provided');
      return [];
    }

    const body = {
      field_ids: ['name', 'short_description', 'funding_total', 'last_funding_at', 'categories', 'website_url'],
      query: [
        {
          type: 'predicate',
          field_id: 'categories',
          operator_id: 'includes',
          values: ['Blockchain', 'Cryptocurrency', 'Web3']
        },
        {
          type: 'predicate', 
          field_id: 'last_funding_at',
          operator_id: 'gte',
          values: [new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()]
        }
      ],
      limit: 50
    };

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          ...this.config.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Crunchbase API error: ${response.statusText}`);
      }

      const data = await response.json();
      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof CrunchbaseSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const item of data.data.items) {
        items.push({
          source: 'Crunchbase',
          type: 'funding',
          title: `${item.name} - Funding Update`,
          description: item.short_description || 'New funding round',
          url: item.website_url || `https://www.crunchbase.com/organization/${item.uuid}`,
          author: 'Crunchbase',
          tags: [...(item.categories || []), 'funding', 'venture'],
          metadata: {
            uuid: item.uuid,
            funding_total_usd: item.funding_total?.value_usd,
            last_funding_date: item.last_funding_at,
          }
        });
      }
    }
    
    return items;
  }
}

// 2. DeFiLlama Raises API (FREE - no key needed!)
const DefiLlamaSchema = z.object({
  raises: z.array(z.object({
    id: z.string(),
    name: z.string(),
    date: z.number(), // Unix timestamp
    amount: z.number().optional(),
    round: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    source: z.string().optional(),
    leadInvestors: z.array(z.string()).optional(),
    otherInvestors: z.array(z.string()).optional(),
    valuation: z.number().optional(),
  }))
});

export class DefiLlamaFetcher extends BaseFetcher<z.infer<typeof DefiLlamaSchema>> {
  protected config: FetcherConfig = {
    name: 'DefiLlama',
    url: 'https://api.llama.fi/raises',
    headers: {},
    rateLimit: 500,
  };

  protected schema = DefiLlamaSchema;

  async fetch(): Promise<z.infer<typeof DefiLlamaSchema>[]> {
    try {
      const response = await fetch(this.config.url);
      if (!response.ok) {
        throw new Error(`DefiLlama API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Filter for recent raises (last 30 days)
      const thirtyDaysAgo = Date.now() / 1000 - (30 * 24 * 60 * 60);
      data.raises = data.raises.filter((r: any) => r.date > thirtyDaysAgo);
      
      return [data];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof DefiLlamaSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const raise of data.raises) {
        const fundingAmount = raise.amount ? `$${(raise.amount / 1000000).toFixed(1)}M` : 'Undisclosed';
        
        items.push({
          source: 'DefiLlama',
          type: 'funding',
          title: `${raise.name} Raises ${fundingAmount}`,
          description: raise.description || `${raise.name} announced ${raise.round || 'funding'} round`,
          url: raise.source || `https://defillama.com/raises`,
          author: 'DefiLlama',
          tags: [raise.category || 'defi', raise.round || 'funding', 'crypto'].filter(Boolean),
          metadata: {
            raise_id: raise.id,
            amount: raise.amount,
            round: raise.round,
            date: new Date(raise.date * 1000).toISOString(),
            lead_investors: raise.leadInvestors,
            other_investors: raise.otherInvestors,
            valuation: raise.valuation,
          }
        });
      }
    }
    
    return items;
  }
}

// 3. CoinGecko Trending & New Coins (FREE tier available)
const CoinGeckoSchema = z.object({
  coins: z.array(z.object({
    id: z.string(),
    symbol: z.string(),
    name: z.string(),
    market_cap_rank: z.number().nullable(),
    market_cap: z.number().optional(),
    platforms: z.record(z.string()).optional(),
    description: z.object({
      en: z.string().optional(),
    }).optional(),
  }))
});

export class CoinGeckoFetcher extends BaseFetcher<z.infer<typeof CoinGeckoSchema>> {
  protected config: FetcherConfig = {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3',
    headers: {
      'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
    },
    rateLimit: 2000, // Free tier: 30 calls/minute
  };

  protected schema = CoinGeckoSchema;

  async fetch(): Promise<z.infer<typeof CoinGeckoSchema>[]> {
    try {
      // Fetch trending coins
      const trendingResponse = await fetch(`${this.config.url}/search/trending`, {
        headers: this.config.headers as HeadersInit,
      });
      
      if (!trendingResponse.ok) {
        throw new Error(`CoinGecko API error: ${trendingResponse.statusText}`);
      }
      
      const trending = await trendingResponse.json();
      
      // Extract coin IDs from trending
      const coinIds = trending.coins.slice(0, 10).map((c: any) => c.item.id).join(',');
      
      // Get detailed info for trending coins
      const detailsResponse = await fetch(
        `${this.config.url}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc`,
        { headers: this.config.headers as HeadersInit }
      );
      
      const details = await detailsResponse.json();
      
      return [{ coins: details }];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof CoinGeckoSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const coin of data.coins) {
        items.push({
          source: 'CoinGecko',
          type: 'project',
          title: `${coin.name} (${coin.symbol.toUpperCase()})`,
          description: `Trending crypto project - Rank #${coin.market_cap_rank || 'New'}`,
          url: `https://www.coingecko.com/en/coins/${coin.id}`,
          author: 'CoinGecko',
          tags: ['cryptocurrency', 'trending', coin.symbol],
          metadata: {
            coin_id: coin.id,
            symbol: coin.symbol,
            market_cap_rank: coin.market_cap_rank,
            market_cap: coin.market_cap,
            platforms: coin.platforms,
          }
        });
      }
    }
    
    return items;
  }
}

// 4. Messari API (Real crypto data)
const MessariSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    slug: z.string(),
    symbol: z.string(),
    name: z.string(),
    metrics: z.object({
      market_data: z.object({
        price_usd: z.number().optional(),
        volume_last_24_hours: z.number().optional(),
        market_cap: z.number().optional(),
      }).optional(),
    }).optional(),
    profile: z.object({
      general: z.object({
        overview: z.object({
          tagline: z.string().optional(),
          project_details: z.string().optional(),
        }).optional(),
      }).optional(),
    }).optional(),
  }))
});

export class MessariFetcher extends BaseFetcher<z.infer<typeof MessariSchema>> {
  protected config: FetcherConfig = {
    name: 'Messari',
    url: 'https://data.messari.io/api/v2/assets',
    headers: {
      'x-messari-api-key': process.env.MESSARI_API_KEY || '',
    },
    rateLimit: 1000,
  };

  protected schema = MessariSchema;

  async fetch(): Promise<z.infer<typeof MessariSchema>[]> {
    try {
      const params = new URLSearchParams({
        limit: '20',
        fields: 'id,slug,symbol,name,metrics/market_data,profile/general',
      });

      const response = await fetch(`${this.config.url}?${params}`, {
        headers: this.config.headers as HeadersInit,
      });

      if (!response.ok) {
        throw new Error(`Messari API error: ${response.statusText}`);
      }

      const result = await response.json();
      return [result];
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
      return [];
    }
  }

  transform(dataArray: z.infer<typeof MessariSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const data of dataArray) {
      for (const asset of data.data) {
        items.push({
          source: 'Messari',
          type: 'project',
          title: `${asset.name} (${asset.symbol})`,
          description: asset.profile?.general?.overview?.tagline || 
                      asset.profile?.general?.overview?.project_details?.substring(0, 200) || 
                      'Cryptocurrency project',
          url: `https://messari.io/asset/${asset.slug}`,
          author: 'Messari',
          tags: ['cryptocurrency', asset.symbol.toLowerCase(), 'market-data'],
          metadata: {
            asset_id: asset.id,
            symbol: asset.symbol,
            price_usd: asset.metrics?.market_data?.price_usd,
            volume_24h: asset.metrics?.market_data?.volume_last_24_hours,
            market_cap: asset.metrics?.market_data?.market_cap,
          }
        });
      }
    }
    
    return items;
  }
}