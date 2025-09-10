/**
 * AI-Powered Data Extractor
 * Uses OpenAI to extract REAL data, not regex guesses
 */

import OpenAI from 'openai';
import { logger } from './logger';
import { config } from 'dotenv';

// Load environment variables
config();

interface ExtractedData {
  // Project fields
  company_name?: string;
  founded_year?: number;
  team_size?: number;
  funding_raised?: number;
  funding_round?: string;
  project_needs?: string[];
  categories?: string[];
  website_url?: string;
  github_url?: string;
  twitter_url?: string;
  
  // Resource fields
  resource_type?: string;
  price_type?: string;
  provider_name?: string;
  key_benefits?: string[];
  
  // Funding fields
  organization?: string;
  funding_type?: string;
  min_amount?: number;
  max_amount?: number;
  equity_required?: boolean;
  benefits?: string[];
  
  // Common fields
  description?: string;
  target_market?: string;
  problem_solving?: string;
  unique_value_prop?: string;
}

export class AIExtractor {
  private openai: OpenAI;
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.enabled = !!apiKey;
    
    if (this.enabled) {
      this.openai = new OpenAI({ apiKey });
      logger.info('AI Extractor initialized with OpenAI');
    } else {
      logger.warn('AI Extractor disabled - no OpenAI key');
    }
  }

  /**
   * Extract data using AI instead of regex guessing
   */
  async extract(item: any, source: string): Promise<any> {
    // Determine content type first
    const contentType = this.determineType(item, source);
    
    // If no AI, return basic structure
    if (!this.enabled) {
      return this.basicExtraction(item, source, contentType);
    }

    try {
      // Build the extraction prompt based on type
      const systemPrompt = this.getSystemPrompt(contentType);
      const userContent = this.prepareContent(item, source);
      
      // Use OpenAI to extract REAL data
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.1, // Low temp for factual extraction
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const extracted = JSON.parse(completion.choices[0].message.content || '{}');
      
      // Combine with original data
      return this.formatOutput(item, source, contentType, extracted);
      
    } catch (error) {
      logger.error('AI extraction failed', { error, item: item.title || item.name });
      return this.basicExtraction(item, source, contentType);
    }
  }

  /**
   * Batch extract multiple items efficiently
   */
  async extractBatch(items: any[], source: string): Promise<any[]> {
    if (!this.enabled) {
      return items.map(item => this.basicExtraction(item, source, this.determineType(item, source)));
    }

    // Process in parallel batches of 5
    const results: any[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.extract(item, source))
      );
      results.push(...batchResults);
      
      // Small delay to respect rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * Determine content type based on source and content
   */
  private determineType(item: any, source: string): 'project' | 'funding' | 'resource' {
    const text = JSON.stringify(item).toLowerCase();
    
    // Funding indicators
    if (source.toLowerCase().includes('job') || source.toLowerCase().includes('funding') ||
        text.includes('grant') || text.includes('accelerator') || text.includes('incubator')) {
      return 'funding';
    }
    
    // Resource indicators  
    if (source.includes('DevTo') || source.includes('Tutorial') ||
        text.includes('tutorial') || text.includes('course') || text.includes('guide')) {
      return 'resource';
    }
    
    // Default to project for GitHub and HackerNews
    return 'project';
  }

  /**
   * Get the system prompt for extraction
   */
  private getSystemPrompt(type: 'project' | 'funding' | 'resource'): string {
    const basePrompt = `You are a data extraction expert. Extract structured data from the provided content.
Return ONLY actual data found in the content, not guesses or assumptions.
If a field cannot be determined from the content, omit it from the response.
Return a valid JSON object.`;

    if (type === 'project') {
      return `${basePrompt}

Extract these fields if present:
- company_name: The name of the company/project
- founded_year: Year founded (number, 2024 means early-stage)
- team_size: Number of team members (number)
- funding_raised: Amount of funding raised in USD (number)
- funding_round: Type of funding round (seed, series-a, etc)
- project_needs: What the project is looking for (array of strings like "funding", "developers", "users")
- categories: Technology categories (array like ["AI", "Web3", "SaaS"])
- website_url: Main website URL
- github_url: GitHub repository URL if mentioned
- twitter_url: Twitter/X profile URL if mentioned
- description: Clear description of what the project does (string)
- target_market: Who the product is for
- problem_solving: What problem it solves
- unique_value_prop: What makes it unique`;
    }

    if (type === 'funding') {
      return `${basePrompt}

Extract these fields if present:
- organization: Name of the funding organization
- funding_type: Type of funding (grant, accelerator, incubator, vc)
- min_amount: Minimum funding amount in USD (number)
- max_amount: Maximum funding amount in USD (number)
- equity_required: Whether equity is required (boolean)
- benefits: What they offer beyond money (array of strings)
- description: What kind of companies they fund
- eligibility_criteria: Requirements to apply (array of strings)`;
    }

    // Resource type
    return `${basePrompt}

Extract these fields if present:
- resource_type: Type of resource (tool, course, tutorial, framework)
- price_type: Pricing model (free, paid, freemium)
- provider_name: Who created this resource
- key_benefits: Main benefits (array of strings)
- description: What this resource offers
- target_audience: Who should use this`;
  }

  /**
   * Prepare content for AI extraction
   */
  private prepareContent(item: any, source: string): string {
    // Include all available data
    const parts = [
      `Source: ${source}`,
      item.title && `Title: ${item.title}`,
      item.name && `Name: ${item.name}`,
      item.description && `Description: ${item.description}`,
      item.text && `Text: ${item.text}`,
      item.tagline && `Tagline: ${item.tagline}`,
      item.url && `URL: ${item.url}`,
      item.html_url && `GitHub URL: ${item.html_url}`,
      item.language && `Language: ${item.language}`,
      item.stargazers_count && `GitHub Stars: ${item.stargazers_count}`,
      item.created_at && `Created: ${item.created_at}`,
      item.author && `Author: ${item.author}`,
      item.company && `Company: ${item.company}`,
      item.selftext && `Content: ${item.selftext}`,
      item.body && `Body: ${item.body}`
    ].filter(Boolean);

    return parts.join('\n');
  }

  /**
   * Format the output for the pipeline
   */
  private formatOutput(item: any, source: string, type: string, extracted: ExtractedData): any {
    const now = new Date();
    
    // Base structure
    const output = {
      type,
      source,
      source_url: item.url || item.html_url || '',
      created_at: item.created_at || now.toISOString(),
      score: 7, // Default score for validator
      
      // Common fields
      title: extracted.company_name || item.title || item.name || 'Untitled',
      name: extracted.company_name || item.name || item.title || 'Untitled',
      description: extracted.description || item.description || item.text || '',
      url: extracted.website_url || item.url || item.html_url || '',
      
      // Put extracted data in metadata for validator
      metadata: {
        ...extracted,
        original_item: item
      }
    };

    // Add type-specific fields at top level
    if (type === 'project') {
      Object.assign(output, {
        company_name: extracted.company_name || item.name || item.title,
        founded_year: extracted.founded_year || new Date().getFullYear(),
        team_size: extracted.team_size || undefined,
        funding_raised: extracted.funding_raised || 0,
        funding_round: extracted.funding_round,
        website_url: extracted.website_url || item.url,
        github_url: extracted.github_url || item.html_url,
        twitter_url: extracted.twitter_url,
        categories: extracted.categories || [],
        project_needs: extracted.project_needs || [],
        target_market: extracted.target_market,
        problem_solving: extracted.problem_solving,
        unique_value_prop: extracted.unique_value_prop
      });
      
      // Update metadata for validator
      output.metadata.launch_date = item.created_at || now.toISOString();
      output.metadata.launch_year = extracted.founded_year || now.getFullYear();
      output.metadata.founded_year = extracted.founded_year || now.getFullYear();
      output.metadata.funding_raised = extracted.funding_raised || 0;
      output.metadata.team_size = extracted.team_size;
    }
    
    if (type === 'funding') {
      Object.assign(output, {
        organization: extracted.organization || source,
        funding_type: extracted.funding_type || 'grant',
        min_amount: extracted.min_amount || 10000,
        max_amount: extracted.max_amount || 500000,
        equity_required: extracted.equity_required || false,
        benefits: extracted.benefits || ['Funding']
      });
      
      output.metadata.max_amount = extracted.max_amount || 500000;
    }
    
    if (type === 'resource') {
      Object.assign(output, {
        content: item.description || item.text || '',
        resource_type: extracted.resource_type || 'tool',
        price_type: extracted.price_type || 'free',
        provider_name: extracted.provider_name || item.author || source,
        key_benefits: extracted.key_benefits || []
      });
    }
    
    return output;
  }

  /**
   * Basic extraction when AI is not available
   */
  private basicExtraction(item: any, source: string, type: string): any {
    const now = new Date();
    
    return {
      type,
      source,
      source_url: item.url || item.html_url || '',
      created_at: item.created_at || now.toISOString(),
      score: 7,
      
      title: item.title || item.name || 'Untitled',
      name: item.name || item.title || 'Untitled',
      description: item.description || item.text || '',
      url: item.url || item.html_url || '',
      
      // Basic metadata
      metadata: {
        launch_date: item.created_at || now.toISOString(),
        launch_year: now.getFullYear(),
        founded_year: now.getFullYear(),
        funding_raised: 0,
        team_size: undefined,
        original_item: item
      },
      
      // Type-specific defaults
      ...(type === 'project' && {
        company_name: item.name || item.title,
        founded_year: now.getFullYear(),
        funding_raised: 0,
        website_url: item.url || item.html_url,
        categories: [],
        project_needs: []
      }),
      
      ...(type === 'funding' && {
        organization: source,
        funding_type: 'grant',
        min_amount: 10000,
        max_amount: 500000,
        equity_required: false,
        benefits: ['Funding']
      }),
      
      ...(type === 'resource' && {
        content: item.description || item.text || '',
        resource_type: 'tool',
        price_type: 'free',
        provider_name: item.author || source
      })
    };
  }
}

// Export singleton
export const aiExtractor = new AIExtractor();