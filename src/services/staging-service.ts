/**
 * Staging Service - Manages insertion into staging tables
 * Routes content to appropriate staging table based on type
 */

// Use crypto.randomUUID if available (browser/Node 19+), otherwise fallback
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Date.now() + Math.random() * 16) % 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

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
    console.log(`\n🔍 StagingService.insertToStaging called with ${items.length} items`);
    console.log(`   Item types:`, items.map(i => i.type).join(', '));
    
    const result = {
      success: true,
      inserted: { projects: 0, funding: 0, resources: 0 },
      errors: [] as string[]
    };

    // Group items by type
    const grouped = this.groupByType(items);
    console.log(`   Grouped: ${grouped.projects.length} projects, ${grouped.funding.length} funding, ${grouped.resources.length} resources`);

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
    // Helper to ensure numeric values
    const toNumber = (val: any, defaultVal: number = 0): number => {
      const num = Number(val);
      return isNaN(num) ? defaultVal : num;
    };

    // Generate unique URL if not provided
    const uniqueId = `${item.source}_${item.title || item.name || 'untitled'}_${Date.now()}_${generateUUID().substring(0, 8)}`;
    const url = item.url || item.source_url || `https://accelerate.example.com/project/${uniqueId}`;
    
    return {
      // Core Fields
      url: url, // Required field - now guaranteed unique
      title: item.title || item.name || 'Untitled Project', // Required field
      company_name: item.title || item.name || 'Untitled Project',
      description: item.description,
      website: item.website_url || item.url,
      founded_year: toNumber(item.founded_year || item.metadata?.founded_year, new Date().getFullYear()),
      
      // ACCELERATE Fields (Required)
      accelerate_fit: item.accelerate_fit || false,
      accelerate_reason: item.accelerate_reason || '',
      accelerate_score: Math.min(9.99, toNumber(item.accelerate_score || item.score, 0)),
      confidence_score: Math.min(9.99, toNumber(item.confidence_score || 0.7, 0.7)),
      
      // Location & Team
      location: item.location || item.metadata?.location,
      country: item.country || item.metadata?.country,
      region: item.region || item.metadata?.region,
      city: item.city || item.metadata?.city,
      founders: item.founders || item.metadata?.founders || [],
      team_size: toNumber(item.team_size || item.metadata?.team_size),
      employee_count: toNumber(item.employee_count || item.team_size),
      
      // Funding & Business
      funding_amount: toNumber(item.funding_raised || item.metadata?.funding_raised),
      funding_round: item.funding_round || item.metadata?.funding_round,
      funding_investors: item.funding_investors || item.metadata?.investors || [],
      last_funding_date: item.last_funding_date || item.metadata?.last_funding_date,
      total_funding: toNumber(item.total_funding || item.funding_raised),
      valuation: toNumber(item.valuation || item.metadata?.valuation),
      revenue: toNumber(item.revenue || item.metadata?.revenue),
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
   * Transform to funding program format (queue_investors table)
   * FIXED: Added required URL field to prevent null violations
   */
  private transformToFunding(item: any) {
    // Helper to ensure numeric values
    const toNumber = (val: any, defaultVal: number = 0): number => {
      const num = Number(val);
      return isNaN(num) ? defaultVal : num;
    };

    // Ensure description is long enough
    let description = item.description || '';
    if (description.length < 100) {
      description = `${item.title || item.name || 'Funding Program'} - ${item.source} funding opportunity for ACCELERATE-eligible startups. ${description}`.padEnd(100, '.');
    }

    // Generate URL if not provided - REQUIRED field
    const url = item.url || item.source_url || 
                `https://accelerate.funding/${item.source}/${(item.title || item.name || 'program').replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    const now = new Date();

    // Include all required fields based on table schema
    return {
      url: url, // REQUIRED - not-null constraint
      title: item.title || item.name || 'Untitled Funding Program',
      description,
      source: item.source, // REQUIRED - not-null constraint
      score: toNumber(item.score || item.accelerate_score || 5, 5),
      status: 'pending',
      metadata: item.metadata || {},
      accelerate_fit: item.accelerate_fit !== undefined ? item.accelerate_fit : true,
      accelerate_reason: item.accelerate_reason || 'Funding opportunity for ACCELERATE-eligible startups',
      created_at: now.toISOString()
    };
  }

  /**
   * Transform to news format (was resource)
   */
  private transformToResource(item: any) {
    // Helper to ensure numeric values
    const toNumber = (val: any, defaultVal: number = 0): number => {
      const num = Number(val);
      return isNaN(num) ? defaultVal : num;
    };

    // Generate unique URL if not provided or to ensure uniqueness
    const uniqueId = `${item.source}_${item.title || 'untitled'}_${Date.now()}_${generateUUID().substring(0, 8)}`;
    const url = item.url || `https://accelerate.example.com/resource/${uniqueId}`;
    
    return {
      // Core Fields
      title: item.title || item.name || 'Untitled News',
      content: item.content || item.description,
      url: url, // Now guaranteed unique
      published_date: item.published_date || item.created_at || new Date().toISOString(),
      
      // ACCELERATE Fields
      accelerate_fit: item.accelerate_fit || false,
      accelerate_reason: item.accelerate_reason || '',
      accelerate_score: Math.min(9.99, toNumber(item.accelerate_score || item.score, 0)),
      confidence_score: Math.min(9.99, toNumber(item.confidence_score || 0.7, 0.7)),
      
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
      sentiment_score: Math.min(9.99, toNumber(item.sentiment_score)),
      relevance_score: Math.min(9.99, toNumber(item.relevance_score || item.score, 0)),
      
      // Engagement Metrics
      views: toNumber(item.views),
      shares: toNumber(item.shares),
      comments: toNumber(item.comments),
      engagement_score: toNumber(item.engagement_score),
      
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
      console.log(`\n📝 Inserting ${items.length} projects to queue_projects...`);
      console.log(`   Sample item:`, JSON.stringify(items[0], null, 2).substring(0, 500));
      
      // Use upsert with onConflict to handle duplicates gracefully
      const { data: batchData, error: batchError } = await supabase
        .from('queue_projects')
        .upsert(items, { 
          onConflict: 'url',
          ignoreDuplicates: false 
        })
        .select();
      
      if (!batchError) {
        // Batch insert succeeded
        const successCount = batchData?.length || 0;
        console.log(`✅ Batch inserted ${successCount} projects`);
        return { count: successCount };
      }
      
      // If batch failed due to duplicates, fall back to individual inserts
      if (batchError.message?.includes('duplicate') || batchError.message?.includes('unique') || 
          batchError.message?.includes('ON CONFLICT')) {
        console.log('   Batch insert failed due to conflicts, trying individual inserts...');
        
        let successCount = 0;
        const errors: string[] = [];
        const processedUrls = new Set<string>();
        
        for (const item of items) {
          // Skip if we've already processed this URL in this batch
          if (processedUrls.has(item.url)) {
            console.log(`   Skipping duplicate URL in batch: ${item.url}`);
            continue;
          }
          processedUrls.add(item.url);
          
          // Try to insert, if it fails due to duplicate, try updating
          const { data: insertData, error: insertError } = await supabase
            .from('queue_projects')
            .insert(item)
            .select();
          
          if (!insertError) {
            // Insert succeeded
            if (insertData && insertData.length > 0) {
              successCount++;
            }
          } else if (insertError.message?.includes('duplicate') || 
                     insertError.message?.includes('unique') ||
                     insertError.message?.includes('violates unique constraint')) {
            // Try to update instead
            const { data: updateData, error: updateError } = await supabase
              .from('queue_projects')
              .update({
                ...item,
                updated_at: new Date().toISOString()
              })
              .eq('url', item.url)
              .select();
            
            if (!updateError && updateData && updateData.length > 0) {
              successCount++;
            } else if (updateError && !updateError.message?.includes('ON CONFLICT')) {
              errors.push(`${item.company_name}: ${updateError.message}`);
            }
          } else if (!insertError.message?.includes('ON CONFLICT')) {
            // Other error, not duplicate-related
            errors.push(`${item.company_name}: ${insertError.message}`);
          }
        }

        console.log(`✅ Inserted ${successCount} out of ${items.length} projects`);
        if (items.length - successCount > 0) {
          console.log(`   Skipped ${items.length - successCount} duplicates`);
        }
        
        return { count: successCount, error: errors.length > 0 ? errors[0] : undefined };
      }
      
      // Other error - return it
      return { count: 0, error: batchError.message };
    } catch (err: any) {
      console.error('Project insertion exception', err);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Insert funding programs into staging
   */
  private async insertFunding(items: any[]): Promise<{ count: number; error?: string }> {
    try {
      console.log(`💰 Inserting ${items.length} funding programs...`);
      
      // Try batch insert first for performance
      const { data: batchData, error: batchError } = await supabase
        .from('queue_investors')
        .insert(items as any)
        .select();
      
      if (!batchError) {
        // Batch insert succeeded
        const successCount = batchData?.length || 0;
        console.log(`✅ Batch inserted ${successCount} funding programs`);
        return { count: successCount };
      }
      
      // If batch failed due to duplicates, fall back to individual inserts
      if (batchError.message?.includes('duplicate') || batchError.message?.includes('unique') || 
          batchError.message?.includes('ON CONFLICT')) {
        console.log('   Batch insert failed due to conflicts, trying individual inserts...');
        
        let successCount = 0;
        const errors: string[] = [];
        const processedUrls = new Set<string>();
        
        for (const item of items) {
          // Skip if we've already processed this URL in this batch
          if (processedUrls.has(item.url)) {
            console.log(`   Skipping duplicate URL in batch: ${item.url}`);
            continue;
          }
          processedUrls.add(item.url);
          
          // Try to insert, if it fails due to duplicate, try updating
          const { data: insertData, error: insertError } = await supabase
            .from('queue_investors')
            .insert(item)
            .select();
          
          if (!insertError) {
            // Insert succeeded
            if (insertData && insertData.length > 0) {
              successCount++;
            }
          } else if (insertError.message?.includes('duplicate') || 
                     insertError.message?.includes('unique') ||
                     insertError.message?.includes('violates unique constraint')) {
            // Try to update instead
            const { data: updateData, error: updateError } = await supabase
              .from('queue_investors')
              .update({
                ...item,
                updated_at: new Date().toISOString()
              })
              .eq('url', item.url)
              .select();
            
            if (!updateError && updateData && updateData.length > 0) {
              successCount++;
            } else if (updateError && !updateError.message?.includes('ON CONFLICT')) {
              errors.push(`${item.title}: ${updateError.message}`);
            }
          } else if (!insertError.message?.includes('ON CONFLICT')) {
            // Other error, not duplicate-related
            errors.push(`${item.title}: ${insertError.message}`);
          }
        }

        console.log(`✅ Inserted ${successCount} out of ${items.length} funding programs`);
        if (items.length - successCount > 0) {
          console.log(`   Skipped ${items.length - successCount} duplicates`);
        }
        
        return { count: successCount, error: errors.length > 0 ? errors[0] : undefined };
      }
      
      // Other error - return it
      return { count: 0, error: batchError.message };
    } catch (err: any) {
      console.error('Funding insertion exception', err);
      return { count: 0, error: err.message };
    }
  }

  /**
   * Insert resources into staging
   */
  private async insertResources(items: any[]): Promise<{ count: number; error?: string }> {
    try {
      console.log(`🔧 Inserting ${items.length} resources...`);
      
      // Use upsert with onConflict to handle duplicates gracefully
      const { data: batchData, error: batchError } = await supabase
        .from('queue_news')
        .upsert(items as any, { 
          onConflict: 'url',
          ignoreDuplicates: false 
        })
        .select();
      
      if (!batchError) {
        // Batch insert succeeded
        const successCount = batchData?.length || 0;
        console.log(`✅ Batch inserted ${successCount} resources`);
        return { count: successCount };
      }
      
      // If batch failed due to duplicates, fall back to individual inserts
      if (batchError.message?.includes('duplicate') || batchError.message?.includes('unique')) {
        console.log('   Batch insert failed due to duplicates, trying individual inserts...');
        
        let successCount = 0;
        const errors: string[] = [];
        
        for (const item of items) {
          const { data, error } = await supabase
            .from('queue_news')
            .upsert(item as any, { 
              onConflict: 'url',
              ignoreDuplicates: false 
            })
            .select();
          
          if (error) {
            // Only log if it's not a duplicate error
            if (!error.message?.includes('duplicate') && !error.message?.includes('unique')) {
              errors.push(`${item.title}: ${error.message}`);
            }
          } else if (data && data.length > 0) {
            successCount++;
          }
        }

        console.log(`✅ Inserted ${successCount} out of ${items.length} resources`);
        if (items.length - successCount > 0) {
          console.log(`   Skipped ${items.length - successCount} duplicates`);
        }
        
        return { count: successCount, error: errors.length > 0 ? errors[0] : undefined };
      }
      
      // Other error - return it
      return { count: 0, error: batchError.message };
    } catch (err: any) {
      console.error('Resource insertion exception', err);
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
    if (!data) {return;}
    
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