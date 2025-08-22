import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * FARCASTER PROTOCOL FETCHER
 * Web3-native social platform where builders actually hang out
 * Critical for real-time project announcements and team signals
 */

const FarcasterCastSchema = z.object({
  hash: z.string(),
  thread_hash: z.string().nullable(),
  parent_hash: z.string().nullable(),
  author: z.object({
    fid: z.number(),
    username: z.string(),
    display_name: z.string(),
    pfp_url: z.string().nullable(),
    bio: z.object({
      text: z.string(),
      mentions: z.array(z.string()),
    }).optional(),
    follower_count: z.number(),
    following_count: z.number(),
    verified: z.boolean().optional(),
  }),
  text: z.string(),
  timestamp: z.string(),
  embeds: z.array(z.object({
    url: z.string(),
    type: z.string(),
  })).optional(),
  reactions: z.object({
    likes: z.number(),
    recasts: z.number(),
    replies: z.number(),
  }),
  mentions: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
});

export class FarcasterFetcher extends BaseFetcher<z.infer<typeof FarcasterCastSchema>> {
  protected config: FetcherConfig = {
    name: 'Farcaster',
    url: 'https://api.neynar.com/v2/farcaster/casts', // Using Neynar API
    headers: {
      'Accept': 'application/json',
      'api_key': process.env.NEYNAR_API_KEY || '',
    },
    rateLimit: 2000,
  };

  protected schema = FarcasterCastSchema;

  async fetch(): Promise<z.infer<typeof FarcasterCastSchema>[]> {
    const results: z.infer<typeof FarcasterCastSchema>[] = [];
    
    // Search for project announcements and funding posts
    const searches = [
      'launching AND (web3 OR crypto OR blockchain)',
      'seeking funding AND (seed OR preseed)',
      'looking for co-founder',
      'hiring AND (engineer OR developer) AND web3',
      'just shipped AND (dapp OR protocol)',
      'grant AND (received OR announcing)',
      'building in public',
      'demo day',
    ];

    // Key channels to monitor
    const channels = [
      '/ethereum',
      '/defi',
      '/founders',
      '/startups',
      '/web3',
      '/building',
      '/grants',
    ];

    for (const query of searches) {
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '50',
          time_window: '7d', // Last 7 days
        });

        const response = await fetch(`${this.config.url}/search?${params}`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.casts) {
            results.push(...data.casts);
          }
        }

        await this.delay(this.config.rateLimit || 2000);
      } catch (error) {

      }
    }

    // Also fetch from specific channels
    for (const channel of channels) {
      try {
        const response = await fetch(`${this.config.url}/channel/${channel}?limit=20`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.casts) {
            results.push(...data.casts);
          }
        }

        await this.delay(1000);
      } catch (error) {

      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof FarcasterCastSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const cast of dataArray) {
      // Deduplicate
      if (seen.has(cast.hash)) continue;
      seen.add(cast.hash);

      // Analyze cast for project/funding signals
      const analysis = this.analyzeCast(cast);
      if (!analysis.isRelevant) continue;

      const fullDescription = `${cast.text}. ` +
        `Posted by ${cast.author.display_name} (@${cast.author.username}) ` +
        `who has ${cast.author.follower_count.toLocaleString()} followers on Farcaster. ` +
        `${analysis.type === 'project' ? 'This appears to be a project announcement. ' : ''}` +
        `${analysis.type === 'funding' ? 'This is a funding-related announcement. ' : ''}` +
        `The post has received ${cast.reactions.likes} likes, ${cast.reactions.recasts} recasts, and ${cast.reactions.replies} replies. ` +
        `${cast.embeds && cast.embeds.length > 0 ? `Includes links to: ${cast.embeds.map(e => e.url).join(', ')}. ` : ''}` +
        `Posted in channels: ${cast.channels?.join(', ') || 'main feed'}.`;

      items.push({
        source: 'Farcaster',
        type: analysis.type as 'project' | 'funding' | 'resource',
        title: this.extractTitle(cast),
        description: fullDescription.substring(0, 1000),
        url: `https://warpcast.com/${cast.author.username}/${cast.hash.substring(0, 10)}`,
        author: cast.author.display_name,
        tags: [
          ...analysis.tags,
          'farcaster',
          'social-signal',
          cast.author.follower_count > 1000 ? 'influential' : 'emerging',
          ...(cast.channels || []),
        ],
        metadata: {
          // Social metrics
          farcaster_hash: cast.hash,
          author_fid: cast.author.fid,
          author_username: cast.author.username,
          author_followers: cast.author.follower_count,
          author_verified: cast.author.verified || false,
          
          // Engagement metrics
          likes: cast.reactions.likes,
          recasts: cast.reactions.recasts,
          replies: cast.reactions.replies,
          engagement_rate: this.calculateEngagementRate(cast),
          
          // Content analysis
          content_type: analysis.type,
          confidence_score: analysis.confidence,
          extracted_urls: cast.embeds?.map(e => e.url) || [],
          mentions: cast.mentions || [],
          channels: cast.channels || [],
          
          // Timing
          posted_at: cast.timestamp,
          
          // Project details (if detected)
          ...(analysis.projectDetails || {}),
        }
      });
    }

    return items.sort((a, b) => 
      (b.metadata?.engagement_rate || 0) - (a.metadata?.engagement_rate || 0)
    );
  }

  private analyzeCast(cast: any): {
    isRelevant: boolean;
    type: string;
    confidence: number;
    tags: string[];
    projectDetails?: any;
  } {
    const text = cast.text.toLowerCase();
    let confidence = 0;
    const tags: string[] = [];
    let type = 'resource';
    const projectDetails: any = {};

    // Project announcement signals
    if (text.includes('launching') || text.includes('just shipped') || text.includes('introducing')) {
      confidence += 30;
      type = 'project';
      tags.push('launch-announcement');
    }

    // Funding signals
    if (text.includes('raised') || text.includes('funding') || text.includes('seed') || text.includes('grant')) {
      confidence += 30;
      type = 'funding';
      tags.push('funding-announcement');
    }

    // Team signals
    if (text.includes('hiring') || text.includes('looking for') || text.includes('co-founder')) {
      confidence += 20;
      tags.push('team-building');
      projectDetails.seeking_team = true;
    }

    // Web3 relevance
    const web3Terms = ['web3', 'blockchain', 'defi', 'nft', 'dao', 'protocol', 'smart contract', 'dapp'];
    const web3Count = web3Terms.filter(term => text.includes(term)).length;
    confidence += web3Count * 10;

    // Author credibility
    if (cast.author.follower_count > 5000) confidence += 20;
    if (cast.author.follower_count > 1000) confidence += 10;
    if (cast.author.verified) confidence += 15;

    // Engagement signals
    if (cast.reactions.likes > 50) confidence += 10;
    if (cast.reactions.recasts > 10) confidence += 10;

    // Extract funding amount if mentioned
    const fundingMatch = text.match(/\$(\d+)([km])/i);
    if (fundingMatch) {
      const amount = parseInt(fundingMatch[1]);
      const multiplier = fundingMatch[2].toLowerCase() === 'k' ? 1000 : 1000000;
      projectDetails.funding_mentioned = amount * multiplier;
    }

    return {
      isRelevant: confidence > 40,
      type,
      confidence: Math.min(confidence, 100),
      tags,
      projectDetails: Object.keys(projectDetails).length > 0 ? projectDetails : undefined,
    };
  }

  private extractTitle(cast: any): string {
    const text = cast.text;
    
    // Try to extract first sentence or key announcement
    const sentences = text.split(/[.!?]/);
    if (sentences[0] && sentences[0].length < 100) {
      return sentences[0].trim();
    }
    
    // Or use first 80 characters
    return text.substring(0, 80) + (text.length > 80 ? '...' : '');
  }

  private calculateEngagementRate(cast: any): number {
    const totalEngagement = cast.reactions.likes + cast.reactions.recasts + cast.reactions.replies;
    const followers = cast.author.follower_count || 1;
    return Math.min((totalEngagement / followers) * 100, 100);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}