import { ContentItem } from '../lib/base-fetcher';
import { supabase } from '../lib/supabase-client';

/**
 * SOCIAL ENRICHMENT SERVICE
 * Enriches projects with social metrics from Twitter, Discord, Telegram
 * CRITICAL for validating project legitimacy and traction
 */

interface SocialMetrics {
  twitter?: {
    handle: string;
    followers: number;
    following: number;
    tweets: number;
    verified: boolean;
    created_at: string;
    recent_tweets: any[];
    engagement_rate: number;
    growth_rate: number;
  };
  discord?: {
    server_id: string;
    member_count: number;
    online_count: number;
    channel_count: number;
    role_count: number;
    created_at: string;
    activity_level: string;
    verification_level: number;
  };
  telegram?: {
    handle: string;
    member_count: number;
    online_count: number;
    messages_per_day: number;
    created_at: string;
    is_verified: boolean;
  };
  farcaster?: {
    fid: number;
    username: string;
    followers: number;
    following: number;
    casts: number;
    verified: boolean;
  };
  lens?: {
    handle: string;
    followers: number;
    following: number;
    posts: number;
    collects: number;
  };
}

export class SocialEnrichmentService {
  private twitterHeaders: HeadersInit;
  private discordHeaders: HeadersInit;

  constructor() {
    this.twitterHeaders = {
      'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      'Content-Type': 'application/json',
    };
    
    this.discordHeaders = {
      'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Enrich a content item with social metrics
   */
  async enrichContent(item: ContentItem): Promise<ContentItem> {
    const metrics: SocialMetrics = {};

    // Extract social handles from metadata or description
    const handles = this.extractSocialHandles(item);

    // Fetch metrics from each platform
    if (handles.twitter) {
      metrics.twitter = await this.fetchTwitterMetrics(handles.twitter);
    }
    
    if (handles.discord) {
      metrics.discord = await this.fetchDiscordMetrics(handles.discord);
    }
    
    if (handles.telegram) {
      metrics.telegram = await this.fetchTelegramMetrics(handles.telegram);
    }
    
    if (handles.farcaster) {
      metrics.farcaster = await this.fetchFarcasterMetrics(handles.farcaster);
    }

    // Calculate social score
    const socialScore = this.calculateSocialScore(metrics);
    
    // Calculate credibility score
    const credibilityScore = this.calculateCredibilityScore(metrics);

    // Update item with enriched data
    return {
      ...item,
      metadata: {
        ...item.metadata,
        social_metrics: metrics,
        social_score: socialScore,
        credibility_score: credibilityScore,
        social_enriched_at: new Date().toISOString(),
        
        // Add specific fields for easy access
        twitter_followers: metrics.twitter?.followers,
        discord_members: metrics.discord?.member_count,
        telegram_members: metrics.telegram?.member_count,
        
        // Validation flags
        has_verified_social: this.hasVerifiedSocial(metrics),
        social_presence_strong: socialScore > 70,
        community_active: this.isCommunityActive(metrics),
      }
    };
  }

  /**
   * Extract social handles from content
   */
  private extractSocialHandles(item: ContentItem): {
    twitter?: string;
    discord?: string;
    telegram?: string;
    farcaster?: string;
  } {
    const handles: any = {};
    const text = `${item.description} ${JSON.stringify(item.metadata)}`.toLowerCase();

    // Twitter/X
    const twitterMatch = text.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    if (twitterMatch) {
      handles.twitter = twitterMatch[1];
    } else if (item.metadata?.twitter_url) {
      handles.twitter = item.metadata.twitter_url.split('/').pop();
    }

    // Discord
    const discordMatch = text.match(/discord\.gg\/([a-zA-Z0-9]+)/);
    if (discordMatch) {
      handles.discord = discordMatch[1];
    } else if (item.metadata?.discord_url) {
      handles.discord = item.metadata.discord_url.split('/').pop();
    }

    // Telegram
    const telegramMatch = text.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (telegramMatch) {
      handles.telegram = telegramMatch[1];
    }

    // Farcaster
    const farcasterMatch = text.match(/warpcast\.com\/([a-zA-Z0-9_]+)/);
    if (farcasterMatch) {
      handles.farcaster = farcasterMatch[1];
    }

    return handles;
  }

  /**
   * Fetch Twitter/X metrics
   */
  private async fetchTwitterMetrics(handle: string): Promise<SocialMetrics['twitter'] | undefined> {
    if (!process.env.TWITTER_BEARER_TOKEN) {return undefined;}

    try {
      // Get user info
      const userResponse = await fetch(
        `https://api.twitter.com/2/users/by/username/${handle}?user.fields=created_at,description,public_metrics,verified`,
        { headers: this.twitterHeaders }
      );

      if (!userResponse.ok) {return undefined;}

      const userData = await userResponse.json();
      const user = userData.data;

      // Get recent tweets
      const tweetsResponse = await fetch(
        `https://api.twitter.com/2/users/${user.id}/tweets?max_results=10&tweet.fields=created_at,public_metrics`,
        { headers: this.twitterHeaders }
      );

      const tweetsData = await tweetsResponse.json();
      const tweets = tweetsData.data || [];

      // Calculate engagement rate
      const totalEngagement = tweets.reduce((sum: number, tweet: any) => {
        const metrics = tweet.public_metrics;
        return sum + metrics.like_count + metrics.retweet_count + metrics.reply_count;
      }, 0);
      
      const engagementRate = user.public_metrics.followers_count > 0
        ? (totalEngagement / (tweets.length * user.public_metrics.followers_count)) * 100
        : 0;

      // Estimate growth rate (would need historical data for accuracy)
      const accountAge = (Date.now() - new Date(user.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
      const monthlyGrowth = user.public_metrics.followers_count / Math.max(accountAge, 1);

      return {
        handle: user.username,
        followers: user.public_metrics.followers_count,
        following: user.public_metrics.following_count,
        tweets: user.public_metrics.tweet_count,
        verified: user.verified || false,
        created_at: user.created_at,
        recent_tweets: tweets.slice(0, 5),
        engagement_rate: engagementRate,
        growth_rate: monthlyGrowth,
      };
    } catch (error) {

      return undefined;
    }
  }

  /**
   * Fetch Discord metrics
   */
  private async fetchDiscordMetrics(inviteCode: string): Promise<SocialMetrics['discord'] | undefined> {
    try {
      // Get invite info (public endpoint)
      const response = await fetch(
        `https://discord.com/api/v10/invites/${inviteCode}?with_counts=true&with_expiration=true`
      );

      if (!response.ok) {return undefined;}

      const data = await response.json();

      return {
        server_id: data.guild.id,
        member_count: data.approximate_member_count || 0,
        online_count: data.approximate_presence_count || 0,
        channel_count: 0, // Would need bot access
        role_count: 0, // Would need bot access
        created_at: data.guild.created_at || new Date().toISOString(),
        activity_level: this.calculateActivityLevel(
          data.approximate_presence_count,
          data.approximate_member_count
        ),
        verification_level: data.guild.verification_level || 0,
      };
    } catch (error) {

      return undefined;
    }
  }

  /**
   * Fetch Telegram metrics
   */
  private async fetchTelegramMetrics(handle: string): Promise<SocialMetrics['telegram'] | undefined> {
    // Telegram doesn't have a public API for group stats
    // Would need to use a service like TGStat or implement a bot
    
    // For now, return sample structure
    return {
      handle: handle,
      member_count: 0, // Would need TG bot or scraping
      online_count: 0,
      messages_per_day: 0,
      created_at: new Date().toISOString(),
      is_verified: false,
    };
  }

  /**
   * Fetch Farcaster metrics
   */
  private async fetchFarcasterMetrics(username: string): Promise<SocialMetrics['farcaster'] | undefined> {
    if (!process.env.NEYNAR_API_KEY) {return undefined;}

    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/by_username?username=${username}`,
        {
          headers: {
            'api_key': process.env.NEYNAR_API_KEY,
          }
        }
      );

      if (!response.ok) {return undefined;}

      const data = await response.json();
      const user = data.user;

      return {
        fid: user.fid,
        username: user.username,
        followers: user.follower_count,
        following: user.following_count,
        casts: user.casts_count || 0,
        verified: user.verified || false,
      };
    } catch (error) {

      return undefined;
    }
  }

  /**
   * Calculate overall social score
   */
  private calculateSocialScore(metrics: SocialMetrics): number {
    let score = 0;
    let platformCount = 0;

    // Twitter score (max 30 points)
    if (metrics.twitter) {
      platformCount++;
      const twitterScore = Math.min(
        (metrics.twitter.followers / 1000) * 5 + // 5 points per 1k followers
        (metrics.twitter.engagement_rate * 2) + // Engagement weight
        (metrics.twitter.verified ? 10 : 0), // Verification bonus
        30
      );
      score += twitterScore;
    }

    // Discord score (max 30 points)
    if (metrics.discord) {
      platformCount++;
      const activityRatio = metrics.discord.online_count / Math.max(metrics.discord.member_count, 1);
      const discordScore = Math.min(
        (metrics.discord.member_count / 100) * 2 + // 2 points per 100 members
        (activityRatio * 20) + // Activity weight
        (metrics.discord.verification_level * 2), // Verification level
        30
      );
      score += discordScore;
    }

    // Telegram score (max 20 points)
    if (metrics.telegram && metrics.telegram.member_count > 0) {
      platformCount++;
      const telegramScore = Math.min(
        (metrics.telegram.member_count / 100) * 2 + // 2 points per 100 members
        (metrics.telegram.is_verified ? 5 : 0),
        20
      );
      score += telegramScore;
    }

    // Farcaster score (max 20 points)
    if (metrics.farcaster) {
      platformCount++;
      const farcasterScore = Math.min(
        (metrics.farcaster.followers / 100) * 3 + // 3 points per 100 followers
        (metrics.farcaster.verified ? 8 : 0),
        20
      );
      score += farcasterScore;
    }

    // Multi-platform bonus
    if (platformCount >= 3) {score += 10;}
    else if (platformCount >= 2) {score += 5;}

    return Math.min(Math.round(score), 100);
  }

  /**
   * Calculate credibility score based on social signals
   */
  private calculateCredibilityScore(metrics: SocialMetrics): number {
    let score = 0;

    // Account age (older is more credible)
    if (metrics.twitter?.created_at) {
      const ageMonths = (Date.now() - new Date(metrics.twitter.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (ageMonths > 12) {score += 20;}
      else if (ageMonths > 6) {score += 10;}
      else if (ageMonths > 3) {score += 5;}
    }

    // Verification status
    if (metrics.twitter?.verified) {score += 25;}
    if (metrics.farcaster?.verified) {score += 15;}

    // Follower/following ratio (not following everyone back)
    if (metrics.twitter) {
      const ratio = metrics.twitter.followers / Math.max(metrics.twitter.following, 1);
      if (ratio > 2) {score += 15;}
      else if (ratio > 1) {score += 10;}
      else if (ratio > 0.5) {score += 5;}
    }

    // Community engagement
    if (metrics.discord) {
      const engagementRate = metrics.discord.online_count / Math.max(metrics.discord.member_count, 1);
      if (engagementRate > 0.2) {score += 15;}
      else if (engagementRate > 0.1) {score += 10;}
      else if (engagementRate > 0.05) {score += 5;}
    }

    // Consistent activity
    if (metrics.twitter?.tweets) {
      const accountAge = (Date.now() - new Date(metrics.twitter.created_at).getTime()) / (24 * 60 * 60 * 1000);
      const tweetsPerDay = metrics.twitter.tweets / Math.max(accountAge, 1);
      if (tweetsPerDay > 1 && tweetsPerDay < 20) {score += 10;} // Active but not spammy
    }

    return Math.min(Math.round(score), 100);
  }

  /**
   * Check if project has verified social presence
   */
  private hasVerifiedSocial(metrics: SocialMetrics): boolean {
    return !!(metrics.twitter?.verified || metrics.farcaster?.verified);
  }

  /**
   * Check if community is active
   */
  private isCommunityActive(metrics: SocialMetrics): boolean {
    const discordActive = metrics.discord 
      ? metrics.discord.online_count / Math.max(metrics.discord.member_count, 1) > 0.1 
      : false;
    
    const twitterActive = metrics.twitter
      ? metrics.twitter.engagement_rate > 1
      : false;

    return discordActive || twitterActive;
  }

  /**
   * Calculate Discord activity level
   */
  private calculateActivityLevel(online: number, total: number): string {
    const ratio = online / Math.max(total, 1);
    if (ratio > 0.3) {return 'very-active';}
    if (ratio > 0.15) {return 'active';}
    if (ratio > 0.05) {return 'moderate';}
    return 'low';
  }

  /**
   * Batch enrich multiple items
   */
  async enrichBatch(items: ContentItem[]): Promise<ContentItem[]> {
    const enriched: ContentItem[] = [];
    
    // Process in batches to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const enrichedBatch = await Promise.all(
        batch.map(item => this.enrichContent(item))
      );
      enriched.push(...enrichedBatch);
      
      // Rate limiting delay
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return enriched;
  }

  /**
   * Store enriched metrics in database
   */
  async storeMetrics(item: ContentItem): Promise<void> {
    if (!item.metadata?.social_metrics) {return;}

    try {
      await supabase
        .from('social_metrics')
        .upsert({
          content_url: item.url,
          content_type: item.type,
          metrics: item.metadata.social_metrics,
          social_score: item.metadata.social_score,
          credibility_score: item.metadata.credibility_score,
          enriched_at: item.metadata.social_enriched_at,
        });
    } catch (error) {

    }
  }
}