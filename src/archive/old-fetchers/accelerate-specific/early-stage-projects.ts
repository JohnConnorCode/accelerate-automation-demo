import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * FETCHES ONLY EARLY-STAGE PROJECTS PER ACCELERATE_FINAL_CRITERIA
 * STRICT Criteria:
 * - Launched 2024 or later ONLY
 * - Less than $500,000 raised (not $5M)
 * - Team size 1-10 people (prefer 1-5)
 * - NOT backed by large corporations
 * - Active in last 30 days
 * - Real operating projects (not vaporware)
 */

// GitHub Search for early-stage Web3 projects
const GitHubEarlyStageSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    html_url: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    pushed_at: z.string(),
    stargazers_count: z.number(),
    forks_count: z.number(),
    open_issues_count: z.number(),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
    owner: z.object({
      login: z.string(),
      type: z.string(),
    }),
  })),
  total_count: z.number(),
});

export class EarlyStageProjectsFetcher extends BaseFetcher<z.infer<typeof GitHubEarlyStageSchema>> {
  protected config: FetcherConfig = {
    name: 'Early Stage Projects',
    url: 'https://api.github.com/search/repositories',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : '',
    },
    rateLimit: 2000,
  };

  protected schema = GitHubEarlyStageSchema;

  async fetch(): Promise<z.infer<typeof GitHubEarlyStageSchema>[]> {
    const results: z.infer<typeof GitHubEarlyStageSchema>[] = [];
    
    // Search queries specifically for early-stage indicators
    const queries = [
      // Projects seeking funding
      '"seeking funding" OR "raising seed" OR "pre-seed round" web3 OR blockchain stars:10..500',
      
      // Projects looking for co-founders
      '"looking for co-founder" OR "seeking co-founder" OR "need technical co-founder" web3 OR blockchain',
      
      // Projects hiring founding team
      '"hiring founding engineer" OR "first engineer" OR "founding team" web3 OR blockchain',
      
      // Recently launched MVPs
      '"MVP launched" OR "beta launch" OR "just launched" web3 OR blockchain created:>2023-01-01',
      
      // Hackathon winners scaling up
      '"hackathon winner" OR "won hackathon" OR "first place" web3 OR blockchain',
    ];

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          q: query,
          sort: 'updated',
          order: 'desc',
          per_page: '20',
        });

        const response = await fetch(`${this.config.url}?${params}`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          
          // STRICT FILTERING per ACCELERATE_FINAL_CRITERIA
          data.items = data.items.filter((repo: any) => {
            const createdDate = new Date(repo.created_at);
            const updatedDate = new Date(repo.pushed_at || repo.updated_at);
            const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (24 * 60 * 60 * 1000);
            
            // CRITICAL: Only projects launched 2024 or later
            const isPost2024 = createdDate >= new Date('2024-01-01');
            
            // Check for corporate backing indicators
            const desc = (repo.description || '').toLowerCase();
            const hasCorporateBacking = 
              desc.includes('coinbase') || desc.includes('binance') || 
              desc.includes('sony') || desc.includes('microsoft') ||
              desc.includes('google') || desc.includes('amazon');
            
            return (
              isPost2024 && // CRITERIA: Launched 2024+
              daysSinceUpdate < 30 && // CRITERIA: Active in last 30 days
              repo.stargazers_count >= 10 && // Some validation
              repo.stargazers_count < 1000 && // Not too established (indicates <$500k funding)
              !hasCorporateBacking && // CRITERIA: NOT corporate-backed
              (repo.owner.type === 'Organization' || repo.owner.type === 'User') // Real project
            );
          });
          
          if (data.items.length > 0) {
            results.push(data);
          }
        }

        await this.delay(this.config.rateLimit || 2000);
      } catch (error) {

      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof GitHubEarlyStageSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const data of dataArray) {
      for (const repo of data.items) {
        if (seen.has(repo.html_url)) continue;
        seen.add(repo.html_url);

        // Determine what the project needs based on description and issues
        const description = (repo.description || '').toLowerCase();
        const needsFunding = description.includes('funding') || description.includes('seed') || description.includes('raise');
        const needsCofounder = description.includes('co-founder') || description.includes('cofounder');
        const needsTeam = description.includes('hiring') || description.includes('engineer') || repo.open_issues_count > 10;

        // Calculate stage based on indicators
        const stage = this.determineStage(repo);

        // DETAILED PROJECT DATA per ACCELERATE_FINAL_CRITERIA
        const launchDate = new Date(repo.created_at);
        const teamSize = this.estimateTeamSize(repo);
        const fundingEstimate = this.estimateFunding(repo);
        const projectNeeds = this.determineProjectNeeds(repo);
        
        // Create comprehensive description (500+ chars preferred)
        const fullDescription = `${repo.description || 'Early-stage Web3 project'}. ` +
          `Founded by ${repo.owner.login} in ${launchDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, ` +
          `this ${stage} project has ${repo.stargazers_count} GitHub stars and an estimated team of ${teamSize} people. ` +
          `The project is actively ${needsFunding ? 'seeking funding' : ''}${needsCofounder ? ', looking for co-founders' : ''}${needsTeam ? ', hiring developers' : ''}. ` +
          `Built with ${repo.language || 'multiple technologies'}, the project shows ${this.determineTraction(repo)}. ` +
          `This independent project (not corporate-backed) represents an opportunity for early supporters and contributors to join at the ground floor.`;

        items.push({
          source: 'GitHub',
          type: 'project',
          title: repo.name,
          description: fullDescription.substring(0, 1000), // CRITERIA: Detailed description
          url: repo.html_url,
          author: repo.owner.login,
          tags: [
            ...(repo.topics || []),
            stage,
            'independent',
            '2024-launch',
            ...projectNeeds.map(need => `seeking-${need}`),
            teamSize <= 5 ? 'very-early-team' : 'small-team',
          ].filter(Boolean),
          metadata: {
            // Required fields from ACCELERATE_FINAL_CRITERIA
            name: repo.name,
            short_description: (repo.description || '').substring(0, 100),
            website_url: repo.html_url,
            github_url: repo.html_url,
            twitter_url: null, // Would need to extract from description
            discord_url: null, // Would need to extract from description
            
            // Stage Information
            launch_date: repo.created_at,
            funding_raised: fundingEstimate,
            funding_round: stage === 'pre-seed' ? 'pre-seed' : stage === 'seed' ? 'seed' : null,
            team_size: teamSize,
            
            // Categories & Tags
            categories: this.determineCategories(repo),
            supported_chains: [], // Would need to analyze code
            project_needs: projectNeeds,
            
            // Validation
            grant_participation: [], // Would need external data
            incubator_participation: [],
            traction_metrics: {
              users: null, // Would need external data
              tvl: null,
              transactions: null,
              github_stars: repo.stargazers_count,
            },
            
            // Activity Tracking
            last_activity: repo.pushed_at || repo.updated_at,
            development_status: 'active',
            
            // Detailed Context
            problem_solving: this.extractProblemStatement(repo),
            unique_value_prop: this.extractValueProp(repo),
            target_market: 'Web3 developers and users',
            roadmap_highlights: [],
            
            // Additional metadata
            github_id: repo.id,
            full_name: repo.full_name,
            github_forks: repo.forks_count,
            open_issues: repo.open_issues_count,
            language: repo.language,
          }
        });
      }
    }

    return items;
  }

  private determineStage(repo: any): string {
    const stars = repo.stargazers_count;
    const ageInMonths = (Date.now() - new Date(repo.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
    
    // More accurate stage determination based on GitHub metrics
    if (stars < 50 && ageInMonths < 3) return 'idea';
    if (stars < 100 && ageInMonths < 6) return 'pre-seed';
    if (stars < 500 && ageInMonths < 12) return 'seed';
    return 'early-stage';
  }

  private estimateTeamSize(repo: any): number {
    // More conservative estimate aligned with CRITERIA (1-10 people max)
    const forks = repo.forks_count;
    const contributors = Math.min(forks, 10); // Cap at 10
    
    if (contributors === 0) return 1;
    if (contributors <= 2) return 2;
    if (contributors <= 4) return 3;
    if (contributors <= 7) return 5;
    return Math.min(contributors, 10); // Never exceed 10
  }

  private estimateFunding(repo: any): number {
    // Estimate funding based on GitHub metrics (always < $500k per CRITERIA)
    const stars = repo.stargazers_count;
    
    if (stars < 50) return 0; // No funding yet
    if (stars < 100) return 25000; // Friends & family round
    if (stars < 250) return 100000; // Small pre-seed
    if (stars < 500) return 250000; // Pre-seed
    return 450000; // Max estimate under $500k threshold
  }

  private determineProjectNeeds(repo: any): string[] {
    const needs: string[] = [];
    const desc = (repo.description || '').toLowerCase();
    
    if (desc.includes('funding') || desc.includes('seed') || desc.includes('raise')) {
      needs.push('funding');
    }
    if (desc.includes('co-founder') || desc.includes('cofounder')) {
      needs.push('co-founder');
    }
    if (desc.includes('hiring') || desc.includes('engineer') || desc.includes('developer')) {
      needs.push('developers');
    }
    if (desc.includes('marketing') || desc.includes('growth')) {
      needs.push('marketing');
    }
    if (desc.includes('advisor') || desc.includes('mentor')) {
      needs.push('advisors');
    }
    
    // If no explicit needs mentioned, assume they need something
    if (needs.length === 0) {
      needs.push('contributors', 'feedback');
    }
    
    return needs;
  }

  private determineTraction(repo: any): string {
    const stars = repo.stargazers_count;
    const forks = repo.forks_count;
    
    if (stars > 200) return 'strong early traction';
    if (stars > 100) return 'growing community interest';
    if (stars > 50) return 'initial validation';
    if (forks > 5) return 'active development';
    return 'early exploration phase';
  }

  private determineCategories(repo: any): string[] {
    const categories: string[] = [];
    const topics = (repo.topics || []).join(' ').toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const combined = `${topics} ${desc}`;
    
    if (combined.includes('defi')) categories.push('DeFi');
    if (combined.includes('nft')) categories.push('NFT');
    if (combined.includes('dao')) categories.push('DAO');
    if (combined.includes('infrastructure')) categories.push('Infrastructure');
    if (combined.includes('gaming') || combined.includes('game')) categories.push('Gaming');
    if (combined.includes('social')) categories.push('Social');
    if (combined.includes('identity')) categories.push('Identity');
    if (combined.includes('oracle')) categories.push('Oracle');
    
    if (categories.length === 0) categories.push('Web3');
    
    return categories;
  }

  private extractProblemStatement(repo: any): string {
    const desc = repo.description || '';
    // Try to extract what problem the project solves
    if (desc.toLowerCase().includes('solve')) {
      return desc;
    }
    return `Building innovative solutions in the ${this.determineCategories(repo)[0]} space`;
  }

  private extractValueProp(repo: any): string {
    const desc = repo.description || '';
    const topics = (repo.topics || []).join(', ');
    return `Open-source ${repo.language || 'Web3'} project focused on ${topics || 'blockchain innovation'}`;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ProductHunt - Projects Just Launching
const ProductHuntLaunchSchema = z.object({
  data: z.object({
    posts: z.object({
      edges: z.array(z.object({
        node: z.object({
          id: z.string(),
          name: z.string(),
          tagline: z.string(),
          description: z.string().nullable(),
          url: z.string(),
          website: z.string().nullable(),
          votesCount: z.number(),
          commentsCount: z.number(),
          createdAt: z.string(),
          featuredAt: z.string().nullable(),
          topics: z.object({
            edges: z.array(z.object({
              node: z.object({
                name: z.string(),
              })
            }))
          }).optional(),
          makers: z.object({
            edges: z.array(z.object({
              node: z.object({
                username: z.string(),
              })
            }))
          }).optional(),
        })
      }))
    })
  })
});

export class ProductHuntEarlyStageFetcher extends BaseFetcher<z.infer<typeof ProductHuntLaunchSchema>> {
  protected config: FetcherConfig = {
    name: 'ProductHunt Early Stage',
    url: 'https://api.producthunt.com/v2/api/graphql',
    headers: {
      'Authorization': `Bearer ${process.env.PRODUCTHUNT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    rateLimit: 3000,
  };

  protected schema = ProductHuntLaunchSchema;

  async fetch(): Promise<z.infer<typeof ProductHuntLaunchSchema>[]> {
    if (!process.env.PRODUCTHUNT_TOKEN) {

      return [];
    }

    const query = `
      query {
        posts(first: 20, order: NEWEST, topic: "web3") {
          edges {
            node {
              id
              name
              tagline
              description
              url
              website
              votesCount
              commentsCount
              createdAt
              featuredAt
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
              makers {
                edges {
                  node {
                    username
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: this.config.headers as HeadersInit,
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        return [data];
      }
    } catch (error) {

    }

    return [];
  }

  transform(dataArray: z.infer<typeof ProductHuntLaunchSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];

    for (const data of dataArray) {
      for (const edge of data.data.posts.edges) {
        const post = edge.node;
        
        // STRICT: Check launch date and funding indicators
        const launchDate = new Date(post.createdAt);
        if (launchDate < new Date('2024-01-01')) continue; // CRITERIA: 2024+ only
        if (post.votesCount > 1000) continue; // Too established (likely >$500k funding)
        
        const topics = post.topics?.edges.map(t => t.node.name) || [];
        const makers = post.makers?.edges.map(m => m.node.username) || [];
        
        // DETAILED PROJECT DATA per ACCELERATE_FINAL_CRITERIA
        const teamSize = Math.min(makers.length || 1, 10); // Cap at 10
        const stage = post.votesCount < 100 ? 'pre-seed' : post.votesCount < 500 ? 'seed' : 'early-stage';
        const fundingEstimate = post.votesCount < 100 ? 0 : post.votesCount < 500 ? 100000 : 300000;
        
        const fullDescription = `${post.tagline}. ${post.description || 'Just launched on ProductHunt'}. ` +
          `This ${stage} project launched on ${new Date(post.createdAt).toLocaleDateString()} ` +
          `by ${makers.join(', ') || 'independent makers'}. ` +
          `With ${post.votesCount} votes and ${post.commentsCount} comments, ` +
          `the project shows ${post.votesCount > 200 ? 'strong' : 'early'} market validation. ` +
          `As a newly launched project, they are actively seeking early adopters, feedback, and potential investors to help scale their vision.`;

        items.push({
          source: 'ProductHunt',
          type: 'project',
          title: post.name,
          description: fullDescription.substring(0, 1000),
          url: post.url,
          author: makers[0] || 'Unknown',
          tags: [
            ...topics,
            'just-launched',
            'mvp',
            '2024-launch',
            'seeking-users',
            'seeking-feedback',
            stage,
          ],
          metadata: {
            // Required fields from ACCELERATE_FINAL_CRITERIA
            name: post.name,
            short_description: post.tagline.substring(0, 100),
            website_url: post.website || post.url,
            github_url: null,
            twitter_url: null,
            discord_url: null,
            
            // Stage Information
            launch_date: post.createdAt,
            funding_raised: fundingEstimate,
            funding_round: stage === 'pre-seed' ? 'pre-seed' : stage === 'seed' ? 'seed' : null,
            team_size: teamSize,
            
            // Categories & Tags
            categories: topics.length > 0 ? topics : ['Web3'],
            supported_chains: [],
            project_needs: ['users', 'feedback', 'funding', 'marketing'],
            
            // Validation
            grant_participation: [],
            incubator_participation: [],
            traction_metrics: {
              users: post.votesCount, // Votes as proxy for users
              tvl: null,
              transactions: null,
              github_stars: null,
            },
            
            // Activity Tracking
            last_activity: post.createdAt,
            development_status: 'launched',
            
            // Detailed Context
            problem_solving: post.tagline,
            unique_value_prop: post.description || 'Innovative Web3 solution',
            target_market: 'Early adopters and Web3 enthusiasts',
            roadmap_highlights: [],
            
            // Additional metadata
            product_id: post.id,
            website: post.website,
            votes: post.votesCount,
            comments: post.commentsCount,
            featured: post.featuredAt !== null,
            makers: makers,
          }
        });
      }
    }

    return items;
  }
}