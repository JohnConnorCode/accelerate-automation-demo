import { ContentItem } from '../lib/base-fetcher';

// Resource Fetchers (existing)
import { ProductHuntFetcher } from './resources/producthunt';
import { DevToFetcher } from './resources/devto';
import { GitHubToolsFetcher } from './resources/github-tools';

// Project Fetchers (existing)
import { GitHubReposFetcher } from './projects/github-repos';

// Funding Fetchers - REAL APIs
import { DefiLlamaFetcher, CoinGeckoFetcher, MessariFetcher, CrunchbaseFetcher } from './funding/real-vc-data';

// Social Media Fetchers - REAL APIs
import { TwitterFetcher, DiscordFetcher, TelegramFetcher } from './social/twitter-x';

// Blockchain Fetchers - REAL APIs
import { EtherscanFetcher, AlchemyFetcher, DuneFetcher, TheGraphFetcher } from './blockchain/on-chain-data';

export interface FetcherResult {
  source: string;
  items: ContentItem[];
  success: boolean;
  error?: string;
}

/**
 * Master fetcher that runs all available fetchers in parallel
 * NO MOCK DATA - Only real APIs
 */
export class MasterFetcher {
  private fetchers: Array<{ name: string; instance: any }> = [];

  constructor() {
    this.initializeFetchers();
  }

  private initializeFetchers() {
    // Free APIs (no key required)
    this.fetchers.push(
      { name: 'Dev.to', instance: new DevToFetcher() },
      { name: 'DefiLlama', instance: new DefiLlamaFetcher() },
    );

    // APIs with free tiers (keys recommended)
    if (process.env.GITHUB_TOKEN) {
      this.fetchers.push(
        { name: 'GitHub Repos', instance: new GitHubReposFetcher() },
        { name: 'GitHub Tools', instance: new GitHubToolsFetcher() },
      );
    }

    if (process.env.PRODUCTHUNT_TOKEN) {
      this.fetchers.push({ name: 'ProductHunt', instance: new ProductHuntFetcher() });
    }

    if (process.env.COINGECKO_API_KEY) {
      this.fetchers.push({ name: 'CoinGecko', instance: new CoinGeckoFetcher() });
    }

    if (process.env.MESSARI_API_KEY) {
      this.fetchers.push({ name: 'Messari', instance: new MessariFetcher() });
    }

    // Premium APIs
    if (process.env.CRUNCHBASE_API_KEY) {
      this.fetchers.push({ name: 'Crunchbase', instance: new CrunchbaseFetcher() });
    }

    // Social Media APIs
    if (process.env.TWITTER_BEARER_TOKEN) {
      this.fetchers.push({ name: 'Twitter', instance: new TwitterFetcher() });
    }

    if (process.env.DISCORD_BOT_TOKEN) {
      this.fetchers.push({ name: 'Discord', instance: new DiscordFetcher() });
    }

    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.fetchers.push({ name: 'Telegram', instance: new TelegramFetcher() });
    }

    // Blockchain APIs
    if (process.env.ETHERSCAN_API_KEY) {
      this.fetchers.push({ name: 'Etherscan', instance: new EtherscanFetcher() });
    }

    if (process.env.ALCHEMY_API_KEY) {
      this.fetchers.push({ name: 'Alchemy', instance: new AlchemyFetcher() });
    }

    if (process.env.DUNE_API_KEY) {
      this.fetchers.push({ name: 'Dune', instance: new DuneFetcher() });
    }

    // The Graph (no key required for public subgraphs)
    this.fetchers.push({ name: 'TheGraph', instance: new TheGraphFetcher() });

    console.log(`[MasterFetcher] Initialized ${this.fetchers.length} fetchers`);
  }

  /**
   * Execute all fetchers in parallel
   */
  async fetchAll(): Promise<FetcherResult[]> {
    console.log(`[MasterFetcher] Starting parallel fetch from ${this.fetchers.length} sources...`);

    const promises = this.fetchers.map(async ({ name, instance }) => {
      try {
        const startTime = Date.now();
        const result = await instance.execute();
        const duration = Date.now() - startTime;

        console.log(`[${name}] Completed in ${duration}ms - ${result.fetched} items`);

        return {
          source: name,
          items: result.items || [],
          success: result.success,
          error: result.errors?.join(', '),
        };
      } catch (error) {
        console.error(`[${name}] Fatal error:`, error);
        return {
          source: name,
          items: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.allSettled(promises);

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          source: 'Unknown',
          items: [],
          success: false,
          error: result.reason,
        };
      }
    });
  }

  /**
   * Fetch from specific sources only
   */
  async fetchSources(sources: string[]): Promise<FetcherResult[]> {
    const selectedFetchers = this.fetchers.filter(f => 
      sources.includes(f.name)
    );

    if (selectedFetchers.length === 0) {
      console.warn(`[MasterFetcher] No matching fetchers found for: ${sources.join(', ')}`);
      return [];
    }

    console.log(`[MasterFetcher] Fetching from ${selectedFetchers.length} selected sources...`);

    const promises = selectedFetchers.map(async ({ name, instance }) => {
      try {
        const result = await instance.execute();
        return {
          source: name,
          items: result.items || [],
          success: result.success,
          error: result.errors?.join(', '),
        };
      } catch (error) {
        return {
          source: name,
          items: [],
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Get list of available fetchers
   */
  getAvailableFetchers(): string[] {
    return this.fetchers.map(f => f.name);
  }

  /**
   * Get statistics about fetchers
   */
  getStats(): { total: number; configured: number; missing: string[] } {
    const missing: string[] = [];

    // Check which APIs are not configured
    if (!process.env.GITHUB_TOKEN) missing.push('GitHub');
    if (!process.env.PRODUCTHUNT_TOKEN) missing.push('ProductHunt');
    if (!process.env.TWITTER_BEARER_TOKEN) missing.push('Twitter');
    if (!process.env.ETHERSCAN_API_KEY) missing.push('Etherscan');
    if (!process.env.ALCHEMY_API_KEY) missing.push('Alchemy');
    if (!process.env.DUNE_API_KEY) missing.push('Dune Analytics');
    if (!process.env.CRUNCHBASE_API_KEY) missing.push('Crunchbase');
    if (!process.env.COINGECKO_API_KEY) missing.push('CoinGecko');

    return {
      total: 18, // Total possible fetchers
      configured: this.fetchers.length,
      missing,
    };
  }
}

// Export singleton instance
export const masterFetcher = new MasterFetcher();

// Export individual fetchers for testing
export {
  ProductHuntFetcher,
  DevToFetcher,
  GitHubToolsFetcher,
  GitHubReposFetcher,
  DefiLlamaFetcher,
  CoinGeckoFetcher,
  MessariFetcher,
  CrunchbaseFetcher,
  TwitterFetcher,
  DiscordFetcher,
  TelegramFetcher,
  EtherscanFetcher,
  AlchemyFetcher,
  DuneFetcher,
  TheGraphFetcher,
};