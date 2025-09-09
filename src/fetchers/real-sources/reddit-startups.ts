import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';
import { z } from 'zod';

/**
 * REDDIT STARTUPS FETCHER
 * Fetches startup launches, founder posts, and "Show HN" style posts
 * from Reddit's startup and Web3 communities
 */

const RedditPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  selftext: z.string().optional(),
  url: z.string().optional(),
  created_utc: z.number(),
  score: z.number(),
  num_comments: z.number(),
  subreddit: z.string(),
});

type RedditPost = z.infer<typeof RedditPostSchema>;

export class RedditStartupsFetcher extends BaseFetcher<RedditPost[]> {
  protected config: FetcherConfig = {
    name: 'Reddit Startups',
    url: 'https://www.reddit.com',
    rateLimit: 2000,
    timeout: 10000,
  };

  protected schema = z.array(RedditPostSchema);

  async fetch(): Promise<RedditPost[][]> {
    const allPosts: RedditPost[] = [];
    
    try {
      // Target subreddits with startup launches and founder posts
      const subreddits = [
        { name: 'startups', sort: 'new', limit: 25 },
        { name: 'SideProject', sort: 'hot', limit: 20 },
        { name: 'EntrepreneurRideAlong', sort: 'new', limit: 20 },
        { name: 'imadethis', sort: 'new', limit: 15 },
        { name: 'roastmystartup', sort: 'new', limit: 15 },
        { name: 'AlphaAndBetaUsers', sort: 'new', limit: 15 },
        { name: 'web3', sort: 'new', limit: 20 },
        { name: 'ethereum', sort: 'new', limit: 15 },
        { name: 'cryptocurrency', sort: 'new', limit: 10 },
      ];

      for (const sub of subreddits) {
        try {
          // Reddit's public JSON API (no auth needed!)
          const url = `https://www.reddit.com/r/${sub.name}/${sub.sort}.json?limit=${sub.limit}`;
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0; +https://accelerate.com)',
            }
          });

          if (response.ok) {
            const data = await response.json();
            const posts = data.data.children || [];
            
            for (const post of posts) {
              const p = post.data;
              
              // Filter for launch/founder posts
              if (this.isStartupRelated(p)) {
                // Check if it's from 2024
                const postDate = new Date(p.created_utc * 1000);
                if (postDate.getFullYear() < 2024) continue;
                
                allPosts.push({
                  id: p.id,
                  title: p.title,
                  author: p.author,
                  selftext: p.selftext || '',
                  url: p.url || `https://www.reddit.com${p.permalink}`,
                  created_utc: p.created_utc,
                  score: p.score || 0,
                  num_comments: p.num_comments || 0,
                  subreddit: p.subreddit,
                });
              }
            }
          }
        } catch (error) {
          console.log(`Failed to fetch r/${sub.name}:`, error);
        }
        
        // Rate limit between subreddits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Also search for specific keywords
      const searchTerms = [
        'launched my startup',
        'just launched',
        'Show HN',
        'feedback on my startup',
        'built in a weekend',
        'my first SaaS',
        'indie hacker',
        'web3 project launch',
        'YC W24',
        'YC S24',
      ];

      for (const term of searchTerms.slice(0, 3)) { // Limit searches
        try {
          const searchUrl = `https://www.reddit.com/search.json?q="${encodeURIComponent(term)}"&sort=new&limit=10`;
          
          const response = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)',
            }
          });

          if (response.ok) {
            const data = await response.json();
            const posts = data.data.children || [];
            
            for (const post of posts) {
              const p = post.data;
              
              // Check 2024 only
              const postDate = new Date(p.created_utc * 1000);
              if (postDate.getFullYear() < 2024) continue;
              
              // Avoid duplicates
              if (allPosts.some(existing => existing.id === p.id)) continue;
              
              allPosts.push({
                id: p.id,
                title: p.title,
                author: p.author,
                selftext: p.selftext || '',
                url: p.url || `https://www.reddit.com${p.permalink}`,
                created_utc: p.created_utc,
                score: p.score || 0,
                num_comments: p.num_comments || 0,
                subreddit: p.subreddit,
              });
            }
          }
        } catch (error) {
          console.log(`Search failed for "${term}":`, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

    } catch (error) {
      console.error('Reddit fetcher error:', error);
    }

    console.log(`📊 Reddit: Found ${allPosts.length} startup-related posts from 2024`);
    
    return [allPosts];
  }

  transform(data: RedditPost[][]): ContentItem[] {
    const items: ContentItem[] = [];
    
    for (const posts of data) {
      for (const post of posts) {
        // Extract startup info from title and text
        const startupInfo = this.extractStartupInfo(post);
        
        if (!startupInfo.name) continue; // Skip if we can't identify a startup
        
        const postDate = new Date(post.created_utc * 1000);
        
        items.push({
          type: 'project',
          title: startupInfo.name,
          description: startupInfo.description.substring(0, 1000),
          url: startupInfo.url || post.url,
          source: 'Reddit',
          author: post.author,
          published: postDate.toISOString(),
          tags: [
            post.subreddit,
            ...startupInfo.tags,
            'community-launch',
          ].filter(Boolean),
          metadata: {
            reddit_post_id: post.id,
            reddit_score: post.score,
            reddit_comments: post.num_comments,
            reddit_url: `https://www.reddit.com${post.url}`,
            
            // Startup metadata
            startup_name: startupInfo.name,
            launch_date: postDate.toISOString().split('T')[0],
            launch_year: postDate.getFullYear(),
            
            // Estimate based on post content
            team_size: startupInfo.teamSize || 1,
            funding_raised: 0, // Reddit launches are usually pre-funding
            funding_stage: 'pre-seed',
            
            // Indicators
            is_solo_founder: startupInfo.isSolo,
            seeking_feedback: startupInfo.seekingFeedback,
            seeking_cofounders: startupInfo.seekingCofounders,
            seeking_funding: startupInfo.seekingFunding,
            
            // Engagement as quality signal
            engagement_score: post.score + (post.num_comments * 2),
            is_verified: false, // Reddit posts aren't verified
            credibility_score: Math.min(50, 20 + Math.log(post.score + 1) * 5),
            
            // ACCELERATE scoring
            accelerate_score: Math.min(100,
              20 + // Base for being a launch
              (postDate.getFullYear() === 2024 ? 20 : 10) + // Recency
              (post.score > 10 ? 10 : 5) + // Engagement
              (startupInfo.hasProduct ? 15 : 0) + // Has actual product
              (startupInfo.tags.includes('web3') ? 10 : 0) // Web3 focus
            ),
          }
        });
      }
    }
    
    return items;
  }

  private isStartupRelated(post: any): boolean {
    const title = post.title.toLowerCase();
    const text = (post.selftext || '').toLowerCase();
    const combined = title + ' ' + text;
    
    // Launch indicators
    const launchKeywords = [
      'launched', 'launching', 'launch', 'built', 'created',
      'introducing', 'announcing', 'released', 'shipped',
      'my startup', 'our startup', 'my app', 'our app',
      'my saas', 'our saas', 'my project', 'side project',
      'mvp', 'beta', 'alpha', 'early access',
      'feedback', 'roast', 'review my',
      'yc w24', 'yc s24', 'yc f24', 'y combinator',
    ];
    
    // Check if it's a launch/founder post
    return launchKeywords.some(keyword => combined.includes(keyword));
  }

  private extractStartupInfo(post: RedditPost): {
    name: string;
    description: string;
    url?: string;
    tags: string[];
    teamSize: number;
    isSolo: boolean;
    seekingFeedback: boolean;
    seekingCofounders: boolean;
    seekingFunding: boolean;
    hasProduct: boolean;
  } {
    const title = post.title;
    const text = post.selftext || '';
    const combined = title + '\n' + text;
    
    // Extract startup name from patterns like "Launching X:", "X - A tool for", etc.
    let name = '';
    
    const namePatterns = [
      /(?:launching|launched|built|created|introducing|announcing)\s+([A-Z][A-Za-z0-9]+)/i,
      /^([A-Z][A-Za-z0-9]+)\s*[-–:]/,
      /\[([A-Z][A-Za-z0-9]+)\]/,
      /Show HN:\s*([A-Z][A-Za-z0-9]+)/i,
    ];
    
    for (const pattern of namePatterns) {
      const match = title.match(pattern);
      if (match) {
        name = match[1];
        break;
      }
    }
    
    // If no name found, use first capitalized word that looks like a product name
    if (!name) {
      const wordMatch = title.match(/\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/);
      if (wordMatch) name = wordMatch[1];
    }
    
    // Extract URL
    let url = post.url;
    if (!url || url.includes('reddit.com')) {
      // Try to find URL in text
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) url = urlMatch[0];
    }
    
    // Extract description
    const description = text || title;
    
    // Detect tags based on content
    const tags: string[] = [];
    if (combined.match(/\b(web3|blockchain|crypto|nft|defi|dao)\b/i)) tags.push('web3');
    if (combined.match(/\b(ai|ml|machine learning|gpt|llm)\b/i)) tags.push('ai');
    if (combined.match(/\b(saas|b2b|enterprise)\b/i)) tags.push('saas');
    if (combined.match(/\b(mobile|ios|android|app)\b/i)) tags.push('mobile');
    if (combined.match(/\b(developer|api|sdk|tool)\b/i)) tags.push('developer-tools');
    
    // Detect team size
    const teamSize = combined.match(/\b(solo|alone|myself|i built)\b/i) ? 1 :
                     combined.match(/\b(we|our team|co-?founder)\b/i) ? 2 : 1;
    
    // Detect needs
    const seekingFeedback = /feedback|roast|review|thoughts|opinion/i.test(combined);
    const seekingCofounders = /co-?founder|looking for.*partner|seeking.*technical/i.test(combined);
    const seekingFunding = /funding|investor|raise|seed|vc|angel/i.test(combined);
    const hasProduct = /live|available|try it|check it out|\.com|\.io|github/i.test(combined);
    
    return {
      name: name || 'Unnamed Startup',
      description,
      url,
      tags,
      teamSize,
      isSolo: teamSize === 1,
      seekingFeedback,
      seekingCofounders,
      seekingFunding,
      hasProduct,
    };
  }
}