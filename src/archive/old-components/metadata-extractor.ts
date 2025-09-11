/**
 * Metadata Extractor Service
 * Extracts ACCELERATE-relevant metadata from raw content
 */

export class MetadataExtractor {
  /**
   * Extract metadata from HackerNews Show HN posts
   */
  static extractFromHackerNews(item: any): any {
    const text = `${item.title || ''} ${item.text || ''}`.toLowerCase();
    const created = new Date(item.created_at || item.created_at_i * 1000);
    
    return {
      // Basic fields
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      description: item.text || item.title || '',
      type: 'project' as const,
      source: 'HackerNews',
      created_at: created.toISOString(),
      score: 7.5,  // Default good score for HN items
      
      // ACCELERATE metadata
      metadata: {
        launch_date: created.toISOString(),
        launch_year: created.getFullYear(),
        
        // Try to extract funding info from text
        funding_raised: this.extractFundingAmount(text),
        seeking_funding: text.includes('looking for funding') || 
                        text.includes('raising') || 
                        text.includes('seed round'),
        
        // Try to extract team size
        team_size: this.extractTeamSize(text) || 2, // Default to small team
        
        // Extract tech stack
        tech_stack: this.extractTechStack(text),
        
        // HN specific
        author: item.author,
        points: item.points || 0,
        comments: item.num_comments || 0,
        hn_id: item.objectID
      }
    };
  }

  /**
   * Extract metadata from GitHub repositories
   */
  static extractFromGitHub(item: any): any {
    const created = new Date(item.created_at);
    
    return {
      // Basic fields
      title: item.name,
      name: item.name,
      url: item.html_url,
      description: item.description || `${item.name} - A GitHub project`,
      type: 'project' as const,
      source: 'GitHub',
      created_at: created.toISOString(),
      score: 7.0,  // Default good score for GitHub items
      
      // ACCELERATE metadata
      metadata: {
        launch_date: created.toISOString(),
        launch_year: created.getFullYear(),
        
        // GitHub repos are usually unfunded
        funding_raised: 0,
        seeking_funding: false,
        
        // Team size based on contributors
        team_size: item.contributors_count || 1,
        
        // Tech stack from language
        tech_stack: item.language ? [item.language] : [],
        
        // GitHub specific
        stars: item.stargazers_count || 0,
        forks: item.forks_count || 0,
        open_issues: item.open_issues_count || 0,
        language: item.language,
        owner: item.owner?.login,
        license: item.license?.name,
        topics: item.topics || []
      }
    };
  }

  /**
   * Extract funding amount from text
   */
  private static extractFundingAmount(text: string): number {
    // Look for funding patterns
    const patterns = [
      /\$(\d+)k/i,  // $100k
      /\$(\d+)m/i,  // $1m
      /raised (\d+)/i,
      /funding.*?(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        let amount = parseInt(match[1]);
        if (text.includes('k')) amount *= 1000;
        if (text.includes('m')) amount *= 1000000;
        return amount;
      }
    }
    
    // No funding mentioned - good for ACCELERATE!
    return 0;
  }

  /**
   * Extract team size from text
   */
  private static extractTeamSize(text: string): number | undefined {
    // Look for team size patterns
    const patterns = [
      /team of (\d+)/i,
      /(\d+) people/i,
      /(\d+) engineers/i,
      /(\d+) developers/i,
      /(\d+)-person/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    // Check for solo founder indicators
    if (text.includes('solo') || text.includes('i built') || text.includes("i've built")) {
      return 1;
    }
    
    // Check for small team indicators
    if (text.includes('we built') || text.includes("we've built")) {
      return 2; // Assume small team
    }
    
    return undefined;
  }

  /**
   * Extract tech stack from text
   */
  private static extractTechStack(text: string): string[] {
    const technologies = [
      'react', 'vue', 'angular', 'svelte',
      'node', 'python', 'ruby', 'go', 'rust',
      'typescript', 'javascript', 'java', 'c++',
      'postgresql', 'mysql', 'mongodb', 'redis',
      'aws', 'gcp', 'azure', 'vercel', 'netlify',
      'docker', 'kubernetes', 'terraform',
      'next.js', 'nuxt', 'gatsby', 'remix',
      'supabase', 'firebase', 'prisma',
      'blockchain', 'ethereum', 'solana', 'bitcoin'
    ];
    
    const found: string[] = [];
    for (const tech of technologies) {
      if (text.includes(tech)) {
        found.push(tech);
      }
    }
    
    return found;
  }

  /**
   * Process any content item
   */
  static extract(item: any, source: string): any {
    if (source.toLowerCase().includes('hackernews')) {
      return this.extractFromHackerNews(item);
    } else if (source.toLowerCase().includes('github')) {
      return this.extractFromGitHub(item);
    }
    
    // Default extraction
    return {
      ...item,
      metadata: {
        launch_date: item.created_at || new Date().toISOString(),
        launch_year: new Date(item.created_at || Date.now()).getFullYear(),
        funding_raised: 0,
        team_size: 2,
        ...item.metadata
      }
    };
  }
}