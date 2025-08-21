import { z } from 'zod';
import { BaseFetcher, ContentItem, FetcherConfig } from '../../lib/base-fetcher';

/**
 * FETCHES ONLY HIGH-QUALITY RESOURCES FOR WEB3 BUILDERS
 * Criteria:
 * - Free or low-cost (<$100)
 * - Updated in last 6 months
 * - From credible sources
 * - Actionable (not just theory)
 * - Web3/blockchain specific
 */

// Dev.to - Fresh Web3 Tutorials
const DevToTutorialSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string(),
  url: z.string(),
  published_at: z.string(),
  edited_at: z.string().nullable(),
  positive_reactions_count: z.number(),
  comments_count: z.number(),
  reading_time_minutes: z.number(),
  tag_list: z.array(z.string()),
  user: z.object({
    name: z.string(),
    username: z.string(),
    twitter_username: z.string().nullable(),
    github_username: z.string().nullable(),
  }),
  organization: z.object({
    name: z.string(),
    username: z.string(),
  }).optional(),
});

export class DevToBuilderResourcesFetcher extends BaseFetcher<z.infer<typeof DevToTutorialSchema>[]> {
  protected config: FetcherConfig = {
    name: 'Dev.to Builder Resources',
    url: 'https://dev.to/api/articles',
    headers: {},
    rateLimit: 1000,
  };

  protected schema = z.array(DevToTutorialSchema);

  async fetch(): Promise<z.infer<typeof DevToTutorialSchema>[][]> {
    const results: z.infer<typeof DevToTutorialSchema>[][] = [];
    
    // Specific searches for builder resources
    const searches = [
      'tag=solidity&state=fresh',
      'tag=web3&tag=tutorial&state=rising',
      'tag=ethereum&tag=smartcontract&state=fresh',
      'tag=rust&tag=solana&state=fresh',
      'tag=defi&tag=tutorial',
      'tag=hardhat&state=fresh',
      'tag=foundry&state=fresh',
    ];

    for (const search of searches) {
      try {
        const response = await fetch(`${this.config.url}?${search}&per_page=10`);
        
        if (response.ok) {
          const articles = await response.json();
          
          // Filter for quality and recency
          const filtered = articles.filter((article: any) => {
            const publishedDate = new Date(article.published_at);
            const monthsOld = (Date.now() - publishedDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
            
            return (
              monthsOld < 6 && // Less than 6 months old
              article.positive_reactions_count > 5 && // Some validation
              article.reading_time_minutes > 3 && // Not just a snippet
              article.reading_time_minutes < 30 // Not a book
            );
          });
          
          if (filtered.length > 0) {
            results.push(filtered);
          }
        }
        
        await this.delay(this.config.rateLimit || 1000);
      } catch (error) {
        console.error(`[${this.config.name}] Error with search "${search}":`, error);
      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof DevToTutorialSchema>[][]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const articles of dataArray) {
      for (const article of articles) {
        if (seen.has(article.url)) continue;
        seen.add(article.url);

        // Determine resource category
        const tags = article.tag_list.map(t => t.toLowerCase());
        const category = this.determineCategory(tags);
        const difficulty = this.determineDifficulty(article.title, tags);

        items.push({
          source: 'Dev.to',
          type: 'resource',
          title: article.title,
          description: article.description.substring(0, 500),
          url: article.url,
          author: article.user.name,
          tags: [
            ...article.tag_list,
            category,
            difficulty,
            'tutorial',
          ],
          metadata: {
            article_id: article.id,
            published_at: article.published_at,
            updated_at: article.edited_at || article.published_at,
            reading_time: article.reading_time_minutes,
            reactions: article.positive_reactions_count,
            comments: article.comments_count,
            author_github: article.user.github_username,
            author_twitter: article.user.twitter_username,
            organization: article.organization?.name,
            category: category,
            difficulty: difficulty,
            price: 0, // Dev.to is free
            quality_score: this.calculateQualityScore(article),
          }
        });
      }
    }

    return items.sort((a, b) => 
      (b.metadata?.quality_score || 0) - (a.metadata?.quality_score || 0)
    );
  }

  private determineCategory(tags: string[]): string {
    if (tags.some(t => t.includes('smart') || t.includes('contract') || t.includes('solidity'))) {
      return 'smart-contracts';
    }
    if (tags.some(t => t.includes('defi') || t.includes('finance'))) {
      return 'defi-development';
    }
    if (tags.some(t => t.includes('nft') || t.includes('erc721') || t.includes('erc1155'))) {
      return 'nft-development';
    }
    if (tags.some(t => t.includes('security') || t.includes('audit'))) {
      return 'security';
    }
    if (tags.some(t => t.includes('frontend') || t.includes('react') || t.includes('web3js'))) {
      return 'frontend';
    }
    return 'general-web3';
  }

  private determineDifficulty(title: string, tags: string[]): string {
    const lower = title.toLowerCase();
    if (lower.includes('beginner') || lower.includes('intro') || lower.includes('getting started')) {
      return 'beginner';
    }
    if (lower.includes('advanced') || lower.includes('deep dive') || lower.includes('optimization')) {
      return 'advanced';
    }
    return 'intermediate';
  }

  private calculateQualityScore(article: any): number {
    let score = 0;
    
    // Engagement metrics
    score += Math.min(article.positive_reactions_count, 50);
    score += Math.min(article.comments_count * 2, 20);
    
    // Author credibility
    if (article.user.github_username) score += 10;
    if (article.organization) score += 15;
    
    // Content quality
    if (article.reading_time_minutes >= 5 && article.reading_time_minutes <= 20) score += 15;
    
    // Recency
    const daysOld = (Date.now() - new Date(article.published_at).getTime()) / (24 * 60 * 60 * 1000);
    if (daysOld < 30) score += 20;
    else if (daysOld < 90) score += 10;
    
    return Math.min(score, 100);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// GitHub - High-Quality Developer Tools
const GitHubToolSchema = z.object({
  items: z.array(z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    html_url: z.string(),
    homepage: z.string().nullable(),
    stargazers_count: z.number(),
    forks_count: z.number(),
    language: z.string().nullable(),
    topics: z.array(z.string()).optional(),
    created_at: z.string(),
    updated_at: z.string(),
    pushed_at: z.string(),
    license: z.object({
      name: z.string(),
    }).nullable(),
    owner: z.object({
      login: z.string(),
      type: z.string(),
    }),
  })),
});

export class GitHubBuilderToolsFetcher extends BaseFetcher<z.infer<typeof GitHubToolSchema>> {
  protected config: FetcherConfig = {
    name: 'GitHub Builder Tools',
    url: 'https://api.github.com/search/repositories',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : '',
    },
    rateLimit: 2000,
  };

  protected schema = GitHubToolSchema;

  async fetch(): Promise<z.infer<typeof GitHubToolSchema>[]> {
    const results: z.infer<typeof GitHubToolSchema>[] = [];
    
    // Search for specific types of developer tools
    const searches = [
      'web3 tool OR sdk OR library stars:>50 pushed:>2024-01-01',
      'solidity template OR boilerplate stars:>20 pushed:>2024-01-01',
      'smart contract security OR audit tool stars:>30',
      'hardhat plugin OR foundry stars:>10 pushed:>2024-01-01',
      'web3 testing framework stars:>20',
    ];

    for (const query of searches) {
      try {
        const params = new URLSearchParams({
          q: query,
          sort: 'stars',
          order: 'desc',
          per_page: '10',
        });

        const response = await fetch(`${this.config.url}?${params}`, {
          headers: this.config.headers as HeadersInit,
        });

        if (response.ok) {
          const data = await response.json();
          
          // Filter for quality and maintenance
          data.items = data.items.filter((repo: any) => {
            const lastPush = new Date(repo.pushed_at);
            const monthsSinceUpdate = (Date.now() - lastPush.getTime()) / (30 * 24 * 60 * 60 * 1000);
            
            return (
              monthsSinceUpdate < 6 && // Active maintenance
              repo.stargazers_count > 20 && // Some adoption
              repo.license && // Open source
              repo.description // Has documentation
            );
          });
          
          if (data.items.length > 0) {
            results.push(data);
          }
        }
        
        await this.delay(this.config.rateLimit || 2000);
      } catch (error) {
        console.error(`[${this.config.name}] Error with query:`, error);
      }
    }

    return results;
  }

  transform(dataArray: z.infer<typeof GitHubToolSchema>[]): ContentItem[] {
    const items: ContentItem[] = [];
    const seen = new Set<string>();

    for (const data of dataArray) {
      for (const repo of data.items) {
        if (seen.has(repo.html_url)) continue;
        seen.add(repo.html_url);

        const category = this.determineToolCategory(repo);
        
        items.push({
          source: 'GitHub',
          type: 'resource',
          title: repo.name,
          description: repo.description || 'Web3 developer tool',
          url: repo.html_url,
          author: repo.owner.login,
          tags: [
            ...(repo.topics || []),
            category,
            'developer-tool',
            repo.language?.toLowerCase() || 'multi-language',
            'open-source',
          ],
          metadata: {
            repo_id: repo.id,
            full_name: repo.full_name,
            homepage: repo.homepage,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            license: repo.license?.name,
            last_updated: repo.pushed_at,
            created_at: repo.created_at,
            category: category,
            difficulty: 'intermediate',
            price: 0, // Open source = free
            quality_score: this.calculateToolQuality(repo),
          }
        });
      }
    }

    return items;
  }

  private determineToolCategory(repo: any): string {
    const name = repo.name.toLowerCase();
    const desc = (repo.description || '').toLowerCase();
    const topics = (repo.topics || []).join(' ').toLowerCase();
    const combined = `${name} ${desc} ${topics}`;

    if (combined.includes('template') || combined.includes('boilerplate')) {
      return 'template';
    }
    if (combined.includes('sdk') || combined.includes('library')) {
      return 'sdk';
    }
    if (combined.includes('security') || combined.includes('audit')) {
      return 'security-tool';
    }
    if (combined.includes('test') || combined.includes('testing')) {
      return 'testing-tool';
    }
    if (combined.includes('plugin') || combined.includes('extension')) {
      return 'plugin';
    }
    return 'tool';
  }

  private calculateToolQuality(repo: any): number {
    let score = 0;
    
    // Popularity
    score += Math.min(repo.stargazers_count / 10, 30);
    score += Math.min(repo.forks_count / 5, 20);
    
    // Maintenance
    const daysSinceUpdate = (Date.now() - new Date(repo.pushed_at).getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate < 30) score += 20;
    else if (daysSinceUpdate < 90) score += 10;
    
    // Documentation
    if (repo.homepage) score += 10;
    if (repo.topics && repo.topics.length > 3) score += 10;
    
    // License
    if (repo.license) score += 10;
    
    return Math.min(score, 100);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private determineToolPurpose(repo: any, category: string): string {
    if (category === 'template') return 'production-ready boilerplate code to accelerate development';
    if (category === 'sdk') return 'simplified APIs and libraries for blockchain integration';
    if (category === 'security-tool') return 'automated security analysis and vulnerability detection';
    if (category === 'testing-tool') return 'comprehensive testing framework for smart contracts';
    if (category === 'plugin') return 'enhanced development environment capabilities';
    return 'essential utilities and helpers for Web3 development';
  }

  private getTimeSinceUpdate(date: string): string {
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day';
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    return `${Math.floor(days / 30)} months`;
  }

  private determineToolCredibility(repo: any): string {
    const credibility: string[] = [];
    
    if (repo.stargazers_count > 1000) {
      credibility.push(`Highly popular (${repo.stargazers_count} stars)`);
    } else if (repo.stargazers_count > 100) {
      credibility.push(`Well-adopted (${repo.stargazers_count} stars)`);
    }
    
    if (repo.forks_count > 100) {
      credibility.push(`Active community (${repo.forks_count} forks)`);
    }
    
    if (repo.owner.type === 'Organization') {
      credibility.push(`Maintained by organization: ${repo.owner.login}`);
    }
    
    const monthsOld = (Date.now() - new Date(repo.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
    if (monthsOld > 12) {
      credibility.push(`Established project (${Math.floor(monthsOld / 12)} years old)`);
    }
    
    return credibility.join('. ') || `Open source project by ${repo.owner.login}`;
  }

  private determineToolPrereqs(repo: any, category: string): string[] {
    const prereqs: string[] = [];
    
    if (repo.language === 'TypeScript' || repo.language === 'JavaScript') {
      prereqs.push('Node.js installed', 'npm or yarn package manager');
    } else if (repo.language === 'Rust') {
      prereqs.push('Rust toolchain installed', 'Cargo package manager');
    } else if (repo.language === 'Solidity') {
      prereqs.push('Solidity compiler', 'Ethereum development environment');
    }
    
    if (category === 'testing-tool') {
      prereqs.push('Smart contract project', 'Test network access');
    } else if (category === 'security-tool') {
      prereqs.push('Smart contract source code', 'Understanding of security patterns');
    }
    
    return prereqs;
  }

  private determineToolBenefits(repo: any, category: string): string[] {
    const benefits: string[] = [];
    
    benefits.push(`Save development time with ready-to-use ${category}`);
    benefits.push(`Join community of ${repo.stargazers_count} developers`);
    
    if (category === 'template') {
      benefits.push('Start with production-ready code', 'Follow best practices from day one');
    } else if (category === 'sdk') {
      benefits.push('Simplified blockchain interactions', 'Reduced boilerplate code');
    } else if (category === 'security-tool') {
      benefits.push('Catch vulnerabilities early', 'Ensure contract safety');
    }
    
    if (repo.license) {
      benefits.push(`Free and open source under ${repo.license.name}`);
    }
    
    return benefits;
  }

  private determineToolUseCases(category: string): string[] {
    if (category === 'template') {
      return ['Starting new Web3 projects', 'Learning best practices', 'Rapid prototyping'];
    } else if (category === 'sdk') {
      return ['Blockchain integration', 'dApp development', 'Protocol interactions'];
    } else if (category === 'security-tool') {
      return ['Pre-deployment audits', 'Continuous security monitoring', 'Vulnerability scanning'];
    } else if (category === 'testing-tool') {
      return ['Unit testing', 'Integration testing', 'Gas optimization testing'];
    }
    return ['Web3 development', 'Smart contract deployment', 'Blockchain applications'];
  }
}