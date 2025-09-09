/**
 * Staging Service - Manages insertion into staging tables
 * Routes content to appropriate staging table based on type
 */

import { supabase } from '../lib/supabase-client';

export interface StagingItem {
  title?: string;
  name?: string;
  description?: string;
  url: string;
  source: string;
  type: 'project' | 'funding' | 'resource';
  score: number;
  metadata?: any;
  ai_summary?: string;
  [key: string]: any;
}

export class StagingService {
  /**
   * Insert items into appropriate staging tables
   */
  async insertToStaging(items: StagingItem[]): Promise<{
    success: boolean;
    inserted: { projects: number; funding: number; resources: number };
    errors: string[];
  }> {
    const result = {
      success: true,
      inserted: { projects: 0, funding: 0, resources: 0 },
      errors: [] as string[]
    };

    // Group items by type
    const grouped = this.groupByType(items);

    // Insert projects
    if (grouped.projects.length > 0) {
      const { count, error } = await this.insertProjects(grouped.projects);
      if (error) {
        result.errors.push(`Projects: ${error}`);
        result.success = false;
      } else {
        result.inserted.projects = count;
      }
    }

    // Insert funding programs
    if (grouped.funding.length > 0) {
      const { count, error } = await this.insertFunding(grouped.funding);
      if (error) {
        result.errors.push(`Funding: ${error}`);
        result.success = false;
      } else {
        result.inserted.funding = count;
      }
    }

    // Insert resources
    if (grouped.resources.length > 0) {
      const { count, error } = await this.insertResources(grouped.resources);
      if (error) {
        result.errors.push(`Resources: ${error}`);
        result.success = false;
      } else {
        result.inserted.resources = count;
      }
    }

    return result;
  }

  /**
   * Group items by content type
   */
  private groupByType(items: StagingItem[]) {
    const grouped = {
      projects: [] as any[],
      funding: [] as any[],
      resources: [] as any[]
    };

    items.forEach(item => {
      const prepared = this.prepareItem(item);
      
      switch (item.type) {
        case 'project':
          grouped.projects.push(this.transformToProject(prepared));
          break;
        case 'funding':
          grouped.funding.push(this.transformToFunding(prepared));
          break;
        case 'resource':
          grouped.resources.push(this.transformToResource(prepared));
          break;
        default:
          // Default to resource if type unknown
          grouped.resources.push(this.transformToResource(prepared));
      }
    });

    return grouped;
  }

  /**
   * Prepare item with proper description
   */
  private prepareItem(item: any) {
    // Ensure description meets minimum length (50 chars)
    let description = item.description || item.content || item.tagline || item.title || '';
    
    // If still too short, add context
    if (description.length < 50) {
      const title = item.title || item.name || '';
      const source = item.source || 'Web3';
      const type = item.type || 'content';
      
      if (title) {
        description = `${title} - ${source} ${type} being evaluated for the ACCELERATE platform. High-quality content for Web3 builders and innovators.`;
      } else {
        description = `High-quality ${source} ${type} being evaluated for the ACCELERATE platform. Curated content for Web3 builders and innovators.`;
      }
    }
    
    // Ensure it's not too long
    if (description.length > 1000) {
      description = description.substring(0, 997) + '...';
    }

    return {
      ...item,
      description
    };
  }

  /**
   * Transform to project format
   */
  private transformToProject(item: any) {
    return {
      // Core Fields
      company_name: item.title || item.name || 'Untitled Project',
      description: item.description,
      website: item.website_url || item.url,
      founded_year: item.founded_year || item.metadata?.founded_year || new Date().getFullYear(),
      
      // ACCELERATE Fields (Required)
      accelerate_fit: item.accelerate_fit || false,
      accelerate_reason: item.accelerate_reason || '',
      accelerate_score: Math.min(9.99, (item.accelerate_score || item.score || 0) / 10),
      confidence_score: Math.min(9.99, item.confidence_score || 0.5),
      
      // Location & Team
      location: item.location || item.metadata?.location,
      country: item.country || item.metadata?.country,
      region: item.region || item.metadata?.region,
      city: item.city || item.metadata?.city,
      founders: item.founders || item.metadata?.founders || [],
      team_size: item.team_size || item.metadata?.team_size,
      employee_count: item.employee_count || item.team_size,
      
      // Funding & Business
      funding_amount: item.funding_raised || item.metadata?.funding_raised || 0,
      funding_round: item.funding_round || item.metadata?.funding_round,
      funding_investors: item.funding_investors || item.metadata?.investors || [],
      last_funding_date: item.last_funding_date || item.metadata?.last_funding_date,
      total_funding: item.total_funding || item.funding_raised || 0,
      valuation: item.valuation || item.metadata?.valuation,
      revenue: item.revenue || item.metadata?.revenue,
      business_model: item.business_model || item.metadata?.business_model,
      
      // Technology & Industry
      technology_stack: item.technology_stack || item.metadata?.tech_stack || [],
      industry_tags: item.categories || item.metadata?.categories || [],
      market_category: item.market_category || item.metadata?.market_category,
      target_market: item.target_market || item.metadata?.target_market,
      competitive_advantage: item.unique_value_prop || item.metadata?.unique_value_prop,
      
      // Source & Enrichment
      source: item.source,
      source_url: item.source_url || item.url,
      source_created_at: item.created_at || new Date().toISOString(),
      batch_id: item.batch_id || `batch_${Date.now()}`,
      enriched: item.enriched || false,
      enrichment_data: item.enrichment_data || {},
      
      // AI Analysis
      ai_summary: item.ai_summary || item.metadata?.ai_summary,
      ai_insights: item.ai_insights || {},
      sentiment_score: Math.min(9.99, item.sentiment_score || 0),
      growth_potential: item.growth_potential || item.metadata?.growth_potential,
      risk_factors: item.risk_factors || [],
      
      // Metadata
      metadata: item.metadata || {},
      created_at: new Date().toISOString()
    };
  }

  /**
   * Transform to investor format (was funding)
   */
  private transformToFunding(item: any) {
    return {
      // Core Fields
      name: item.title || item.name || 'Untitled Investor',
      type: item.investor_type || 'VC',
      description: item.description,
      website: item.url,
      
      // ACCELERATE Fields
      accelerate_fit: item.accelerate_fit || false,
      accelerate_reason: item.accelerate_reason || '',
      accelerate_score: Math.min(9.99, (item.accelerate_score || item.score || 0) / 10),
      confidence_score: Math.min(9.99, item.confidence_score || 0.5),
      
      // Investment Profile
      investment_stage: item.investment_stage || item.metadata?.stage_preferences || [],
      investment_size_min: item.min_amount || item.metadata?.min_amount || 0,
      investment_size_max: item.max_amount || item.metadata?.max_amount || 0,
      total_investments: item.total_investments || 0,
      total_portfolio_value: item.portfolio_value || 0,
      
      // Focus Areas
      industry_focus: item.industry_focus || item.metadata?.sector_focus || [],
      geographic_focus: item.geographic_focus || item.metadata?.geographic_restrictions || [],
      technology_focus: item.technology_focus || [],
      business_model_focus: item.business_model_focus || [],
      
      // Portfolio
      portfolio_companies: item.portfolio_companies || [],
      notable_investments: item.notable_investments || {},
      recent_investments: item.recent_investments || {},
      exits: item.exits || {},
      
      // Benefits
      benefits: item.benefits || item.metadata?.benefits || [],
      mentor_profiles: item.mentor_profiles || item.metadata?.mentor_profiles || [],
      alumni_companies: item.alumni_companies || item.metadata?.alumni_companies || [],
      
      // Activity
      last_investment_date: item.last_investment_date || item.metadata?.last_investment_date,
      recent_portfolio: item.recent_portfolio || item.metadata?.recent_portfolio || [],
      total_deployed_2025: item.total_deployed_2025 || item.metadata?.total_deployed_2025,
      
      // Source & Enrichment
      source: item.source,
      source_url: item.source_url || item.url,
      batch_id: item.batch_id || `batch_${Date.now()}`,
      enriched: item.enriched || false,
      enrichment_data: item.enrichment_data || {},
      
      // AI Analysis
      ai_summary: item.ai_summary || item.metadata?.ai_summary,
      ai_insights: item.ai_insights || {},
      investment_thesis: item.investment_thesis || item.metadata?.investment_thesis,
      
      // Metadata
      metadata: item.metadata || {},
      created_at: new Date().toISOString()
    };
  }

  /**
   * Transform to news format (was resource)
   */
  private transformToResource(item: any) {
    return {
      // Core Fields
      title: item.title || item.name || 'Untitled News',
      content: item.content || item.description,
      url: item.url,
      published_date: item.published_date || item.created_at || new Date().toISOString(),
      
      // ACCELERATE Fields
      accelerate_fit: item.accelerate_fit || false,
      accelerate_reason: item.accelerate_reason || '',
      accelerate_score: Math.min(9.99, (item.accelerate_score || item.score || 0) / 10),
      confidence_score: Math.min(9.99, item.confidence_score || 0.5),
      
      // Article Details
      author: item.author || item.metadata?.author,
      publication: item.publication || item.source,
      category: item.category || item.metadata?.category,
      tags: item.tags || item.metadata?.tags || [],
      image_url: item.image_url || item.metadata?.image_url,
      video_url: item.video_url || item.metadata?.video_url,
      
      // Company Relations
      company_name: item.company_name || item.metadata?.company,
      company_id: item.company_id,
      mentioned_companies: item.mentioned_companies || [],
      
      // Content Analysis
      summary: item.summary || item.ai_summary || '',
      key_points: item.key_points || item.metadata?.key_points || [],
      sentiment: item.sentiment || 'neutral',
      sentiment_score: Math.min(9.99, item.sentiment_score || 0),
      relevance_score: Math.min(9.99, (item.relevance_score || item.score || 0) / 10),
      
      // Engagement Metrics
      views: item.views || 0,
      shares: item.shares || 0,
      comments: item.comments || 0,
      engagement_score: item.engagement_score || 0,
      
      // Source & Enrichment
      source: item.source,
      source_url: item.source_url || item.url,
      source_id: item.source_id,
      batch_id: item.batch_id || `batch_${Date.now()}`,
      enriched: item.enriched || false,
      enrichment_data: item.enrichment_data || {},
      
      // AI Analysis (duplicated for correct field names)
      ai_summary: item.ai_summary || item.summary || '',
      ai_insights: item.ai_insights || {},
      ai_keywords: item.ai_keywords || [],
      ai_entities: item.ai_entities || {},
      
      // Metadata
      metadata: item.metadata || {},
      created_at: new Date().toISOString()
    };
  }

  /**
   * Insert projects into staging
   */
  private async insertProjects(items: any[]): Promise<{ count: number; error?: string }> {
    try {
      console.log(`📝 Inserting ${items.length} projects...`);
      
      const { data, error } = await supabase
        .from('queue_projects')
        .insert(items)
        .select();

      if (error) {
        console.error('❌ Project insertion error:', error);
        return { count: 0, error: error.message || JSON.stringify(error) };
      }

      console.log(`✅ Inserted ${data?.length || 0} projects`);
      return { count: data?.length || 0 };
    } catch (err: any) {
      console.error('❌ Project insertion exception:', err);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Insert funding programs into staging
   */
  private async insertFunding(items: any[]): Promise<{ count: number; error?: string }> {
    try {
      console.log(`💰 Inserting ${items.length} funding programs...`);
      
      const { data, error } = await supabase
        .from('queue_investors')
        .insert(items)
        .select();

      if (error) {
        console.error('❌ Funding insertion error:', error);
        return { count: 0, error: error.message || JSON.stringify(error) };
      }

      console.log(`✅ Inserted ${data?.length || 0} funding programs`);
      return { count: data?.length || 0 };
    } catch (err: any) {
      console.error('❌ Funding insertion exception:', err);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Insert resources into staging
   */
  private async insertResources(items: any[]): Promise<{ count: number; error?: string }> {
    try {
      console.log(`🔧 Inserting ${items.length} resources...`);
      
      const { data, error } = await supabase
        .from('queue_news')
        .insert(items)
        .select();

      if (error) {
        console.error('❌ Resource insertion error:', error);
        return { count: 0, error: error.message || JSON.stringify(error) };
      }

      console.log(`✅ Inserted ${data?.length || 0} resources`);
      return { count: data?.length || 0 };
    } catch (err: any) {
      console.error('❌ Resource insertion exception:', err);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Get staging queue stats
   */
  async getQueueStats(): Promise<{
    projects: { pending: number; approved: number; rejected: number };
    funding: { pending: number; approved: number; rejected: number };
    resources: { pending: number; approved: number; rejected: number };
  }> {
    const stats = {
      projects: { pending: 0, approved: 0, rejected: 0 },
      funding: { pending: 0, approved: 0, rejected: 0 },
      resources: { pending: 0, approved: 0, rejected: 0 }
    };

    // Get project stats
    const { data: projectStats } = await supabase
      .from('queue_projects')
      .select('status', { count: 'exact' })
      .returns<{ status: string }[]>();

    // Get funding stats
    const { data: fundingStats } = await supabase
      .from('queue_investors')
      .select('status', { count: 'exact' })
      .returns<{ status: string }[]>();

    // Get resource stats
    const { data: resourceStats } = await supabase
      .from('queue_news')
      .select('status', { count: 'exact' })
      .returns<{ status: string }[]>();

    // Process stats
    this.processStats(projectStats, stats.projects);
    this.processStats(fundingStats, stats.funding);
    this.processStats(resourceStats, stats.resources);

    return stats;
  }

  private processStats(data: any[] | null, stats: any) {
    if (!data) return;
    
    data.forEach(item => {
      switch (item.status) {
        case 'pending_review':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
      }
    });
  }
}

// Export singleton
export const stagingService = new StagingService();