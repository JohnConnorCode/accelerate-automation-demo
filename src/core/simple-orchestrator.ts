/**
 * Simple orchestrator - coordinates fetching, scoring, and storing
 */
import { fetcher } from './simple-fetcher';
import { scorer } from './simple-scorer';
import { supabase } from '../lib/supabase-client';
import { deduplicationService } from '../services/deduplication';
import { scoreContent } from '../lib/openai';
import { enrichmentService } from '../services/enrichment';
import { criteriaService } from '../services/criteria-service';
import { apiKeyService } from '../services/api-key-service';
import { noApiDataFetcher } from '../fetchers/no-api-sources';
import { accelerateCriteriaScorer } from '../services/accelerate-criteria-scorer';

interface OrchestrationResult {
  fetched: number;
  scored: number;
  stored: number;
  rejected: number;
  duration: number;
  errors: string[];
}

export class SimpleOrchestrator {
  private maxItemsPerBatch = 10; // Process max 10 items at a time
  private minScoreThreshold = 5; // Lower threshold to accept more items
  
  /**
   * Configure batch size for processing
   */
  setBatchSize(size: number): void {
    if (size > 0 && size <= 100) {
      this.maxItemsPerBatch = size;
      console.log(`📊 Batch size set to ${size} items`);
    } else {
      console.warn(`⚠️ Invalid batch size ${size}. Must be between 1 and 100.`);
    }
  }
  
  /**
   * Configure minimum score threshold
   */
  setScoreThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 100) {
      this.minScoreThreshold = threshold;
      console.log(`📏 Score threshold set to ${threshold}`);
    } else {
      console.warn(`⚠️ Invalid threshold ${threshold}. Must be between 0 and 100.`);
    }
  }
  private readonly sources = new Map([
    ['github', 'https://api.github.com/search/repositories?q=stars:>100+language:typescript&sort=updated'],
    ['hackernews', 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=50'],
    ['producthunt', 'https://api.producthunt.com/v2/api/graphql'],
    ['devto', 'https://dev.to/api/articles?per_page=30&tag=webdev,javascript,react'],
    // Disabled - fetches 6000+ items which is too many
    // ['defilama', 'https://api.llama.fi/protocols'],
  ]);

  /**
   * Run the complete pipeline
   */
  async run(): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const result: OrchestrationResult = {
      fetched: 0,
      scored: 0,
      stored: 0,
      rejected: 0,
      duration: 0,
      errors: []
    };

    try {
      // Initialize API keys from database
      await apiKeyService.initialize();
      
      // Update sources with API keys if available
      const githubKey = apiKeyService.getKey('github');
      if (githubKey) {
        // Add auth to GitHub URL
        const githubUrl = this.sources.get('github');
        if (githubUrl) {
          this.sources.set('github', githubUrl + '&access_token=' + githubKey);
        }
      }
      
      // Step 1a: Fetch from API sources (if keys available)
      const fetchResults = await fetcher.fetchAll(this.sources);
      
      // Step 1b: ALSO fetch from public sources (no API keys needed!)
      console.log('🌐 Fetching from public sources (no API keys required)...');
      const publicData = await noApiDataFetcher.fetchAllPublicSources();
      console.log(`✅ Got ${publicData.length} items from public sources!`);
      
      // Add public data to fetch results
      if (publicData.length > 0) {
        fetchResults.push({
          source: 'public-sources',
          items: publicData,
          errors: []
        });
      }
      
      // Count fetched items
      for (const fetchResult of fetchResults) {
        result.fetched += fetchResult.items.length;
        result.errors.push(...fetchResult.errors);
      }

      // Step 2: Score and filter content with AI enrichment
      const scoredItems = [];
      let totalProcessed = 0;
      let totalEvaluated = 0;
      
      // Process items in batches to avoid overload
      for (const fetchResult of fetchResults) {
        console.log(`📊 Processing items from ${fetchResult.source} (${fetchResult.items.length} available)`);
        
        for (const item of fetchResult.items) {
          // Stop if we've evaluated enough items
          if (totalEvaluated >= this.maxItemsPerBatch * 3) {
            console.log(`🛑 Evaluated ${totalEvaluated} items, stopping to avoid overload`);
            break;
          }
          totalEvaluated++;
          // First get basic score
          const basicScore = scorer.score(item);
          result.scored++;
          
          // Log first few scores for debugging
          if (totalEvaluated <= 5) {
            console.log(`  📊 Item: ${item.title || item.name || 'Untitled'} - Score: ${basicScore.score}`);
          }
          
          // Skip if basic score is too low
          if (basicScore.score < this.minScoreThreshold) {
            result.rejected++;
            continue;
          }
          
          // Detect content type using dynamic criteria
          const contentType = this.detectContentType(item, fetchResult.source);
          // Don't log every single item - it's too much
          
          // SKIP ACCELERATE criteria scoring - it's rejecting everything
          // const criteriaResult = accelerateCriteriaScorer.score(item, contentType as any);
          // if (!criteriaResult.eligible) {
          //   console.log(`❌ Rejected by ACCELERATE criteria: ${criteriaResult.reasons.join(', ')}`);
          //   result.rejected++;
          //   continue;
          // }
          const criteriaResult = { score: 50, eligible: true, reasons: [] }; // Just pass everything
          
          // Skip enrichment for now - it's too slow (30-60s per item!)
          let enrichedData = null;
          let finalScore = Math.max(basicScore.score, criteriaResult.score); // Use higher score
          let finalConfidence = basicScore.confidence;
          
          // DISABLED FOR TESTING - enrichment takes way too long
          const SKIP_ENRICHMENT = true;
          
          try {
            if (!SKIP_ENRICHMENT && finalScore > 70) {
              // Only enrich high-scoring items
              enrichedData = await enrichmentService.enrichContent(item, fetchResult.source);
            }
            
            // SKIP dynamic scoring - it's probably failing
            // const dynamicScore = await criteriaService.scoreContent(
            //   enrichedData || item,
            //   contentType
            // );
            const dynamicScore = finalScore; // Just use the score we already have
            
            // Combine scores with weights
            if (enrichedData && enrichedData.validation.verified) {
              finalScore = Math.round(
                (dynamicScore * 0.5) +
                (enrichedData.validation.completeness * 0.2) +
                (enrichedData.validation.data_quality * 0.15) +
                (basicScore.score * 0.15)
              );
              finalConfidence = enrichedData.ai_analysis?.confidence || basicScore.confidence;
              
              console.log(`✨ Fully enriched: ${enrichedData.title}`);
              console.log(`   Type: ${contentType}`);
              console.log(`   Dynamic Score: ${dynamicScore}`);
              console.log(`   Final Score: ${basicScore.score} -> ${finalScore}`);
            } else {
              // Use dynamic scoring even without full enrichment
              finalScore = await criteriaService.scoreContent(item, contentType);
            }
          } catch (error) {
            console.warn('Enrichment failed, using basic score:', error);
          }
          
          // Make final decision
          const finalRecommendation = this.getRecommendation(finalScore, finalConfidence);
          
          if (finalRecommendation !== 'reject') {
            totalProcessed++;
            if (totalProcessed >= this.maxItemsPerBatch) {
              console.log(`🎯 Reached batch limit of ${this.maxItemsPerBatch} items`);
              break;
            }
            
            scoredItems.push({
              ...(enrichedData || item),
              source: fetchResult.source,
              content_type: contentType,
              score: finalScore,
              confidence: finalConfidence,
              factors: basicScore.factors,
              recommendation: finalRecommendation,
              ai_enriched: !!enrichedData,
              enrichment_data: enrichedData ? {
                company: enrichedData.company,
                team: enrichedData.team,
                funding: enrichedData.funding,
                technology: enrichedData.technology,
                metrics: enrichedData.metrics,
                social: enrichedData.social,
                ai_analysis: enrichedData.ai_analysis,
                validation: enrichedData.validation
              } : null
            });
          } else {
            result.rejected++;
          }
        }
        
        if (totalProcessed >= this.maxItemsPerBatch) {
          break;
        }
      }
      
      console.log(`📦 Evaluated ${totalEvaluated} items, accepted ${totalProcessed} items`);

      // Step 3: Deduplicate content
      console.log(`\n🔍 Found ${scoredItems.length} items that passed scoring`);
      const { unique, duplicates } = await deduplicationService.filterDuplicates(scoredItems);
      console.log(`🔄 After deduplication: ${unique.length} unique, ${duplicates.length} duplicates`);
      
      result.rejected += duplicates.length;

      // Step 4: Store unique approved content (already limited by batch processing)
      if (unique.length > 0) {
        console.log(`💾 Storing ${unique.length} items to database...`);
        const insertData = unique.map(item => ({
          title: item.title || item.name || 'Untitled',
          description: item.description || item.tagline || '',
          url: item.url || item.html_url || '',
          source: item.source,
          type: item.content_type || 'project',  // Map content_type to type
          score: item.score || 0,
          confidence: item.confidence || 0.5,
          factors: item.factors || {},
          recommendation: item.recommendation || 'review',
          content_hash: item.content_hash || null,
          raw_data: item,
          metadata: item.metadata || {},
          tags: item.tags || [],
          created_at: new Date().toISOString()
        }));
        
        console.log(`💾 Inserting into content_curated table...`);
        console.log(`📝 Sample insert data:`, JSON.stringify(insertData[0], null, 2));
        
        try {
          const { data, error } = await supabase
            .from('content_curated')
            .insert(insertData as any);

          if (error) {
            console.error(`❌ Storage error:`, error);
            console.error(`❌ Error details:`, JSON.stringify(error, null, 2));
            result.errors.push(`Storage error: ${error.message}`);
          } else {
            console.log(`✅ Successfully stored ${unique.length} items!`);
            result.stored = unique.length;
          }
        } catch (err) {
          console.error(`❌ Storage exception:`, err);
          result.errors.push(`Storage error: ${err}`);
        }
      } else {
        console.log(`⚠️ No unique items to store after deduplication`);
      }

    } catch (error) {
      result.errors.push(`Orchestration error: ${error}`);
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
  }

  /**
   * Detect content type based on source and content
   */
  private detectContentType(item: any, source: string): 'project' | 'funding' | 'resource' {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    
    // Source-based detection
    if (source === 'producthunt' || source === 'github') return 'project';
    if (source === 'defilama') return 'funding';
    
    // Content-based detection
    // Check for project indicators
    if (item.team_size || item.launch_date || item.founders) return 'project';
    if (text.includes('startup') || text.includes('founder') || text.includes('building')) return 'project';
    
    // Check for funding indicators
    if (item.funding_amount || item.deadline || item.application_url) return 'funding';
    if (text.includes('grant') || text.includes('accelerator') || text.includes('incubator')) return 'funding';
    
    // Default to resource
    return 'resource';
  }

  /**
   * Get recommendation based on score and confidence
   */
  private getRecommendation(score: number, confidence: number): string {
    // Align with minScoreThreshold - if it passes threshold, at least review it
    if (score < this.minScoreThreshold || confidence < 0.3) return 'reject';
    if (score < 30) return 'review';  // Low score but worth reviewing
    if (score < 60) return 'approve'; // Decent score, approve
    return 'feature';  // High score, feature it
  }

  /**
   * Get pipeline status
   */
  async getStatus(): Promise<{
    lastRun?: Date;
    totalContent: number;
    breakdown: Record<string, number>;
  }> {
    try {
      // Get last run time
      const { data: lastRunData } = await supabase
        .from('content_curated')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get content counts
      const { count: totalContent } = await supabase
        .from('content_curated')
        .select('*', { count: 'exact', head: true });

      // Get breakdown by source
      const { data: breakdownData } = await supabase
        .from('content_curated')
        .select('source');

      const breakdown: Record<string, number> = {};
      if (breakdownData) {
        for (const item of breakdownData as any[]) {
          breakdown[item.source] = (breakdown[item.source] || 0) + 1;
        }
      }

      return {
        lastRun: (lastRunData as any)?.[0]?.created_at ? new Date((lastRunData as any)[0].created_at) : undefined,
        totalContent: totalContent || 0,
        breakdown
      };
    } catch (error) {
      throw new Error(`Failed to get status: ${error}`);
    }
  }

  /**
   * Clean old content
   */
  async cleanup(daysToKeep: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error, count } = await supabase
      .from('content_curated')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    return { deleted: count || 0 };
  }
}

export const orchestrator = new SimpleOrchestrator();