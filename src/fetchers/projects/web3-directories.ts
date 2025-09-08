import { BaseFetcher, ContentItem } from '../../lib/base-fetcher';
import { z } from 'zod';

/**
 * WEB3 DIRECTORIES FETCHER
 * Fetches projects from Web3 directories and aggregator platforms
 * Sources: CryptoRank, CoinMarketCap, CoinGecko, Web3Index
 */

export class Web3DirectoriesFetcher extends BaseFetcher<any> {
  name = 'Web3 Directories';
  
  protected config = {
    name: 'Web3 Directories',
    url: 'https://api.coingecko.com/api/v3/search/trending', // Primary endpoint
    rateLimit: 1000,
    maxRetries: 3,
    timeout: 30000
  };
  
  protected schema = z.any(); // Will validate in transform
  
  protected endpoints = [
    {
      // CoinGecko trending projects
      url: 'https://api.coingecko.com/api/v3/search/trending',
      method: 'GET' as const,
      headers: {
        'Accept': 'application/json'
      }
    },
    {
      // Web3Index - tracks Web3 infrastructure projects
      url: 'https://api.web3index.org/protocols',
      method: 'GET' as const,
      headers: {
        'Accept': 'application/json'
      }
    }
  ];

  protected async fetch(): Promise<any[]> {
    const results: any[] = [];
    
    try {
      // 1. Fetch from CoinGecko
      const coinGeckoData = await this.fetchCoinGecko();
      if (coinGeckoData) results.push(coinGeckoData);
      
      // 2. Fetch from Web3Index
      const web3IndexData = await this.fetchWeb3Index();
      if (web3IndexData) results.push(web3IndexData);
      
      // 3. Fetch from CryptoRank new projects
      const cryptoRankData = await this.fetchCryptoRank();
      if (cryptoRankData) results.push(cryptoRankData);
      
      // 4. Fetch from Messari (public endpoints)
      const messariData = await this.fetchMessari();
      if (messariData) results.push(messariData);
      
    } catch (error) {
      console.error('Error fetching Web3 directories:', error);
    }
    
    return results;
  }

  private async fetchCoinGecko(): Promise<any> {
    try {
      // Get trending coins and new listings
      const [trending, newListings] = await Promise.all([
        fetch('https://api.coingecko.com/api/v3/search/trending', {
          headers: { 'Accept': 'application/json' }
        }),
        fetch('https://api.coingecko.com/api/v3/coins/list?include_platform=true', {
          headers: { 'Accept': 'application/json' }
        })
      ]);

      if (!trending.ok || !newListings.ok) return null;

      const trendingData = await trending.json();
      const listingsData = await newListings.json();
      
      // Filter for recent additions (by checking if in trending but low market cap)
      return {
        trending: trendingData.coins || [],
        new_listings: listingsData.slice(0, 50) // Get latest additions
      };
    } catch (error) {
      console.error('CoinGecko fetch failed:', error);
      return null;
    }
  }

  private async fetchWeb3Index(): Promise<any> {
    try {
      const response = await fetch('https://api.web3index.org/protocols', {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        // Fallback: use GitHub search for Web3 infrastructure
        return this.fetchGitHubWeb3Projects();
      }

      return await response.json();
    } catch (error) {
      console.log('Web3Index not available, using GitHub fallback');
      return this.fetchGitHubWeb3Projects();
    }
  }

  private async fetchGitHubWeb3Projects(): Promise<any> {
    try {
      const response = await fetch(
        'https://api.github.com/search/repositories?' +
        'q=web3+infrastructure+created:>=2024-01-01+stars:10..1000' +
        '&sort=updated&order=desc&per_page=30',
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            ...(process.env.GITHUB_TOKEN && {
              'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
            })
          }
        }
      );

      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('GitHub Web3 search failed:', error);
      return null;
    }
  }

  private async fetchCryptoRank(): Promise<any> {
    try {
      // CryptoRank has public endpoints for new projects
      const response = await fetch('https://api.cryptorank.io/v1/currencies?limit=50', {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        // Alternative: fetch from CoinPaprika
        return this.fetchCoinPaprika();
      }

      const data = await response.json();
      return { cryptorank_projects: data.data || [] };
    } catch (error) {
      console.log('CryptoRank not available, trying alternatives');
      return this.fetchCoinPaprika();
    }
  }

  private async fetchCoinPaprika(): Promise<any> {
    try {
      const response = await fetch('https://api.coinpaprika.com/v1/coins', {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      // Filter for newer coins (by checking if rank is high/unranked)
      const newProjects = data.filter((coin: any) => 
        !coin.rank || coin.rank > 1000
      ).slice(0, 50);

      return { coinpaprika_projects: newProjects };
    } catch (error) {
      console.error('CoinPaprika fetch failed:', error);
      return null;
    }
  }

  private async fetchMessari(): Promise<any> {
    try {
      // Messari has some public endpoints
      const response = await fetch('https://data.messari.io/api/v2/assets?limit=50', {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return { messari_assets: data.data || [] };
    } catch (error) {
      console.log('Messari API not accessible');
      return null;
    }
  }

  protected async transform(data: any[]): Promise<ContentItem[]> {
    const items: ContentItem[] = [];
    
    for (const source of data) {
      if (!source) continue;
      
      // Transform CoinGecko trending
      if (source.trending) {
        source.trending.forEach((item: any) => {
          const coin = item.item;
          if (!coin) return;
          
          // Skip if market cap rank < 500 (too established)
          if (coin.market_cap_rank && coin.market_cap_rank < 500) return;
          
          items.push({
            type: 'project',
            title: coin.name,
            url: `https://www.coingecko.com/en/coins/${coin.id}`,
            description: this.generateCoinDescription(coin),
            created_at: new Date().toISOString(),
            source: 'coingecko-trending',
            tags: ['cryptocurrency', 'trending'],
            metadata: {
              name: coin.name,
              symbol: coin.symbol,
              coingecko_id: coin.id,
              market_cap_rank: coin.market_cap_rank,
              price_btc: coin.price_btc,
              trending_score: coin.score,
              categories: ['Cryptocurrency'],
              project_needs: ['liquidity', 'community', 'partnerships'],
              development_status: 'launched'
            }
          });
        });
      }
      
      // Transform GitHub Web3 projects
      if (source.items) {
        source.items.forEach((repo: any) => {
          // Skip large organizations
          if (repo.owner?.type === 'Organization' && repo.stargazers_count > 5000) return;
          
          items.push({
            type: 'project',
            title: repo.name.replace(/-/g, ' ').replace(/_/g, ' '),
            url: repo.html_url,
            description: this.generateGitHubDescription(repo),
            created_at: repo.created_at,
            source: 'github-web3',
            tags: repo.topics || [],
            metadata: {
              name: repo.name,
              launch_date: repo.created_at,
              github_url: repo.html_url,
              website_url: repo.homepage,
              stars: repo.stargazers_count,
              language: repo.language,
              categories: this.inferCategories(repo),
              supported_chains: this.inferChains(repo),
              project_needs: ['funding', 'developers', 'community'],
              last_activity: repo.pushed_at,
              development_status: 'active',
              team_size: 0, // Will be enriched
              funding_raised: 0 // Will be enriched
            }
          });
        });
      }
      
      // Transform CoinPaprika projects
      if (source.coinpaprika_projects) {
        source.coinpaprika_projects.forEach((coin: any) => {
          // Skip if too old
          if (coin.first_data_at && new Date(coin.first_data_at) < new Date('2024-01-01')) return;
          
          items.push({
            type: 'project',
            title: coin.name,
            url: `https://coinpaprika.com/coin/${coin.id}/`,
            description: `${coin.name} (${coin.symbol}) is a ${coin.type || 'cryptocurrency'} project. ${coin.is_new ? 'This is a newly listed project.' : ''} The project is ${coin.is_active ? 'actively' : 'currently not'} trading.`,
            created_at: coin.first_data_at || new Date().toISOString(),
            source: 'coinpaprika',
            tags: [coin.type || 'cryptocurrency'],
            metadata: {
              name: coin.name,
              symbol: coin.symbol,
              launch_date: coin.first_data_at,
              is_new: coin.is_new,
              is_active: coin.is_active,
              categories: [coin.type || 'Cryptocurrency'],
              project_needs: ['exchange_listings', 'community', 'liquidity'],
              development_status: coin.is_active ? 'active' : 'inactive'
            }
          });
        });
      }
      
      // Transform Messari assets
      if (source.messari_assets) {
        source.messari_assets.forEach((asset: any) => {
          const metrics = asset.metrics?.marketcap;
          
          // Skip if market cap > $10M
          if (metrics?.current_marketcap_usd > 10000000) return;
          
          items.push({
            type: 'project',
            title: asset.name,
            url: asset.profile?.general?.overview?.project_details?.official_links?.[0]?.link || `https://messari.io/asset/${asset.slug}`,
            description: asset.profile?.general?.overview?.project_details?.description || `${asset.name} is a cryptocurrency project in the Web3 ecosystem.`,
            created_at: asset.profile?.general?.overview?.project_details?.genesis_date || new Date().toISOString(),
            source: 'messari',
            tags: asset.profile?.general?.overview?.tags || [],
            metadata: {
              name: asset.name,
              symbol: asset.symbol,
              sector: asset.profile?.general?.overview?.sector,
              categories: asset.profile?.general?.overview?.tags || [],
              market_cap: metrics?.current_marketcap_usd,
              project_needs: ['funding', 'adoption', 'partnerships'],
              development_status: 'active'
            }
          });
        });
      }
      
      // Transform Web3Index protocols
      if (source.protocols) {
        source.protocols.forEach((protocol: any) => {
          items.push({
            type: 'project',
            title: protocol.name,
            url: protocol.website || `https://web3index.org/protocol/${protocol.slug}`,
            description: `${protocol.name} is a Web3 infrastructure protocol. ${protocol.description || ''} The protocol generates fees through its network usage.`,
            created_at: protocol.launch_date || new Date().toISOString(),
            source: 'web3index',
            tags: ['infrastructure', 'web3'],
            metadata: {
              name: protocol.name,
              launch_date: protocol.launch_date,
              website_url: protocol.website,
              github_url: protocol.github,
              twitter_url: protocol.twitter,
              categories: ['Infrastructure', protocol.category].filter(Boolean),
              revenue_30d: protocol.revenue_30d,
              fees_30d: protocol.fees_30d,
              project_needs: ['developers', 'integrations', 'adoption'],
              development_status: 'active'
            }
          });
        });
      }
    }
    
    // Filter and deduplicate
    const uniqueItems = this.deduplicateByUrl(items);
    const filtered = uniqueItems.filter(item => this.meetsAccelerateCriteria(item));
    
    console.log(`✅ Web3Directories: Found ${filtered.length} projects from directory sources`);
    return filtered;
  }

  private generateCoinDescription(coin: any): string {
    const parts = [];
    
    parts.push(`${coin.name} (${coin.symbol}) is a trending cryptocurrency project.`);
    
    if (coin.market_cap_rank) {
      parts.push(`Currently ranked #${coin.market_cap_rank} by market cap.`);
    }
    
    parts.push(`The project has been gaining attention in the crypto community with a trending score of ${coin.score || 0}.`);
    
    parts.push('As an emerging project, it presents opportunities for early supporters and liquidity providers.');
    
    return parts.join(' ');
  }

  private generateGitHubDescription(repo: any): string {
    const parts = [];
    
    if (repo.description) {
      parts.push(repo.description);
    }
    
    parts.push(`This Web3 infrastructure project is built with ${repo.language || 'various technologies'}.`);
    
    if (repo.stargazers_count > 0) {
      parts.push(`It has ${repo.stargazers_count} stars on GitHub.`);
    }
    
    const monthsOld = (Date.now() - new Date(repo.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsOld < 12) {
      parts.push(`The project is ${Math.round(monthsOld)} months old, making it an early-stage opportunity.`);
    }
    
    parts.push('The team is seeking developers, funding, and strategic partnerships.');
    
    return parts.join(' ');
  }

  private inferCategories(repo: any): string[] {
    const categories = [];
    const text = `${repo.description} ${repo.topics?.join(' ')}`.toLowerCase();
    
    if (text.includes('defi')) categories.push('DeFi');
    if (text.includes('infrastructure')) categories.push('Infrastructure');
    if (text.includes('oracle')) categories.push('Oracle');
    if (text.includes('bridge')) categories.push('Bridge');
    if (text.includes('wallet')) categories.push('Wallet');
    if (text.includes('sdk') || text.includes('framework')) categories.push('Developer Tools');
    if (text.includes('privacy') || text.includes('zero-knowledge')) categories.push('Privacy');
    
    return categories.length > 0 ? categories : ['Web3'];
  }

  private inferChains(repo: any): string[] {
    const chains = [];
    const text = `${repo.description} ${repo.topics?.join(' ')}`.toLowerCase();
    
    if (text.includes('ethereum')) chains.push('Ethereum');
    if (text.includes('polygon')) chains.push('Polygon');
    if (text.includes('arbitrum')) chains.push('Arbitrum');
    if (text.includes('optimism')) chains.push('Optimism');
    if (text.includes('multichain') || text.includes('cross-chain')) chains.push('Multichain');
    
    return chains.length > 0 ? chains : ['Ethereum'];
  }

  private meetsAccelerateCriteria(item: ContentItem): boolean {
    // Check if recent enough
    if (item.created_at) {
      const createdDate = new Date(item.created_at);
      if (createdDate < new Date('2024-01-01')) return false;
    }
    
    // Check funding level (skip if too high)
    if (item.metadata?.market_cap && item.metadata.market_cap > 10000000) return false;
    if (item.metadata?.market_cap_rank && item.metadata.market_cap_rank < 500) return false;
    
    return true;
  }

  private deduplicateByUrl(items: ContentItem[]): ContentItem[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = item.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}