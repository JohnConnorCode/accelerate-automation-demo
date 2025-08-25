import { BaseFetcher, ContentItem } from '../../lib/base-fetcher';
import { z } from 'zod';

/**
 * ECOSYSTEM LISTS FETCHER
 * Fetches projects from blockchain ecosystem directories and registries
 * Sources: Alchemy Dapp Store, DappRadar, State of the Dapps, Ethereum.org
 */

interface AlchemyDapp {
  id: string;
  name: string;
  description: string;
  category: string;
  website: string;
  chains: string[];
  logo?: string;
  social?: {
    twitter?: string;
    discord?: string;
    github?: string;
  };
  stats?: {
    users?: number;
    transactions?: number;
    volume?: number;
  };
}

interface DappRadarProject {
  slug: string;
  title: string;
  description: string;
  category: string;
  logo: string;
  website: string;
  chains: string[];
  balance: number;
  users: number;
  volume: number;
}

export class EcosystemListsFetcher extends BaseFetcher {
  name = 'Ecosystem Lists';
  
  protected config = {
    name: 'Ecosystem Lists',
    url: 'https://api.llama.fi/protocols', // Primary endpoint
    rateLimit: 1000,
    maxRetries: 3,
    timeout: 30000
  };
  
  protected schema = z.any(); // Will validate in transform
  
  protected endpoints = [
    {
      // Alchemy Dapp Store API (public endpoint)
      url: 'https://api.alchemy.com/dapps/v1/dapps',
      method: 'GET' as const,
      headers: {
        'Accept': 'application/json'
      }
    },
    {
      // DappRadar API (limited public access)
      url: 'https://api.dappradar.com/4tsxo4vuhotaojtl/dapps',
      method: 'GET' as const,
      headers: {
        'Accept': 'application/json'
      }
    },
    {
      // Ethereum.org ecosystem projects (GitHub data)
      url: 'https://api.github.com/repos/ethereum/ethereum-org-website/contents/src/data/wallets',
      method: 'GET' as const,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    }
  ];

  protected async fetch(): Promise<any[]> {
    const results: any[] = [];
    
    try {
      // 1. Fetch from Alchemy ecosystem
      const alchemyProjects = await this.fetchAlchemyDapps();
      if (alchemyProjects) results.push(alchemyProjects);
      
      // 2. Fetch from DappRadar
      const dappRadarProjects = await this.fetchDappRadar();
      if (dappRadarProjects) results.push(dappRadarProjects);
      
      // 3. Fetch trending projects from GitHub topics
      const githubProjects = await this.fetchGitHubEcosystemProjects();
      if (githubProjects) results.push(githubProjects);
      
      // 4. Fetch from State of the Dapps (scraping required, using alternative)
      const defillama = await this.fetchDefiLlamaProtocols();
      if (defillama) results.push(defillama);
      
    } catch (error) {
      console.error('Error fetching ecosystem lists:', error);
    }
    
    return results;
  }

  private async fetchAlchemyDapps(): Promise<any> {
    try {
      // Alchemy doesn't have a fully public API, but we can fetch featured dapps
      const response = await fetch('https://www.alchemy.com/api/dapps-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'all',
          chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
          limit: 50
        })
      });

      if (!response.ok) {
        // Fallback to scraping or alternative source
        return null;
      }

      return await response.json();
    } catch (error) {
      console.log('Alchemy API not accessible, using alternatives');
      return null;
    }
  }

  private async fetchDappRadar(): Promise<any> {
    try {
      const response = await fetch('https://api.dappradar.com/4tsxo4vuhotaojtl/dapps', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // DappRadar requires API key, use alternative
        return null;
      }

      return await response.json();
    } catch (error) {
      console.log('DappRadar API requires key, using alternatives');
      return null;
    }
  }

  private async fetchGitHubEcosystemProjects(): Promise<any> {
    try {
      // Search for Web3 projects on GitHub created in 2024
      const response = await fetch(
        'https://api.github.com/search/repositories?' + 
        'q=web3+OR+blockchain+OR+dapp+OR+defi+created:>=2024-01-01' +
        '&sort=stars&order=desc&per_page=30',
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
      console.error('GitHub ecosystem fetch failed:', error);
      return null;
    }
  }

  private async fetchDefiLlamaProtocols(): Promise<any> {
    try {
      // DeFiLlama has a public API for DeFi protocols
      const response = await fetch('https://api.llama.fi/protocols', {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) return null;

      const data = await response.json();
      
      // Filter for newer protocols (by first appearance in 2024)
      const filtered = data.filter((protocol: any) => {
        const listedAt = protocol.listedAt ? new Date(protocol.listedAt * 1000) : null;
        return listedAt && listedAt.getFullYear() >= 2024;
      }).slice(0, 30); // Get top 30

      return { protocols: filtered };
    } catch (error) {
      console.error('DeFiLlama fetch failed:', error);
      return null;
    }
  }

  protected async transform(data: any[]): Promise<ContentItem[]> {
    const items: ContentItem[] = [];
    
    for (const source of data) {
      if (!source) continue;
      
      // Transform GitHub ecosystem projects
      if (source.items) {
        source.items.forEach((repo: any) => {
          // Skip if not independent (check owner type)
          if (repo.owner?.type === 'Organization' && repo.stargazers_count > 10000) {
            return; // Likely corporate-backed
          }

          items.push({
            type: 'project',
            title: repo.name.replace(/-/g, ' ').replace(/_/g, ' '),
            url: repo.html_url,
            description: this.generateProjectDescription(repo),
            created_at: repo.created_at,
            source: 'github-ecosystem',
            tags: repo.topics || [],
            metadata: {
              name: repo.name,
              launch_date: repo.created_at,
              github_url: repo.html_url,
              stars: repo.stargazers_count,
              forks: repo.forks_count,
              language: repo.language,
              website_url: repo.homepage,
              description: repo.description,
              categories: this.inferCategories(repo),
              supported_chains: this.inferChains(repo),
              project_needs: this.inferNeeds(repo),
              last_activity: repo.pushed_at,
              development_status: 'active',
              team_size: 0, // Will be enriched later
              funding_raised: 0 // Will be enriched later
            }
          });
        });
      }
      
      // Transform DeFiLlama protocols
      if (source.protocols) {
        source.protocols.forEach((protocol: any) => {
          // Skip if TVL > $10M (likely well-funded)
          if (protocol.tvl > 10000000) return;
          
          items.push({
            type: 'project',
            title: protocol.name,
            url: protocol.url || `https://defillama.com/protocol/${protocol.slug}`,
            description: this.generateDefiDescription(protocol),
            created_at: protocol.listedAt ? new Date(protocol.listedAt * 1000).toISOString() : new Date().toISOString(),
            source: 'defillama',
            tags: protocol.category ? [protocol.category] : [],
            metadata: {
              name: protocol.name,
              launch_date: protocol.listedAt ? new Date(protocol.listedAt * 1000).toISOString() : null,
              website_url: protocol.url,
              twitter_url: protocol.twitter ? `https://twitter.com/${protocol.twitter}` : null,
              github_url: protocol.github?.[0],
              description: protocol.description,
              categories: [protocol.category, ...protocol.chains || []],
              supported_chains: protocol.chains || [],
              tvl: protocol.tvl,
              mcap: protocol.mcap,
              project_needs: ['users', 'liquidity', 'partnerships'],
              last_activity: new Date().toISOString(),
              development_status: 'launched',
              audit_urls: protocol.audits ? Object.values(protocol.audits).flat() : []
            }
          });
        });
      }
      
      // Transform Alchemy dapps (if available)
      if (source.dapps) {
        source.dapps.forEach((dapp: AlchemyDapp) => {
          items.push({
            type: 'project',
            title: dapp.name,
            url: dapp.website,
            description: dapp.description || 'No description available',
            created_at: new Date().toISOString(),
            source: 'alchemy-dapps',
            tags: [dapp.category],
            metadata: {
              name: dapp.name,
              website_url: dapp.website,
              categories: [dapp.category],
              supported_chains: dapp.chains,
              twitter_url: dapp.social?.twitter,
              discord_url: dapp.social?.discord,
              github_url: dapp.social?.github,
              users: dapp.stats?.users,
              volume: dapp.stats?.volume,
              project_needs: ['users', 'partnerships'],
              development_status: 'launched'
            }
          });
        });
      }
    }
    
    // Filter and deduplicate
    const uniqueItems = this.deduplicateByUrl(items);
    const filtered = uniqueItems.filter(item => this.meetsAccelerateCriteria(item));
    
    console.log(`✅ EcosystemLists: Found ${filtered.length} projects from ecosystem sources`);
    return filtered;
  }

  private generateProjectDescription(repo: any): string {
    const parts = [];
    
    if (repo.description) {
      parts.push(repo.description);
    }
    
    parts.push(`This ${repo.language || 'Web3'} project was created in ${new Date(repo.created_at).getFullYear()}.`);
    
    if (repo.stargazers_count > 0) {
      parts.push(`It has gained ${repo.stargazers_count} stars on GitHub, showing community interest.`);
    }
    
    if (repo.topics && repo.topics.length > 0) {
      parts.push(`The project focuses on: ${repo.topics.slice(0, 5).join(', ')}.`);
    }
    
    parts.push('As an early-stage project, it represents an opportunity for early supporters and contributors.');
    
    if (repo.open_issues_count > 0) {
      parts.push(`The team is actively developing with ${repo.open_issues_count} open issues being worked on.`);
    }
    
    return parts.join(' ');
  }

  private generateDefiDescription(protocol: any): string {
    const parts = [];
    
    if (protocol.description) {
      parts.push(protocol.description);
    }
    
    parts.push(`${protocol.name} is a ${protocol.category || 'DeFi'} protocol operating on ${(protocol.chains || ['multiple chains']).join(', ')}.`);
    
    if (protocol.tvl) {
      parts.push(`Current Total Value Locked (TVL): $${Math.round(protocol.tvl).toLocaleString()}.`);
    }
    
    if (protocol.listedAt) {
      const monthsOld = (Date.now() - protocol.listedAt * 1000) / (30 * 24 * 60 * 60 * 1000);
      parts.push(`The protocol has been live for ${Math.round(monthsOld)} months.`);
    }
    
    parts.push('The team is looking for users, liquidity providers, and strategic partnerships to grow the protocol.');
    
    if (protocol.audits) {
      parts.push('The protocol has undergone security audits.');
    }
    
    return parts.join(' ');
  }

  private inferCategories(repo: any): string[] {
    const categories = [];
    const desc = (repo.description || '').toLowerCase();
    const topics = repo.topics || [];
    
    if (desc.includes('defi') || topics.includes('defi')) categories.push('DeFi');
    if (desc.includes('nft') || topics.includes('nft')) categories.push('NFT');
    if (desc.includes('dao') || topics.includes('dao')) categories.push('DAO');
    if (desc.includes('game') || topics.includes('gaming')) categories.push('Gaming');
    if (desc.includes('infrastructure') || repo.language === 'Rust') categories.push('Infrastructure');
    if (desc.includes('ai') || desc.includes('machine learning')) categories.push('AI');
    
    return categories.length > 0 ? categories : ['Web3'];
  }

  private inferChains(repo: any): string[] {
    const chains = [];
    const text = `${repo.description} ${repo.topics?.join(' ')}`.toLowerCase();
    
    if (text.includes('ethereum') || text.includes('eth')) chains.push('Ethereum');
    if (text.includes('polygon') || text.includes('matic')) chains.push('Polygon');
    if (text.includes('arbitrum')) chains.push('Arbitrum');
    if (text.includes('optimism')) chains.push('Optimism');
    if (text.includes('base')) chains.push('Base');
    if (text.includes('solana')) chains.push('Solana');
    if (text.includes('avalanche') || text.includes('avax')) chains.push('Avalanche');
    
    return chains.length > 0 ? chains : ['Ethereum'];
  }

  private inferNeeds(repo: any): string[] {
    const needs = [];
    
    if (repo.open_issues_count > 10) needs.push('developers');
    if (repo.stargazers_count < 100) needs.push('community');
    if (!repo.homepage) needs.push('marketing');
    needs.push('funding'); // Most early projects need funding
    
    return needs;
  }

  private meetsAccelerateCriteria(item: ContentItem): boolean {
    // Must be from 2024 or later
    const createdYear = new Date(item.created_at).getFullYear();
    if (createdYear < 2024) return false;
    
    // Skip if appears to be well-funded (high TVL, many stars)
    if (item.metadata?.tvl && item.metadata.tvl > 10000000) return false;
    if (item.metadata?.stars && item.metadata.stars > 10000) return false;
    
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