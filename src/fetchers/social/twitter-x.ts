import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

// Twitter/X API v2 Schema
const TwitterSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    text: z.string(),
    created_at: z.string().optional(),
    author_id: z.string().optional(),
    public_metrics: z.object({
      retweet_count: z.number(),
      reply_count: z.number(),
      like_count: z.number(),
      quote_count: z.number(),
    }).optional(),
    entities: z.object({
      hashtags: z.array(z.object({
        tag: z.string(),
      })).optional(),
      urls: z.array(z.object({
        expanded_url: z.string(),
      })).optional(),
    }).optional(),
  })),
  includes: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
      username: z.string(),
      verified: z.boolean().optional(),
      public_metrics: z.object({
        followers_count: z.number(),
      }).optional(),
    })).optional(),
  }).optional(),
});

type TwitterData = z.infer<typeof TwitterSchema>;

export class TwitterFetcher extends BaseFetcher<TwitterData> {
  protected config: FetcherConfig = {
    name: 'Twitter/X',
    url: 'https://api.twitter.com/2',
    headers: {
      'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
    },
    rateLimit: 15000, // 15 seconds between requests for safety
  };

  protected schema = TwitterSchema;

  async fetch(): Promise<TwitterData[]> {
    if (!process.env.TWITTER_BEARER_TOKEN) {
      console.warn('[Twitter] No bearer token provided');
      return [];
    }

    const searches = [
      'Web3 funding OR "raised" OR "Series A" OR "seed round" -is:retweet',
      'DeFi protocol launch OR announcement -is:retweet min_faves:100',
      'blockchain "breaking" OR "launched" OR "announcing" -is:retweet',
      'crypto "partnership" OR "integration" OR "collaboration" -is:retweet min_faves:50',
    ];

    const allData: TwitterData[] = [];

    for (const query of searches) {
      try {
        const params = new URLSearchParams({
          query,
          'tweet.fields': 'created_at,author_id,public_metrics,entities',
          'user.fields': 'name,username,verified,public_metrics',
          'expansions': 'author_id',
          'max_results': '20',
        });

        const response = await fetch(
          `${this.config.url}/tweets/search/recent?${params}`,
          { headers: this.config.headers as HeadersInit }
        );

        if (!response.ok) {
          console.error(`Twitter API error: ${response.status} ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          allData.push(data);
        }

        // Respect rate limits
        await this.delay(this.config.rateLimit || 15000);
      } catch (error) {
        console.error(`[${this.config.name}] Error fetching query "${query}":`, error);
      }
    }

    return allData;
  }

  transform(dataArray: TwitterData[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const data of dataArray) {
      const userMap = new Map(
        data.includes?.users?.map(u => [u.id, u]) || []
      );

      for (const tweet of data.data) {
        // Deduplicate
        if (seen.has(tweet.id)) continue;
        seen.add(tweet.id);

        const author = userMap.get(tweet.author_id || '');
        const engagement = tweet.public_metrics ? 
          tweet.public_metrics.like_count + 
          tweet.public_metrics.retweet_count + 
          tweet.public_metrics.quote_count : 0;

        // Filter for quality (min engagement or verified author)
        if (engagement < 10 && !author?.verified) continue;

        items.push({
          source: 'Twitter',
          type: 'social',
          title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
          description: tweet.text,
          url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
          author: author ? `@${author.username}` : 'Unknown',
          tags: [
            ...(tweet.entities?.hashtags?.map(h => h.tag) || []),
            'twitter',
            engagement > 1000 ? 'viral' : 'trending'
          ],
          metadata: {
            tweet_id: tweet.id,
            author_name: author?.name,
            author_username: author?.username,
            author_verified: author?.verified,
            author_followers: author?.public_metrics?.followers_count,
            likes: tweet.public_metrics?.like_count,
            retweets: tweet.public_metrics?.retweet_count,
            replies: tweet.public_metrics?.reply_count,
            quotes: tweet.public_metrics?.quote_count,
            engagement_score: engagement,
            created_at: tweet.created_at,
            urls: tweet.entities?.urls?.map(u => u.expanded_url),
          }
        });
      }
    }

    // Sort by engagement
    return items.sort((a, b) => 
      (b.metadata?.engagement_score || 0) - (a.metadata?.engagement_score || 0)
    );
  }

}

// Discord Fetcher for announcement channels
const DiscordMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.object({
    username: z.string(),
    discriminator: z.string().optional(),
  }),
  timestamp: z.string(),
  embeds: z.array(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    url: z.string().optional(),
  })).optional(),
  attachments: z.array(z.object({
    url: z.string(),
  })).optional(),
});

export class DiscordFetcher extends BaseFetcher<z.infer<typeof DiscordMessageSchema>[]> {
  protected config: FetcherConfig = {
    name: 'Discord',
    url: 'https://discord.com/api/v10',
    headers: {
      'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
    rateLimit: 1000,
  };

  protected schema = z.array(DiscordMessageSchema);

  // List of important Web3 Discord servers to monitor
  private readonly SERVERS = [
    { id: 'ETHEREUM_SERVER_ID', name: 'Ethereum' },
    { id: 'POLYGON_SERVER_ID', name: 'Polygon' },
    { id: 'SOLANA_SERVER_ID', name: 'Solana' },
    // Add actual server IDs when you have bot access
  ];

  async fetch(): Promise<z.infer<typeof DiscordMessageSchema>[][]> {
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.warn('[Discord] No bot token provided');
      return [];
    }

    const allMessages: z.infer<typeof DiscordMessageSchema>[][] = [];

    for (const server of this.SERVERS) {
      try {
        // Note: You need to add your bot to these servers first
        const response = await fetch(
          `${this.config.url}/guilds/${server.id}/messages/search?content=announcement`,
          { headers: this.config.headers as HeadersInit }
        );

        if (response.ok) {
          const data = await response.json();
          allMessages.push(data.messages || []);
        }
      } catch (error) {
        console.error(`[Discord] Error fetching ${server.name}:`, error);
      }
    }

    return allMessages;
  }

  transform(dataArray: z.infer<typeof DiscordMessageSchema>[][]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const messages of dataArray) {
      for (const message of messages) {
        items.push({
          source: 'Discord',
          type: 'social',
          title: message.content.substring(0, 100),
          description: message.content,
          url: `discord://message/${message.id}`,
          author: message.author.username,
          tags: ['discord', 'announcement', 'community'],
          metadata: {
            message_id: message.id,
            timestamp: message.timestamp,
            embeds: message.embeds,
            has_attachments: (message.attachments?.length || 0) > 0,
          }
        });
      }
    }

    return items;
  }
}

// Telegram Channel Monitor
export class TelegramFetcher extends BaseFetcher<any> {
  protected config: FetcherConfig = {
    name: 'Telegram',
    url: `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`,
    headers: {},
    rateLimit: 1000,
  };

  protected schema = z.any(); // Telegram has complex schemas

  // Important Telegram channels to monitor
  private readonly CHANNELS = [
    '@ethereum_official',
    '@solana_announcements',
    '@defi_updates',
    // Add more channels
  ];

  async fetch(): Promise<any[]> {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn('[Telegram] No bot token provided');
      return [];
    }

    const allData: any[] = [];

    for (const channel of this.CHANNELS) {
      try {
        const response = await fetch(
          `${this.config.url}/getUpdates?channel_id=${channel}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.ok) {
            allData.push(data.result);
          }
        }
      } catch (error) {
        console.error(`[Telegram] Error fetching ${channel}:`, error);
      }
    }

    return allData;
  }

  transform(dataArray: any[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const updates of dataArray) {
      for (const update of updates) {
        if (update.channel_post) {
          const post = update.channel_post;
          items.push({
            source: 'Telegram',
            type: 'social',
            title: (post.text || '').substring(0, 100),
            description: post.text || '',
            url: `https://t.me/${post.chat.username}/${post.message_id}`,
            author: post.chat.title || post.chat.username,
            tags: ['telegram', 'announcement'],
            metadata: {
              message_id: post.message_id,
              chat_id: post.chat.id,
              date: new Date(post.date * 1000).toISOString(),
            }
          });
        }
      }
    }

    return items;
  }
}