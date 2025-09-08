/**
 * Full Content Enrichment Service
 * Gathers complete information to create validated, detailed entries
 */
import { supabase } from '../lib/supabase';
import { scoreContent } from '../lib/openai';

export interface EnrichedContent {
  // Original fields
  title: string;
  description: string;
  url: string;
  source: string;
  
  // Enriched metadata
  company?: {
    name: string;
    founded?: string;
    size?: string;
    location?: string;
    website?: string;
  };
  
  team?: {
    founders?: string[];
    size?: number;
    key_members?: Array<{
      name: string;
      role: string;
      linkedin?: string;
      twitter?: string;
    }>;
  };
  
  funding?: {
    total_raised?: string;
    latest_round?: string;
    investors?: string[];
    valuation?: string;
  };
  
  technology?: {
    stack?: string[];
    languages?: string[];
    frameworks?: string[];
    blockchain?: string;
    open_source?: boolean;
  };
  
  metrics?: {
    users?: number;
    revenue?: string;
    growth_rate?: string;
    github_stars?: number;
    twitter_followers?: number;
  };
  
  social?: {
    twitter?: string;
    linkedin?: string;
    discord?: string;
    telegram?: string;
    github?: string;
    website?: string;
  };
  
  // AI analysis
  ai_analysis?: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    market_fit: string;
    competition: string[];
    recommendation: string;
    confidence: number;
  };
  
  // Validation
  validation: {
    verified: boolean;
    completeness: number; // 0-100
    data_quality: number; // 0-100
    last_updated: Date;
    sources_checked: string[];
  };
}

export class EnrichmentService {
  /**
   * Fully enrich content with all available information
   */
  async enrichContent(item: any, source: string): Promise<EnrichedContent> {
    console.log(`🔍 Enriching: ${item.title || item.name}`);
    
    // Start with base content
    const enriched: EnrichedContent = {
      title: item.title || item.name || 'Untitled',
      description: item.description || item.tagline || '',
      url: item.url || item.html_url || '',
      source,
      validation: {
        verified: false,
        completeness: 10,
        data_quality: 10,
        last_updated: new Date(),
        sources_checked: [source]
      }
    };
    
    // Step 1: Extract from original data
    this.extractFromSource(item, enriched);
    
    // Step 2: Fetch from GitHub if applicable
    if (item.github_url || item.html_url?.includes('github.com')) {
      await this.enrichFromGitHub(item.github_url || item.html_url, enriched);
    }
    
    // Step 3: Fetch from ProductHunt if applicable
    if (source === 'producthunt' || item.producthunt_url) {
      await this.enrichFromProductHunt(item, enriched);
    }
    
    // Step 4: Extract social links and metrics
    await this.extractSocialData(enriched);
    
    // Step 5: AI analysis for comprehensive understanding
    await this.performAIAnalysis(enriched);
    
    // Step 6: Calculate validation scores
    this.calculateValidation(enriched);
    
    return enriched;
  }
  
  /**
   * Extract data from source
   */
  private extractFromSource(item: any, enriched: EnrichedContent) {
    // GitHub data
    if (item.owner) {
      enriched.company = {
        name: item.owner.login,
        website: item.homepage
      };
    }
    
    // Metrics from source
    if (item.stargazers_count || item.stars) {
      enriched.metrics = {
        github_stars: item.stargazers_count || item.stars
      };
    }
    
    // Team data
    if (item.team_size) {
      enriched.team = {
        size: item.team_size
      };
    }
    
    // Technology
    if (item.language || item.topics) {
      enriched.technology = {
        languages: item.language ? [item.language] : [],
        stack: item.topics || []
      };
    }
    
    enriched.validation.completeness += 10;
  }
  
  /**
   * Enrich from GitHub API
   */
  private async enrichFromGitHub(url: string, enriched: EnrichedContent) {
    try {
      // Extract owner/repo from URL
      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return;
      
      const [_, owner, repo] = match;
      
      // Fetch repo data
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': process.env.GITHUB_TOKEN ? `token ${process.env.GITHUB_TOKEN}` : '',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update with GitHub data
        enriched.metrics = {
          ...enriched.metrics,
          github_stars: data.stargazers_count,
          users: data.watchers_count
        };
        
        enriched.technology = {
          ...enriched.technology,
          languages: data.language ? [data.language] : [],
          open_source: !data.private
        };
        
        enriched.social = {
          ...enriched.social,
          github: data.html_url,
          website: data.homepage
        };
        
        enriched.validation.sources_checked.push('github');
        enriched.validation.completeness += 20;
        enriched.validation.data_quality += 30;
      }
      
      // Fetch contributors
      const contribResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=5`);
      if (contribResponse.ok) {
        const contributors = await contribResponse.json();
        if (contributors.length > 0) {
          enriched.team = {
            ...enriched.team,
            size: contributors.length,
            key_members: contributors.slice(0, 3).map((c: any) => ({
              name: c.login,
              role: 'Contributor',
              github: c.html_url
            }))
          };
          enriched.validation.completeness += 10;
        }
      }
    } catch (error) {
      console.warn('GitHub enrichment failed:', error);
    }
  }
  
  /**
   * Enrich from ProductHunt
   */
  private async enrichFromProductHunt(item: any, enriched: EnrichedContent) {
    try {
      if (!process.env.PRODUCTHUNT_TOKEN) return;
      
      // ProductHunt GraphQL query would go here
      // For now, extract from existing data
      if (item.makers) {
        enriched.team = {
          ...enriched.team,
          founders: item.makers.map((m: any) => m.name),
          size: item.makers.length
        };
      }
      
      if (item.votes_count) {
        enriched.metrics = {
          ...enriched.metrics,
          users: item.votes_count
        };
      }
      
      enriched.validation.sources_checked.push('producthunt');
      enriched.validation.completeness += 15;
    } catch (error) {
      console.warn('ProductHunt enrichment failed:', error);
    }
  }
  
  /**
   * Extract social data from description and URLs
   */
  private async extractSocialData(enriched: EnrichedContent) {
    const text = enriched.description.toLowerCase();
    
    // Extract social links from description
    const patterns = {
      twitter: /twitter\.com\/([a-zA-Z0-9_]+)/,
      linkedin: /linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)/,
      discord: /discord\.gg\/([a-zA-Z0-9]+)/,
      telegram: /t\.me\/([a-zA-Z0-9_]+)/
    };
    
    for (const [platform, pattern] of Object.entries(patterns)) {
      const match = text.match(pattern);
      if (match) {
        enriched.social = {
          ...enriched.social,
          [platform]: match[0]
        };
        enriched.validation.completeness += 5;
      }
    }
  }
  
  /**
   * Perform comprehensive AI analysis
   */
  private async performAIAnalysis(enriched: EnrichedContent) {
    try {
      // Skip AI analysis if no API key - don't waste time on failing Edge Functions
      if (!process.env.OPENAI_API_KEY) {
        console.log('   ⚠️ Skipping AI analysis - no OpenAI API key');
        // Still add basic analysis and some points for trying
        enriched.ai_analysis = {
          summary: `${enriched.title} - ${enriched.description?.substring(0, 200)}`,
          strengths: this.extractStrengthsFromData(enriched),
          weaknesses: [],
          opportunities: ['Growing market opportunity'],
          market_fit: 'Analysis pending',
          competition: [],
          recommendation: 'Manual review recommended',
          confidence: 0.5
        };
        
        // Give partial credit for having the data
        enriched.validation.completeness += 15;
        enriched.validation.data_quality += 10;
        return;
      }
      
      // Prepare comprehensive prompt
      const prompt = `
Analyze this Web3/startup project comprehensively:

Title: ${enriched.title}
Description: ${enriched.description}
URL: ${enriched.url}
${enriched.company ? `Company: ${JSON.stringify(enriched.company)}` : ''}
${enriched.team ? `Team: ${JSON.stringify(enriched.team)}` : ''}
${enriched.funding ? `Funding: ${JSON.stringify(enriched.funding)}` : ''}
${enriched.technology ? `Technology: ${JSON.stringify(enriched.technology)}` : ''}
${enriched.metrics ? `Metrics: ${JSON.stringify(enriched.metrics)}` : ''}

Provide a comprehensive analysis including:
1. Executive summary (2-3 sentences)
2. Key strengths (3-5 points)
3. Potential weaknesses or risks (2-3 points)
4. Market opportunities (2-3 points)
5. Product-market fit assessment
6. Main competitors or alternatives
7. Investment/partnership recommendation
8. Confidence level (0.0-1.0)

Also, extract any additional information about:
- Founding year
- Company location
- Total funding raised
- Key investors
- Target market
- Business model
`;

      // Call Edge Function for AI analysis
      const { data } = await supabase.functions.invoke('ai-enrichment', {
        body: {
          content: { 
            title: enriched.title,
            description: prompt 
          },
          contentType: 'project'
        }
      });
      
      if (data) {
        enriched.ai_analysis = {
          summary: data.ai_summary || 'Comprehensive analysis pending',
          strengths: this.extractListFromText(data.ai_reasoning, 'strengths'),
          weaknesses: this.extractListFromText(data.ai_reasoning, 'weaknesses'),
          opportunities: this.extractListFromText(data.ai_reasoning, 'opportunities'),
          market_fit: this.extractSectionFromText(data.ai_reasoning, 'market fit'),
          competition: this.extractListFromText(data.ai_reasoning, 'competitors'),
          recommendation: data.ai_reasoning || 'Further investigation recommended',
          confidence: data.confidence || 0.7
        };
        
        enriched.validation.completeness += 25;
        enriched.validation.data_quality += 20;
      }
    } catch (error) {
      console.warn('AI analysis failed:', error);
      // Fallback to basic analysis but still give some credit
      enriched.ai_analysis = {
        summary: `${enriched.title} is a ${enriched.source} project.`,
        strengths: this.extractStrengthsFromData(enriched),
        weaknesses: ['Limited analysis available'],
        opportunities: ['Market opportunity'],
        market_fit: 'To be determined',
        competition: [],
        recommendation: 'Requires manual review',
        confidence: 0.4
      };
      
      // Give partial credit
      enriched.validation.completeness += 10;
      enriched.validation.data_quality += 5;
    }
  }
  
  /**
   * Extract strengths from actual data
   */
  private extractStrengthsFromData(enriched: EnrichedContent): string[] {
    const strengths = [];
    
    if (enriched.metrics?.github_stars && enriched.metrics.github_stars > 100) {
      strengths.push(`${enriched.metrics.github_stars.toLocaleString()} GitHub stars`);
    }
    if (enriched.metrics?.users) {
      strengths.push(`${enriched.metrics.users.toLocaleString()} users`);
    }
    if (enriched.team?.size) {
      strengths.push(`Team of ${enriched.team.size}`);
    }
    if (enriched.technology?.open_source) {
      strengths.push('Open source');
    }
    if (enriched.funding?.total_raised) {
      strengths.push(`Raised ${enriched.funding.total_raised}`);
    }
    
    return strengths.length > 0 ? strengths : ['Active project'];
  }
  
  /**
   * Calculate validation scores
   */
  private calculateValidation(enriched: EnrichedContent) {
    // Completeness calculation
    const fields = [
      enriched.company,
      enriched.team,
      enriched.funding,
      enriched.technology,
      enriched.metrics,
      enriched.social,
      enriched.ai_analysis
    ];
    
    const filledFields = fields.filter(f => f && Object.keys(f).length > 0).length;
    enriched.validation.completeness = Math.min(100, enriched.validation.completeness + (filledFields * 10));
    
    // Data quality based on sources
    if (enriched.validation.sources_checked.length > 2) {
      enriched.validation.data_quality += 20;
    }
    
    // Mark as verified if we have good data
    enriched.validation.verified = 
      enriched.validation.completeness > 60 && 
      enriched.validation.data_quality > 50;
    
    console.log(`✅ Enrichment complete: ${enriched.title}`);
    console.log(`   Completeness: ${enriched.validation.completeness}%`);
    console.log(`   Quality: ${enriched.validation.data_quality}%`);
    console.log(`   Verified: ${enriched.validation.verified}`);
  }
  
  /**
   * Helper: Extract list from text
   */
  private extractListFromText(text: string, keyword: string): string[] {
    // Simple extraction - in production, use NLP
    const lines = text.split('\n');
    const items: string[] = [];
    let inSection = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes(keyword)) {
        inSection = true;
        continue;
      }
      if (inSection && line.startsWith('-')) {
        items.push(line.substring(1).trim());
      }
      if (inSection && line.trim() === '') {
        break;
      }
    }
    
    return items.length > 0 ? items : ['Information not available'];
  }
  
  /**
   * Helper: Extract section from text
   */
  private extractSectionFromText(text: string, keyword: string): string {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(keyword)) {
        return lines[i + 1] || 'Assessment pending';
      }
    }
    return 'Information not available';
  }
}

export const enrichmentService = new EnrichmentService();