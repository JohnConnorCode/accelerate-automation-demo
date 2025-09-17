/**
 * ENRICHMENT ORCHESTRATOR SERVICE
 * Enriches existing database entries with missing data from multiple sources
 * Validates, cross-references, and improves data quality
 */

import { createClient } from '@supabase/supabase-js';
import { Octokit } from '@octokit/rest';
import axios from 'axios';
import OpenAI from 'openai';
import { z } from 'zod';

// Initialize clients - use environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Enrichment result schema
const EnrichmentResultSchema = z.object({
  id: z.string(),
  original_data: z.record(z.any()),
  enriched_fields: z.record(z.any()),
  confidence_scores: z.record(z.number()),
  sources_used: z.array(z.string()),
  validation_status: z.enum(['valid', 'needs_review', 'invalid']),
  discrepancies: z.array(z.object({
    field: z.string(),
    sources: z.record(z.any()),
    recommendation: z.string()
  })),
  timestamp: z.string()
});

type EnrichmentResult = z.infer<typeof EnrichmentResultSchema>;

export class EnrichmentOrchestrator {
  private stats = {
    processed: 0,
    enriched: 0,
    failed: 0,
    fields_added: 0
  };

  /**
   * Main enrichment pipeline for all content types
   */
  async enrichAll(limit: number = 100): Promise<{
    projects: EnrichmentResult[];
    funding: EnrichmentResult[];
    resources: EnrichmentResult[];
    stats: typeof this.stats;
  }> {
    console.log('🔄 Starting enrichment pipeline...');
    
    const results = {
      projects: await this.enrichProjects(limit),
      funding: await this.enrichFundingPrograms(limit),
      resources: await this.enrichResources(limit),
      stats: this.stats
    };

    console.log(`✅ Enrichment complete: ${this.stats.enriched} items enriched, ${this.stats.fields_added} fields added`);
    return results;
  }

  /**
   * Enrich project entries with missing data
   */
  async enrichProjects(limit: number = 100): Promise<EnrichmentResult[]> {
    console.log('📦 Enriching projects...');
    
    // Fetch projects needing enrichment (missing key fields)
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .or('description.is.null,description.lt.500')
      .limit(limit);

    if (error || !projects) {
      console.error('Failed to fetch projects:', error);
      return [];
    }

    const enrichedProjects: EnrichmentResult[] = [];

    for (const project of projects) {
      try {
        const enriched = await this.enrichSingleProject(project);
        enrichedProjects.push(enriched);
        this.stats.processed++;
        
        if (Object.keys(enriched.enriched_fields).length > 0) {
          this.stats.enriched++;
          this.stats.fields_added += Object.keys(enriched.enriched_fields).length;
          
          // Update database with enriched data
          await this.updateProjectInDB(project.id, enriched.enriched_fields);
        }
      } catch (error) {
        console.error(`Failed to enrich project ${project.name}:`, error);
        this.stats.failed++;
      }
    }

    return enrichedProjects;
  }

  /**
   * Enrich a single project with data from multiple sources
   */
  private async enrichSingleProject(project: any): Promise<EnrichmentResult> {
    const enrichedFields: Record<string, any> = {};
    const confidenceScores: Record<string, number> = {};
    const sourcesUsed: string[] = [];
    const discrepancies: any[] = [];

    // 1. GitHub enrichment
    if (project.github_url) {
      const githubData = await this.enrichFromGitHub(project.github_url);
      if (githubData) {
        sourcesUsed.push('github');
        
        // Estimate team size from contributors
        if (!project.team_size && githubData.contributors) {
          enrichedFields.team_size = Math.min(githubData.contributors.length, 10);
          confidenceScores.team_size = githubData.contributors.length > 20 ? 0.7 : 0.9;
        }
        
        // Get launch date from first commit
        if (!project.launch_date && githubData.created_at) {
          enrichedFields.launch_date = githubData.created_at;
          confidenceScores.launch_date = 0.95;
        }
        
        // Extract social links from README
        if (githubData.readme) {
          const socialLinks = this.extractSocialLinks(githubData.readme);
          if (!project.twitter_url && socialLinks.twitter) {
            enrichedFields.twitter_url = socialLinks.twitter;
            confidenceScores.twitter_url = 0.8;
          }
          if (!project.discord_url && socialLinks.discord) {
            enrichedFields.discord_url = socialLinks.discord;
            confidenceScores.discord_url = 0.8;
          }
        }
        
        // Enhance description if too short
        if (!project.description || project.description.length < 500) {
          const enhancedDesc = await this.enhanceDescription(project, githubData);
          if (enhancedDesc) {
            enrichedFields.description = enhancedDesc;
            confidenceScores.description = 0.85;
          }
        }
      }
    }

    // 2. AI-powered extraction from existing description
    if (openai && project.description) {
      const extracted = await this.extractWithAI(project.description);
      if (extracted) {
        sourcesUsed.push('ai_extraction');
        
        // Extract funding amount if mentioned
        if (!project.funding_raised && extracted.funding_amount) {
          enrichedFields.funding_raised = extracted.funding_amount;
          confidenceScores.funding_raised = 0.7;
        }
        
        // Extract team size if mentioned
        if (!project.team_size && extracted.team_size) {
          // Check for conflicts with GitHub data
          if (enrichedFields.team_size && enrichedFields.team_size !== extracted.team_size) {
            discrepancies.push({
              field: 'team_size',
              sources: { github: enrichedFields.team_size, ai: extracted.team_size },
              recommendation: 'Use GitHub contributor count as more reliable'
            });
          } else {
            enrichedFields.team_size = extracted.team_size;
            confidenceScores.team_size = 0.6;
          }
        }
        
        // Extract categories
        if (extracted.categories && extracted.categories.length > 0) {
          enrichedFields.categories = extracted.categories;
          confidenceScores.categories = 0.8;
        }
      }
    }

    // 3. Website validation and enrichment
    if (project.website_url) {
      const isValid = await this.validateURL(project.website_url);
      enrichedFields.website_validated = isValid;
      confidenceScores.website_validated = 1.0;
      
      if (isValid) {
        sourcesUsed.push('website');
        // Could scrape additional data from website here
      }
    }

    // 4. Calculate overall project status
    const projectAge = project.created_at ? 
      (Date.now() - new Date(project.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000) : 0;
    
    if (!project.development_status) {
      if (projectAge < 3) {
        enrichedFields.development_status = 'early';
      } else if (projectAge < 12) {
        enrichedFields.development_status = 'active';
      } else {
        enrichedFields.development_status = 'mature';
      }
      confidenceScores.development_status = 0.7;
    }

    // Determine validation status
    const avgConfidence = Object.values(confidenceScores).reduce((a, b) => a + b, 0) / 
                         (Object.values(confidenceScores).length || 1);
    
    const validationStatus = discrepancies.length > 0 ? 'needs_review' :
                            avgConfidence > 0.8 ? 'valid' : 'needs_review';

    return {
      id: project.id,
      original_data: project,
      enriched_fields: enrichedFields,
      confidence_scores: confidenceScores,
      sources_used: sourcesUsed,
      validation_status: validationStatus,
      discrepancies: discrepancies,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enrich from GitHub API
   */
  private async enrichFromGitHub(githubUrl: string): Promise<any> {
    try {
      const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) {return null;}
      
      const [_, owner, repo] = match;
      
      // Get repository data
      const { data: repoData } = await octokit.repos.get({ owner, repo });
      
      // Get contributors
      const { data: contributors } = await octokit.repos.listContributors({ 
        owner, 
        repo,
        per_page: 100 
      });
      
      // Get README
      let readme = '';
      try {
        const { data: readmeData } = await octokit.repos.getReadme({ owner, repo });
        readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      } catch (e) {
        // No README
      }
      
      return {
        created_at: repoData.created_at,
        updated_at: repoData.updated_at,
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        contributors: contributors,
        language: repoData.language,
        topics: repoData.topics,
        readme: readme,
        description: repoData.description
      };
    } catch (error) {
      console.error('GitHub enrichment failed:', error);
      return null;
    }
  }

  /**
   * Extract social links from text
   */
  private extractSocialLinks(text: string): Record<string, string> {
    const links: Record<string, string> = {};
    
    // Twitter/X
    const twitterMatch = text.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i);
    if (twitterMatch) {
      links.twitter = `https://twitter.com/${twitterMatch[1]}`;
    }
    
    // Discord
    const discordMatch = text.match(/discord\.(?:gg|com\/invite)\/([a-zA-Z0-9]+)/i);
    if (discordMatch) {
      links.discord = `https://discord.gg/${discordMatch[1]}`;
    }
    
    // Telegram
    const telegramMatch = text.match(/t\.me\/([a-zA-Z0-9_]+)/i);
    if (telegramMatch) {
      links.telegram = `https://t.me/${telegramMatch[1]}`;
    }
    
    // LinkedIn
    const linkedinMatch = text.match(/linkedin\.com\/company\/([a-zA-Z0-9-]+)/i);
    if (linkedinMatch) {
      links.linkedin = `https://linkedin.com/company/${linkedinMatch[1]}`;
    }
    
    return links;
  }

  /**
   * Use AI to extract structured data from description
   */
  private async extractWithAI(description: string): Promise<any> {
    if (!openai) {return null;}
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `Extract structured data from project descriptions. Return JSON only with these fields:
            - funding_amount: number (in USD, null if not mentioned)
            - funding_round: string (seed, pre-seed, series-a, etc., null if not mentioned)
            - team_size: number (null if not mentioned)
            - categories: string[] (DeFi, NFT, Infrastructure, Gaming, etc.)
            - stage: string (idea, mvp, beta, launched, null if unclear)
            - is_seeking_funding: boolean
            - is_seeking_cofounders: boolean`
          },
          {
            role: 'user',
            content: description
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });
      
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      console.error('AI extraction failed:', error);
      return null;
    }
  }

  /**
   * Enhance short descriptions with more detail
   */
  private async enhanceDescription(project: any, githubData: any): Promise<string> {
    const parts = [];
    
    // Start with existing description
    if (project.description) {
      parts.push(project.description);
    } else if (githubData.description) {
      parts.push(githubData.description);
    }
    
    // Add GitHub insights
    if (githubData) {
      const created = new Date(githubData.created_at);
      const monthsOld = (Date.now() - created.getTime()) / (30 * 24 * 60 * 60 * 1000);
      
      parts.push(`This project was launched ${Math.round(monthsOld)} months ago and has gained ${githubData.stars} stars on GitHub.`);
      
      if (githubData.contributors.length > 0) {
        parts.push(`The team consists of ${Math.min(githubData.contributors.length, 10)}+ contributors actively developing the project.`);
      }
      
      if (githubData.language) {
        parts.push(`Built primarily with ${githubData.language}.`);
      }
      
      if (githubData.topics && githubData.topics.length > 0) {
        parts.push(`Focus areas include: ${githubData.topics.slice(0, 5).join(', ')}.`);
      }
    }
    
    // Add project needs if available
    if (project.project_needs && project.project_needs.length > 0) {
      const needs = project.project_needs.map((n: string) => {
        switch(n) {
          case 'funding': return 'seeking funding';
          case 'developers': return 'hiring developers';
          case 'marketing': return 'looking for marketing support';
          default: return n;
        }
      });
      parts.push(`The project is currently ${needs.join(', ')}.`);
    }
    
    // Add call to action
    parts.push('This represents an opportunity for early supporters and contributors to get involved at the ground level.');
    
    return parts.join(' ').substring(0, 1000);
  }

  /**
   * Validate URL is active
   */
  private async validateURL(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { 
        timeout: 5000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update project in database with enriched fields
   */
  private async updateProjectInDB(projectId: string, enrichedFields: Record<string, any>): Promise<void> {
    // Map enriched fields to database columns
    const updateData: any = {};
    
    if (enrichedFields.description) {updateData.description = enrichedFields.description;}
    if (enrichedFields.twitter_url) {updateData.twitter_url = enrichedFields.twitter_url;}
    if (enrichedFields.discord_url) {updateData.discord_url = enrichedFields.discord_url;}
    // Note: team_size, launch_date, funding_raised columns may not exist yet
    
    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);
      
      if (error) {
        console.error(`Failed to update project ${projectId}:`, error);
      }
    }
    
    // Store full enrichment data in a separate table or JSON column
    await this.logEnrichment(projectId, 'project', enrichedFields);
  }

  /**
   * Enrich funding programs
   */
  async enrichFundingPrograms(limit: number = 100): Promise<EnrichmentResult[]> {
    console.log('💰 Enriching funding programs...');
    
    const { data: programs, error } = await supabase
      .from('funding_programs')
      .select('*')
      .limit(limit);

    if (error || !programs) {
      console.error('Failed to fetch funding programs:', error);
      return [];
    }

    const enrichedPrograms: EnrichmentResult[] = [];

    for (const program of programs) {
      try {
        const enrichedFields: Record<string, any> = {};
        const confidenceScores: Record<string, number> = {};
        const sourcesUsed: string[] = ['validation'];
        
        // Validate application URL
        if (program.application_url) {
          const isValid = await this.validateURL(program.application_url);
          enrichedFields.application_url_valid = isValid;
          confidenceScores.application_url_valid = 1.0;
          
          if (!isValid) {
            enrichedFields.status = 'inactive';
            confidenceScores.status = 0.9;
          }
        }
        
        // Check if deadline has passed
        if (program.application_deadline) {
          const deadline = new Date(program.application_deadline);
          if (deadline < new Date()) {
            enrichedFields.status = 'expired';
            confidenceScores.status = 1.0;
          }
        }
        
        const result: EnrichmentResult = {
          id: program.id,
          original_data: program,
          enriched_fields: enrichedFields,
          confidence_scores: confidenceScores,
          sources_used: sourcesUsed,
          validation_status: 'valid',
          discrepancies: [],
          timestamp: new Date().toISOString()
        };
        
        enrichedPrograms.push(result);
        
        if (Object.keys(enrichedFields).length > 0) {
          this.stats.enriched++;
          this.stats.fields_added += Object.keys(enrichedFields).length;
        }
      } catch (error) {
        console.error(`Failed to enrich funding program ${program.name}:`, error);
        this.stats.failed++;
      }
    }

    return enrichedPrograms;
  }

  /**
   * Enrich resources
   */
  async enrichResources(limit: number = 100): Promise<EnrichmentResult[]> {
    console.log('📚 Enriching resources...');
    
    const { data: resources, error } = await supabase
      .from('resources')
      .select('*')
      .limit(limit);

    if (error || !resources) {
      console.error('Failed to fetch resources:', error);
      return [];
    }

    const enrichedResources: EnrichmentResult[] = [];

    for (const resource of resources) {
      try {
        const enrichedFields: Record<string, any> = {};
        const confidenceScores: Record<string, number> = {};
        const sourcesUsed: string[] = ['validation'];
        
        // Validate resource URL
        if (resource.url) {
          const isValid = await this.validateURL(resource.url);
          enrichedFields.url_valid = isValid;
          confidenceScores.url_valid = 1.0;
          
          if (!isValid) {
            enrichedFields.status = 'broken';
            confidenceScores.status = 1.0;
          }
        }
        
        // Determine freshness
        if (resource.created_at) {
          const monthsOld = (Date.now() - new Date(resource.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000);
          if (monthsOld > 6) {
            enrichedFields.freshness = 'outdated';
            confidenceScores.freshness = 0.9;
          } else if (monthsOld > 3) {
            enrichedFields.freshness = 'recent';
            confidenceScores.freshness = 0.9;
          } else {
            enrichedFields.freshness = 'fresh';
            confidenceScores.freshness = 0.9;
          }
        }
        
        const result: EnrichmentResult = {
          id: resource.id,
          original_data: resource,
          enriched_fields: enrichedFields,
          confidence_scores: confidenceScores,
          sources_used: sourcesUsed,
          validation_status: 'valid',
          discrepancies: [],
          timestamp: new Date().toISOString()
        };
        
        enrichedResources.push(result);
        
        if (Object.keys(enrichedFields).length > 0) {
          this.stats.enriched++;
          this.stats.fields_added += Object.keys(enrichedFields).length;
        }
      } catch (error) {
        console.error(`Failed to enrich resource ${resource.title}:`, error);
        this.stats.failed++;
      }
    }

    return enrichedResources;
  }

  /**
   * Log enrichment history
   */
  private async logEnrichment(itemId: string, itemType: string, enrichedFields: Record<string, any>): Promise<void> {
    const { error } = await supabase
      .from('enrichment_logs')
      .insert({
        item_id: itemId,
        item_type: itemType,
        enriched_fields: enrichedFields,
        enriched_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Failed to log enrichment:', error);
    }
  }

  /**
   * Get enrichment statistics
   */
  getStats() {
    return this.stats;
  }
}