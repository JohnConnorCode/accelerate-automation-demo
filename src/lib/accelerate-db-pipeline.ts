import { ContentItem } from './base-fetcher';
import { AccelerateScorer } from './accelerate-scorer';
import { AIScorer } from './ai-scorer';
import { supabase } from './supabase-client';

/**
 * ACCELERATE DATABASE PIPELINE
 * Processes, validates, and inserts qualified content into Accelerate DB
 * Ensures only high-quality, relevant content reaches the platform
 */

export class AccelerateDBPipeline {
  private static readonly MIN_SCORE_THRESHOLD = 30; // Minimum score to qualify
  private static readonly BATCH_SIZE = 50; // Process in batches
  private static aiScorer = new AIScorer(); // AI scoring integration
  
  /**
   * Main pipeline - processes content and updates Accelerate DB
   */
  static async processContent(items: ContentItem[]): Promise<{
    processed: number;
    inserted: number;
    updated: number;
    rejected: number;
    errors: string[];
  }> {
    const results = {
      processed: 0,
      inserted: 0,
      updated: 0,
      rejected: 0,
      errors: [] as string[]
    };

    try {
      // Step 1: Score and filter with both traditional and AI scoring

      const qualified = AccelerateScorer.filterQualified(items);
      let scored = AccelerateScorer.scoreAndRank(qualified);
      
      // Step 1b: Apply AI scoring for deeper analysis
      console.log(`🤖 Applying AI scoring to ${scored.length} items...`);
      const aiScoredItems = await this.aiScorer.scoreItems(scored);
      
      // Merge AI insights with traditional scoring
      scored = aiScoredItems.map((item: any) => ({
        ...item,
        metadata: {
          ...item.metadata,
          // Keep the higher of the two scores
          accelerate_score: Math.max(
            item.metadata?.accelerate_score || 0,
            item.metadata?.ai_score || 0
          ),
          // Preserve all AI insights
          ai_analysis: item.metadata?.ai_analysis,
          ai_score: item.metadata?.ai_score,
          ai_needs: item.metadata?.ai_needs,
          ai_strengths: item.metadata?.ai_strengths
        }
      }));
      
      // Step 2: Apply minimum threshold
      const aboveThreshold = scored.filter(item => 
        (item.metadata?.accelerate_score || 0) >= this.MIN_SCORE_THRESHOLD
      );
      
      results.rejected = items.length - aboveThreshold.length;

      // Step 3: Deduplicate
      const deduplicated = await this.deduplicateContent(aboveThreshold);

      // Step 4: Process by type in batches
      for (let i = 0; i < deduplicated.new.length; i += this.BATCH_SIZE) {
        const batch = deduplicated.new.slice(i, i + this.BATCH_SIZE);
        
        for (const item of batch) {
          try {
            results.processed++;
            
            switch (item.type) {
              case 'project':
                await this.insertProject(item);
                results.inserted++;
                break;
              case 'funding':
                await this.insertFundingProgram(item);
                results.inserted++;
                break;
              case 'resource':
                await this.insertResource(item);
                results.inserted++;
                break;
            }
          } catch (error) {
            results.errors.push(`Failed to insert ${item.type}: ${item.title} - ${error}`);
          }
        }
      }

      // Step 5: Update existing items if needed
      for (const item of deduplicated.existing) {
        try {
          if (await this.shouldUpdate(item)) {
            await this.updateExisting(item);
            results.updated++;
          }
        } catch (error) {
          results.errors.push(`Failed to update ${item.type}: ${item.title} - ${error}`);
        }
      }

      // Step 6: Log metrics
      await this.logMetrics(results, scored);

    } catch (error) {
      results.errors.push(`Pipeline error: ${error}`);
    }

    return results;
  }

  /**
   * Deduplicate content against existing DB records
   */
  private static async deduplicateContent(items: ContentItem[]): Promise<{
    new: ContentItem[];
    existing: ContentItem[];
  }> {
    const newItems: ContentItem[] = [];
    const existingItems: ContentItem[] = [];

    // Check URLs for duplicates
    const urls = items.map(item => item.url).filter(Boolean);
    
    if (urls.length > 0) {
      const { data: existingUrls } = await supabase
        .from('content_sources')
        .select('url')
        .in('url', urls);

      const existingUrlSet = new Set(existingUrls?.map(r => r.url) || []);

      for (const item of items) {
        if (item.url && existingUrlSet.has(item.url)) {
          existingItems.push(item);
        } else {
          newItems.push(item);
        }
      }
    } else {
      newItems.push(...items);
    }

    return { new: newItems, existing: existingItems };
  }

  /**
   * Insert a project into the projects table
   */
  private static async insertProject(item: ContentItem): Promise<void> {
    const meta = item.metadata || {};
    
    const projectData = {
      // Core fields
      name: meta.name || item.title,
      description: item.description,
      short_description: meta.short_description || item.description.substring(0, 100),
      website_url: meta.website_url || item.url,
      github_url: meta.github_url,
      twitter_url: meta.twitter_url,
      discord_url: meta.discord_url,
      
      // Stage information
      launch_date: meta.launch_date,
      funding_raised: meta.funding_raised || 0,
      funding_round: meta.funding_round,
      team_size: meta.team_size || 1,
      
      // Categories
      categories: meta.categories || [],
      supported_chains: meta.supported_chains || [],
      project_status: meta.development_status || 'active',
      
      // Needs
      seeking_funding: meta.project_needs?.includes('funding') || false,
      seeking_cofounders: meta.project_needs?.includes('co-founder') || false,
      seeking_developers: meta.project_needs?.includes('developers') || false,
      
      // Metadata
      accelerate_score: meta.accelerate_score,
      source: item.source,
      source_url: item.url,
      last_activity: meta.last_activity || new Date().toISOString(),
      
      // Additional context
      problem_statement: meta.problem_solving,
      value_proposition: meta.unique_value_prop,
      target_market: meta.target_market,
      
      // AI-generated insights
      ai_score: meta.ai_score,
      ai_analysis: meta.ai_analysis,
      ai_strengths: meta.ai_strengths,
      ai_needs: meta.ai_needs,
    };

    const { error } = await supabase
      .from('projects')
      .insert(projectData);

    if (error) throw error;

    // Also log in content_sources for tracking
    await this.logContentSource(item, 'projects', projectData.name);
  }

  /**
   * Insert a funding program into the funding_programs table
   */
  private static async insertFundingProgram(item: ContentItem): Promise<void> {
    const meta = item.metadata || {};
    
    const fundingData = {
      // Core fields
      name: meta.name || item.title,
      organization: meta.organization || item.author,
      description: item.description,
      
      // Funding details
      funding_type: meta.funding_type || 'grant',
      min_amount: meta.min_amount || 0,
      max_amount: meta.max_amount || 0,
      currency: meta.currency || 'USD',
      equity_required: meta.equity_required || false,
      equity_percentage: meta.equity_percentage || 0,
      
      // Application details
      application_url: meta.application_url || item.url,
      application_deadline: meta.application_deadline,
      application_process: meta.application_process,
      decision_timeline: meta.decision_timeline,
      
      // Eligibility
      eligibility_criteria: meta.eligibility_criteria || [],
      geographic_restrictions: meta.geographic_restrictions || [],
      stage_preferences: meta.stage_preferences || ['seed', 'pre-seed'],
      sector_focus: meta.sector_focus || [],
      
      // Program details
      program_duration: meta.program_duration,
      program_location: meta.program_location || 'Remote',
      cohort_size: meta.cohort_size,
      
      // Benefits
      benefits: meta.benefits || [],
      mentor_profiles: meta.mentor_profiles || [],
      
      // Activity verification
      last_investment_date: meta.last_investment_date,
      total_deployed_2025: meta.total_deployed_2025 || 0,
      is_active: true,
      
      // Metadata
      accelerate_score: meta.accelerate_score,
      source: item.source,
      source_url: item.url,
      
      // AI-generated insights
      ai_score: meta.ai_score,
      ai_analysis: meta.ai_analysis,
      ai_strengths: meta.ai_strengths,
      ai_requirements: meta.ai_needs, // For funding, needs become requirements
    };

    const { error } = await supabase
      .from('funding_programs')
      .insert(fundingData);

    if (error) throw error;

    // Log in content_sources
    await this.logContentSource(item, 'funding_programs', fundingData.name);
  }

  /**
   * Insert a resource into the resources table
   */
  private static async insertResource(item: ContentItem): Promise<void> {
    const meta = item.metadata || {};
    
    const resourceData = {
      // Core fields
      title: item.title,
      description: item.description,
      url: item.url,
      
      // Type and category
      resource_type: meta.resource_type || 'tool',
      category: meta.category || 'general',
      
      // Accessibility
      price_type: meta.price_type || 'free',
      price_amount: meta.price_amount || 0,
      trial_available: meta.trial_available || false,
      
      // Quality indicators
      provider_name: meta.provider_name || item.author,
      provider_credibility: meta.provider_credibility,
      last_updated: meta.last_updated || new Date().toISOString(),
      
      // Usage details
      difficulty_level: meta.difficulty_level || 'intermediate',
      time_commitment: meta.time_commitment,
      prerequisites: meta.prerequisites || [],
      
      // Value proposition
      key_benefits: meta.key_benefits || [],
      use_cases: meta.use_cases || [],
      
      // Metadata
      accelerate_score: meta.accelerate_score,
      source: item.source,
      tags: item.tags || [],
      
      // AI-generated insights
      ai_score: meta.ai_score,
      ai_analysis: meta.ai_analysis,
      ai_benefits: meta.ai_strengths, // For resources, strengths are benefits
      ai_use_cases: meta.ai_needs, // For resources, needs become use cases
    };

    const { error } = await supabase
      .from('resources')
      .insert(resourceData);

    if (error) throw error;

    // Log in content_sources
    await this.logContentSource(item, 'resources', resourceData.title);
  }

  /**
   * Log content source for tracking
   */
  private static async logContentSource(
    item: ContentItem, 
    table: string, 
    recordName: string
  ): Promise<void> {
    await supabase
      .from('content_sources')
      .insert({
        url: item.url,
        source: item.source,
        type: item.type,
        table_name: table,
        record_identifier: recordName,
        accelerate_score: item.metadata?.accelerate_score,
        fetched_at: new Date().toISOString(),
      });
  }

  /**
   * Check if existing content should be updated
   */
  private static async shouldUpdate(item: ContentItem): Promise<boolean> {
    // Check if the content has significantly changed
    const { data } = await supabase
      .from('content_sources')
      .select('fetched_at, accelerate_score')
      .eq('url', item.url)
      .single();

    if (!data) return false;

    // Update if score improved significantly or it's been >7 days
    const daysSinceUpdate = (Date.now() - new Date(data.fetched_at).getTime()) / (24 * 60 * 60 * 1000);
    const scoreImprovement = (item.metadata?.accelerate_score || 0) - (data.accelerate_score || 0);

    return daysSinceUpdate > 7 || scoreImprovement > 10;
  }

  /**
   * Update existing content
   */
  private static async updateExisting(item: ContentItem): Promise<void> {
    // Update based on type
    switch (item.type) {
      case 'project':
        await supabase
          .from('projects')
          .update({
            description: item.description,
            accelerate_score: item.metadata?.accelerate_score,
            last_activity: new Date().toISOString(),
          })
          .eq('website_url', item.url);
        break;
        
      case 'funding':
        await supabase
          .from('funding_programs')
          .update({
            description: item.description,
            accelerate_score: item.metadata?.accelerate_score,
            last_investment_date: item.metadata?.last_investment_date,
          })
          .eq('application_url', item.url);
        break;
        
      case 'resource':
        await supabase
          .from('resources')
          .update({
            description: item.description,
            accelerate_score: item.metadata?.accelerate_score,
            last_updated: new Date().toISOString(),
          })
          .eq('url', item.url);
        break;
    }

    // Update content_sources tracking
    await supabase
      .from('content_sources')
      .update({
        accelerate_score: item.metadata?.accelerate_score,
        fetched_at: new Date().toISOString(),
      })
      .eq('url', item.url);
  }

  /**
   * Log quality metrics for monitoring
   */
  private static async logMetrics(
    results: any, 
    items: ContentItem[]
  ): Promise<void> {
    const metrics = AccelerateScorer.getQualityMetrics(items);
    
    await supabase
      .from('content_metrics')
      .insert({
        timestamp: new Date().toISOString(),
        total_processed: results.processed,
        total_inserted: results.inserted,
        total_updated: results.updated,
        total_rejected: results.rejected,
        average_score: metrics.averageScore,
        qualified_count: metrics.qualified,
        by_type: metrics.byType,
        errors: results.errors,
      });

  }

  /**
   * Get pipeline status and recent metrics
   */
  static async getStatus(): Promise<{
    lastRun: string;
    totalRecords: number;
    recentMetrics: any;
    topContent: any[];
  }> {
    // Get last run time
    const { data: lastMetric } = await supabase
      .from('content_metrics')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Get total records
    const [projects, funding, resources] = await Promise.all([
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('funding_programs').select('id', { count: 'exact', head: true }),
      supabase.from('resources').select('id', { count: 'exact', head: true }),
    ]);

    // Get recent metrics
    const { data: recentMetrics } = await supabase
      .from('content_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    // Get top content by score
    const { data: topContent } = await supabase
      .from('content_sources')
      .select('*')
      .order('accelerate_score', { ascending: false })
      .limit(10);

    return {
      lastRun: lastMetric?.timestamp || 'Never',
      totalRecords: (projects.count || 0) + (funding.count || 0) + (resources.count || 0),
      recentMetrics: recentMetrics || [],
      topContent: topContent || [],
    };
  }
}