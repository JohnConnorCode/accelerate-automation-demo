import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * DEFI LLAMA FETCHER
 * Free API for TVL data and protocol metrics
 * CRITICAL for validating project traction
 */

const DefiLlamaProtocolSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  symbol: z.string().nullable(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  chain: z.string(),
  logo: z.string().nullable(),
  audits: z.string().nullable(),
  audit_note: z.string().nullable(),
  gecko_id: z.string().nullable(),
  cmcId: z.string().nullable(),
  category: z.string(),
  chains: z.array(z.string()),
  module: z.string().optional(),
  twitter: z.string().nullable(),
  forkedFrom: z.array(z.string()).optional(),
  listedAt: z.number(),
  tvl: z.number(),
  chainTvls: z.record(z.string(), z.object({
    tvl: z.number(),
    tvlPrevDay: z.number().optional(),
    tvlPrevWeek: z.number().optional(),
    tvlPrevMonth: z.number().optional(),
  })).optional(),
  change_1h: z.number().nullable(),
  change_1d: z.number().nullable(),
  change_7d: z.number().nullable(),
  mcap: z.number().nullable(),
  fdv: z.number().nullable(),
  staking: z.number().nullable(),
  pool2: z.number().nullable(),
  raises: z.array(z.object({
    date: z.string(),
    round: z.string(),
    amount: z.number(),
    valuation: z.number().nullable(),
    investors: z.array(z.string()).optional(),
  })).optional(),
});

export class DefiLlamaFetcher extends BaseFetcher<z.infer<typeof DefiLlamaProtocolSchema>> {
  protected config: FetcherConfig = {
    name: 'DeFiLlama',
    url: 'https://api.llama.fi',
    headers: {
      'Accept': 'application/json',
    },
    rateLimit: 1000, // Free API, be respectful
  };

  protected schema = DefiLlamaProtocolSchema;

  async fetch(): Promise<z.infer<typeof DefiLlamaProtocolSchema>[]> {
    const results: z.infer<typeof DefiLlamaProtocolSchema>[] = [];
    
    try {
      // Get all protocols
      const response = await fetch(`${this.config.url}/protocols`);
      
      if (response.ok) {
        const protocols = await response.json();
        
        // Filter for early-stage protocols (launched 2024+, TVL < $10M)
        const filtered = protocols.filter((protocol: any) => {
          const launchDate = new Date(protocol.listedAt * 1000);
          const isRecent = launchDate >= new Date('2024-01-01');
          const isEarlyStage = protocol.tvl < 10000000; // $10M TVL
          const hasActivity = protocol.tvl > 0;
          
          return isRecent && isEarlyStage && hasActivity;
        });

        // Get detailed data for each protocol
        for (const protocol of filtered.slice(0, 50)) { // Limit to 50 for rate limiting
          try {
            const detailResponse = await fetch(`${this.config.url}/protocol/${protocol.slug}`);
            
            if (detailResponse.ok) {
              const detailed = await detailResponse.json();
              
              // Get raises data if available
              let raises = [];
              try {
                const raisesResponse = await fetch(`${this.config.url}/raises/${protocol.slug}`);
                if (raisesResponse.ok) {
                  const raisesData = await raisesResponse.json();
                  raises = raisesData.raises || [];
                }
              } catch (e) {
                // Raises data might not be available
              }
              
              results.push({
                ...detailed,
                raises,
              });
            }
            
            await this.delay(this.config.rateLimit || 1000);
          } catch (error) {
            console.error(`[${this.config.name}] Error fetching ${protocol.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`[${this.config.name}] Error:`, error);
    }

    // Also get recently listed protocols
    try {
      const recentResponse = await fetch(`${this.config.url}/recent`);
      
      if (recentResponse.ok) {
        const recent = await recentResponse.json();
        
        for (const protocol of recent.slice(0, 20)) {
          if (!results.find(r => r.id === protocol.id)) {
            results.push(protocol);
          }
        }
      }
    } catch (error) {
      console.error(`[${this.config.name}] Recent error:`, error);
    }

    return results;
  }

  transform(dataArray: z.infer<typeof DefiLlamaProtocolSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const protocol of dataArray) {
      // Check if it meets Accelerate criteria
      const launchDate = new Date(protocol.listedAt * 1000);
      if (launchDate < new Date('2024-01-01')) continue;
      
      // Check funding if available
      const totalRaised = protocol.raises?.reduce((sum, raise) => sum + raise.amount, 0) || 0;
      if (totalRaised > 500000) continue; // Over funding limit

      const categories = [protocol.category, ...protocol.chains].filter(Boolean);
      const projectNeeds = this.determineNeeds(protocol);

      // Calculate growth metrics
      const growthMetrics = this.calculateGrowthMetrics(protocol);

      const fullDescription = `${protocol.description || `${protocol.name} is a DeFi protocol`}. ` +
        `Launched on ${launchDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, ` +
        `the protocol has achieved $${(protocol.tvl / 1000000).toFixed(2)}M in Total Value Locked ` +
        `across ${protocol.chains.length} blockchain${protocol.chains.length > 1 ? 's' : ''}: ${protocol.chains.join(', ')}. ` +
        `${growthMetrics.growth_7d ? `7-day TVL change: ${growthMetrics.growth_7d > 0 ? '+' : ''}${growthMetrics.growth_7d.toFixed(1)}%. ` : ''}` +
        `Category: ${protocol.category}. ` +
        `${protocol.audits ? `Security: Audited (${protocol.audits}). ` : 'Security: No public audits yet. '}` +
        `${totalRaised > 0 ? `Funding: $${totalRaised.toLocaleString()} raised. ` : 'Funding: Bootstrapped or undisclosed. '}` +
        `${protocol.forkedFrom && protocol.forkedFrom.length > 0 ? `Forked from: ${protocol.forkedFrom.join(', ')}. ` : ''}` +
        `This early-stage protocol shows ${growthMetrics.momentum} and represents an opportunity for early supporters.`;

      items.push({
        source: 'DeFiLlama',
        type: 'project',
        title: protocol.name,
        description: fullDescription.substring(0, 1000),
        url: protocol.url || `https://defillama.com/protocol/${protocol.name.toLowerCase().replace(/\s/g, '-')}`,
        author: protocol.name,
        tags: [
          'defi',
          protocol.category.toLowerCase(),
          ...protocol.chains.map(c => c.toLowerCase()),
          growthMetrics.momentum,
          totalRaised === 0 ? 'bootstrapped' : 'funded',
          protocol.audits ? 'audited' : 'unaudited',
          '2024-launch',
        ],
        metadata: {
          // Required fields from ACCELERATE_FINAL_CRITERIA
          name: protocol.name,
          short_description: `${protocol.category} protocol on ${protocol.chains[0]}`,
          website_url: protocol.url,
          github_url: null, // Would need enrichment
          twitter_url: protocol.twitter ? `https://twitter.com/${protocol.twitter}` : null,
          discord_url: null,
          
          // Stage Information
          launch_date: new Date(protocol.listedAt * 1000).toISOString(),
          funding_raised: totalRaised,
          funding_round: protocol.raises?.[0]?.round || null,
          team_size: null, // Would need enrichment
          
          // Categories & Tags
          categories: categories,
          supported_chains: protocol.chains,
          project_needs: projectNeeds,
          
          // Validation
          grant_participation: [],
          incubator_participation: [],
          traction_metrics: {
            users: null, // Would need enrichment
            tvl: protocol.tvl,
            transactions: null,
            github_stars: null,
          },
          
          // Activity Tracking
          last_activity: new Date().toISOString(),
          development_status: 'active',
          
          // DeFiLlama specific metrics
          defi_llama_id: protocol.id,
          tvl_current: protocol.tvl,
          tvl_change_1d: protocol.change_1d,
          tvl_change_7d: protocol.change_7d,
          market_cap: protocol.mcap,
          fully_diluted_valuation: protocol.fdv,
          staking_tvl: protocol.staking,
          pool2_tvl: protocol.pool2,
          chain_breakdown: protocol.chainTvls,
          audits: protocol.audits,
          audit_note: protocol.audit_note,
          coingecko_id: protocol.gecko_id,
          raises: protocol.raises,
          forked_from: protocol.forkedFrom,
          
          // Growth metrics
          ...growthMetrics,
        }
      });
    }

    return items.sort((a, b) => 
      (b.metadata?.tvl_current || 0) - (a.metadata?.tvl_current || 0)
    );
  }

  private determineNeeds(protocol: any): string[] {
    const needs: string[] = [];
    
    // Low TVL suggests need for users
    if (protocol.tvl < 100000) {
      needs.push('users', 'liquidity');
    }
    
    // No audits suggests need for security
    if (!protocol.audits) {
      needs.push('audit-funding', 'security-review');
    }
    
    // Single chain suggests expansion opportunity
    if (protocol.chains.length === 1) {
      needs.push('multi-chain-expansion');
    }
    
    // No raises suggests funding need
    if (!protocol.raises || protocol.raises.length === 0) {
      needs.push('funding');
    }
    
    return needs;
  }

  private calculateGrowthMetrics(protocol: any): any {
    const metrics: any = {};
    
    // Calculate growth rate
    if (protocol.change_7d !== null) {
      metrics.growth_7d = protocol.change_7d;
      
      if (protocol.change_7d > 50) {
        metrics.momentum = 'explosive-growth';
      } else if (protocol.change_7d > 20) {
        metrics.momentum = 'strong-growth';
      } else if (protocol.change_7d > 0) {
        metrics.momentum = 'steady-growth';
      } else if (protocol.change_7d > -20) {
        metrics.momentum = 'stable';
      } else {
        metrics.momentum = 'declining';
      }
    } else {
      metrics.momentum = 'new-protocol';
    }
    
    // Calculate relative size
    if (protocol.tvl > 5000000) {
      metrics.size_category = 'emerging';
    } else if (protocol.tvl > 1000000) {
      metrics.size_category = 'early-traction';
    } else if (protocol.tvl > 100000) {
      metrics.size_category = 'seed-stage';
    } else {
      metrics.size_category = 'just-launched';
    }
    
    // Risk assessment
    const riskFactors = [];
    if (!protocol.audits) riskFactors.push('unaudited');
    if (protocol.forkedFrom && protocol.forkedFrom.length > 0) riskFactors.push('fork');
    if (protocol.chains.length === 1) riskFactors.push('single-chain');
    if (protocol.tvl < 100000) riskFactors.push('low-liquidity');
    
    metrics.risk_level = riskFactors.length >= 3 ? 'high' : 
                         riskFactors.length >= 1 ? 'medium' : 'low';
    metrics.risk_factors = riskFactors;
    
    return metrics;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}