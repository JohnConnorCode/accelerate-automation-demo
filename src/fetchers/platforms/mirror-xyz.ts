import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * MIRROR.XYZ FETCHER
 * Web3 native publishing platform for project announcements
 * Critical for finding detailed project updates and fundraising posts
 */

const MirrorEntrySchema = z.object({
  digest: z.string(),
  title: z.string(),
  body: z.string(),
  timestamp: z.number(),
  authorship: z.object({
    contributor: z.string(),
    signingKey: z.string(),
    signature: z.string(),
    nonce: z.number(),
  }),
  ens: z.string().nullable(),
  address: z.string(),
  publication: z.object({
    ensLabel: z.string().nullable(),
    displayName: z.string(),
    avatarURL: z.string().nullable(),
    description: z.string().nullable(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  nft: z.object({
    tokenId: z.string(),
    contractAddress: z.string(),
    chain: z.string(),
  }).optional(),
  metrics: z.object({
    views: z.number(),
    collects: z.number(),
  }).optional(),
});

export class MirrorXYZFetcher extends BaseFetcher<z.infer<typeof MirrorEntrySchema>> {
  protected config: FetcherConfig = {
    name: 'Mirror.xyz',
    url: 'https://mirror-api.com/graphql', // GraphQL endpoint
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    rateLimit: 2000,
  };

  protected schema = MirrorEntrySchema;

  async fetch(): Promise<z.infer<typeof MirrorEntrySchema>[]> {
    const results: z.infer<typeof MirrorEntrySchema>[] = [];
    
    // GraphQL queries for different content types
    const queries = [
      {
        name: 'FundingAnnouncements',
        query: `
          query GetFundingPosts {
            entries(
              filter: {
                tags_contains: ["funding", "fundraising", "seed", "announcement"]
                timestamp_gte: ${Date.now() - 30 * 24 * 60 * 60 * 1000}
              }
              orderBy: timestamp
              orderDirection: desc
              first: 50
            ) {
              digest
              title
              body
              timestamp
              authorship {
                contributor
                signingKey
              }
              address
              tags
            }
          }
        `
      },
      {
        name: 'ProjectLaunches',
        query: `
          query GetProjectLaunches {
            entries(
              filter: {
                tags_contains: ["launch", "introducing", "announcement", "web3"]
                timestamp_gte: ${Date.now() - 30 * 24 * 60 * 60 * 1000}
              }
              orderBy: timestamp
              orderDirection: desc
              first: 50
            ) {
              digest
              title
              body
              timestamp
              authorship {
                contributor
                signingKey
              }
              address
              tags
            }
          }
        `
      },
      {
        name: 'BuilderUpdates',
        query: `
          query GetBuilderUpdates {
            entries(
              filter: {
                tags_contains: ["building", "progress", "update", "devlog"]
                timestamp_gte: ${Date.now() - 14 * 24 * 60 * 60 * 1000}
              }
              orderBy: timestamp
              orderDirection: desc
              first: 30
            ) {
              digest
              title
              body
              timestamp
              authorship {
                contributor
                signingKey
              }
              address
              tags
            }
          }
        `
      }
    ];

    for (const { name, query } of queries) {
      try {
        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: this.config.headers as HeadersInit,
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data?.entries) {
            results.push(...data.data.entries);
          }
        }

        await this.delay(this.config.rateLimit || 2000);
      } catch (error) {

      }
    }

    // Also fetch by following key Web3 publications
    const publications = [
      'a16zcrypto.eth',
      'paradigm.eth',
      'electriccapital.eth',
      '1confirmation.eth',
      'variant.eth',
    ];

    for (const publication of publications) {
      try {
        const query = `
          query GetPublicationPosts {
            entriesByPublication(
              publication: "${publication}"
              first: 20
            ) {
              digest
              title
              body
              timestamp
              authorship {
                contributor
                signingKey
              }
              address
              tags
            }
          }
        `;

        const response = await fetch(this.config.url, {
          method: 'POST',
          headers: this.config.headers as HeadersInit,
          body: JSON.stringify({ query }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.data?.entriesByPublication) {
            results.push(...data.data.entriesByPublication);
          }
        }

        await this.delay(1000);
      } catch (error) {

      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof MirrorEntrySchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const entry of dataArray) {
      // Deduplicate
      if (seen.has(entry.digest)) continue;
      seen.add(entry.digest);

      // Analyze content
      const analysis = this.analyzeEntry(entry);
      if (!analysis.isRelevant) continue;

      // Extract key information from body
      const excerpt = this.extractExcerpt(entry.body);
      const projectInfo = this.extractProjectInfo(entry.body);

      const fullDescription = `${excerpt}. ` +
        `Published on Mirror.xyz by ${entry.ens || entry.address.substring(0, 8)} ` +
        `on ${new Date(entry.timestamp).toLocaleDateString()}. ` +
        `${projectInfo.funding ? `Funding mentioned: $${projectInfo.funding.toLocaleString()}. ` : ''}` +
        `${projectInfo.team_size ? `Team size: ${projectInfo.team_size}. ` : ''}` +
        `${projectInfo.stage ? `Stage: ${projectInfo.stage}. ` : ''}` +
        `${entry.tags && entry.tags.length > 0 ? `Tagged: ${entry.tags.join(', ')}. ` : ''}` +
        `${entry.metrics ? `${entry.metrics.views} views, ${entry.metrics.collects} collects. ` : ''}` +
        `This ${analysis.type} post ${analysis.confidence > 70 ? 'highly relevant' : 'potentially relevant'} for Accelerate.`;

      items.push({
        source: 'Mirror.xyz',
        type: analysis.type as 'project' | 'funding' | 'resource',
        title: entry.title,
        description: fullDescription.substring(0, 1000),
        url: `https://mirror.xyz/${entry.ens || entry.address}/${entry.digest}`,
        author: entry.ens || entry.address,
        tags: [
          ...(entry.tags || []),
          ...analysis.tags,
          'mirror-post',
          'long-form',
          analysis.type,
        ],
        metadata: {
          // Mirror specific
          mirror_digest: entry.digest,
          author_address: entry.address,
          author_ens: entry.ens,
          published_timestamp: entry.timestamp,
          
          // Extracted project info
          ...projectInfo,
          
          // Content analysis
          content_type: analysis.type,
          confidence_score: analysis.confidence,
          key_topics: analysis.topics,
          
          // Engagement
          views: entry.metrics?.views || 0,
          collects: entry.metrics?.collects || 0,
          
          // NFT info if minted
          nft_token_id: entry.nft?.tokenId,
          nft_contract: entry.nft?.contractAddress,
          nft_chain: entry.nft?.chain,
        }
      });
    }

    return items.sort((a, b) => 
      (b.metadata?.confidence_score || 0) - (a.metadata?.confidence_score || 0)
    );
  }

  private analyzeEntry(entry: any): {
    isRelevant: boolean;
    type: string;
    confidence: number;
    tags: string[];
    topics: string[];
  } {
    const text = `${entry.title} ${entry.body}`.toLowerCase();
    let confidence = 0;
    const tags: string[] = [];
    const topics: string[] = [];
    let type = 'resource';

    // Funding announcement patterns
    const fundingPatterns = [
      /raised \$\d+[km]/,
      /closing.*round/,
      /seed.*funding/,
      /series [a-c]/i,
      /announcing.*investment/,
    ];
    
    const fundingMatches = fundingPatterns.filter(pattern => pattern.test(text)).length;
    if (fundingMatches > 0) {
      confidence += fundingMatches * 20;
      type = 'funding';
      tags.push('funding-announcement');
      topics.push('fundraising');
    }

    // Project launch patterns
    const launchPatterns = [
      /introducing/,
      /launching/,
      /we.*built/,
      /excited.*announce/,
      /live.*mainnet/,
    ];
    
    const launchMatches = launchPatterns.filter(pattern => pattern.test(text)).length;
    if (launchMatches > 0) {
      confidence += launchMatches * 15;
      type = 'project';
      tags.push('project-launch');
      topics.push('announcement');
    }

    // Team building signals
    if (text.includes('hiring') || text.includes('looking for') || text.includes('join us')) {
      confidence += 15;
      tags.push('team-building');
      topics.push('hiring');
    }

    // Web3 relevance scoring
    const web3Terms = [
      'smart contract', 'blockchain', 'defi', 'dao', 'nft',
      'protocol', 'on-chain', 'web3', 'ethereum', 'solidity'
    ];
    
    const web3Score = web3Terms.filter(term => text.includes(term)).length;
    confidence += web3Score * 5;
    
    // Length and quality signals
    if (entry.body.length > 1000) confidence += 10; // Substantial content
    if (entry.body.length > 3000) confidence += 10; // Detailed post
    if (entry.tags && entry.tags.length > 2) confidence += 5;

    // Recent posts are more relevant
    const daysOld = (Date.now() - entry.timestamp) / (24 * 60 * 60 * 1000);
    if (daysOld < 7) confidence += 15;
    else if (daysOld < 14) confidence += 10;
    else if (daysOld < 30) confidence += 5;

    return {
      isRelevant: confidence > 30,
      type,
      confidence: Math.min(confidence, 100),
      tags,
      topics: [...new Set(topics)],
    };
  }

  private extractExcerpt(body: string): string {
    // Remove markdown formatting
    const cleaned = body
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1');
    
    // Get first meaningful paragraph
    const paragraphs = cleaned.split('\n\n').filter(p => p.length > 50);
    return paragraphs[0]?.substring(0, 500) || cleaned.substring(0, 500);
  }

  private extractProjectInfo(body: string): any {
    const info: any = {};
    
    // Extract funding amount
    const fundingMatch = body.match(/\$(\d+(?:\.\d+)?)\s*([KMB])/i);
    if (fundingMatch) {
      const amount = parseFloat(fundingMatch[1]);
      const multiplier = {
        'K': 1000,
        'M': 1000000,
        'B': 1000000000,
      }[fundingMatch[2].toUpperCase()] || 1;
      info.funding_raised = amount * multiplier;
    }

    // Extract team size
    const teamMatch = body.match(/team of (\d+)|(\d+)[- ]person team|(\d+) engineers?/i);
    if (teamMatch) {
      info.team_size = parseInt(teamMatch[1] || teamMatch[2] || teamMatch[3]);
    }

    // Extract stage
    if (/pre[- ]?seed/i.test(body)) info.funding_round = 'pre-seed';
    else if (/seed/i.test(body)) info.funding_round = 'seed';
    else if (/series [a]/i.test(body)) info.funding_round = 'series-a';

    // Extract website
    const urlMatch = body.match(/https?:\/\/[^\s)]+/);
    if (urlMatch) {
      info.website_url = urlMatch[0];
    }

    // Extract timeline
    const dateMatch = body.match(/founded in (\d{4})|launched in (\w+ \d{4})/i);
    if (dateMatch) {
      info.launch_date = dateMatch[0];
    }

    return info;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}