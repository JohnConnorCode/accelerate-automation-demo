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

interface OrchestrationResult {
  fetched: number;
  scored: number;
  stored: number;
  rejected: number;
  duration: number;
  errors: string[];
}

export class SimpleOrchestrator {
  private readonly sources = new Map([
    ['github', 'https://api.github.com/search/repositories?q=stars:>100+language:typescript&sort=updated'],
    ['hackernews', 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=50'],
    ['producthunt', 'https://api.producthunt.com/v2/api/graphql'],
    ['devto', 'https://dev.to/api/articles?per_page=30&tag=webdev,javascript,react'],
    ['defilama', 'https://api.llama.fi/protocols'],
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
      // Step 1: Fetch content
      const fetchResults = await fetcher.fetchAll(this.sources);
      
      // Count fetched items
      for (const fetchResult of fetchResults) {
        result.fetched += fetchResult.items.length;
        result.errors.push(...fetchResult.errors);
      }

      // Step 2: Score and filter content with AI enrichment
      const scoredItems = [];
      for (const fetchResult of fetchResults) {
        for (const item of fetchResult.items) {
          // First get basic score
          const basicScore = scorer.score(item);
          result.scored++;
          
          // Skip if basic score is too low
          if (basicScore.score < 20) {
            result.rejected++;
            continue;
          }
          
          // Detect content type using dynamic criteria
          const contentType = this.detectContentType(item, fetchResult.source);
          console.log(`📋 Detected type: ${contentType}`);
          
          // Full enrichment for promising items
          let enrichedData = null;
          let finalScore = basicScore.score;
          let finalConfidence = basicScore.confidence;
          
          try {
            // Perform comprehensive enrichment
            enrichedData = await enrichmentService.enrichContent(item, fetchResult.source);
            
            // Calculate score using dynamic criteria from database
            const dynamicScore = await criteriaService.scoreContent(
              enrichedData || item,
              contentType
            );
            
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
      }

      // Step 3: Deduplicate content
      const { unique, duplicates } = await deduplicationService.filterDuplicates(scoredItems);
      result.rejected += duplicates.length;

      // Step 4: Store unique approved content
      if (unique.length > 0) {
        const { data, error } = await supabase
          .from('content_curated')
          .insert(unique.map(item => ({
            title: item.title || item.name || 'Untitled',
            description: item.description || item.tagline || '',
            url: item.url || item.html_url || '',
            source: item.source,
            content_type: item.content_type,
            type_confidence: item.type_confidence,
            score: item.score,
            confidence: item.confidence,
            factors: item.factors,
            recommendation: item.recommendation,
            content_hash: item.content_hash,
            raw_data: item,
            created_at: new Date().toISOString()
          })));

        if (error) {
          result.errors.push(`Storage error: ${error.message}`);
        } else {
          result.stored = unique.length;
        }
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
    if (score < 30 || confidence < 0.4) return 'reject';
    if (score < 50) return 'review';
    if (score < 75) return 'approve';
    return 'feature';
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
        for (const item of breakdownData) {
          breakdown[item.source] = (breakdown[item.source] || 0) + 1;
        }
      }

      return {
        lastRun: lastRunData?.[0]?.created_at ? new Date(lastRunData[0].created_at) : undefined,
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