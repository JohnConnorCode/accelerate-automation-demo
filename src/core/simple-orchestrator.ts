/**
 * Simple orchestrator - coordinates fetching, scoring, and storing
 */
import { fetcher } from './simple-fetcher';
import { scorer } from './simple-scorer';
import { supabase } from '../lib/supabase-client';

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

      // Step 2: Score and filter content
      const scoredItems = [];
      for (const fetchResult of fetchResults) {
        for (const item of fetchResult.items) {
          const scoreResult = scorer.score(item);
          result.scored++;
          
          if (scoreResult.recommendation !== 'reject') {
            scoredItems.push({
              ...item,
              source: fetchResult.source,
              score: scoreResult.score,
              confidence: scoreResult.confidence,
              factors: scoreResult.factors,
              recommendation: scoreResult.recommendation
            });
          } else {
            result.rejected++;
          }
        }
      }

      // Step 3: Store approved content
      if (scoredItems.length > 0) {
        const { data, error } = await supabase
          .from('content_curated')
          .insert(scoredItems.map(item => ({
            title: item.title || item.name || 'Untitled',
            description: item.description || item.tagline || '',
            url: item.url || item.html_url || '',
            source: item.source,
            score: item.score,
            confidence: item.confidence,
            factors: item.factors,
            recommendation: item.recommendation,
            raw_data: item,
            created_at: new Date().toISOString()
          })));

        if (error) {
          result.errors.push(`Storage error: ${error.message}`);
        } else {
          result.stored = scoredItems.length;
        }
      }

    } catch (error) {
      result.errors.push(`Orchestration error: ${error}`);
    }

    result.duration = (Date.now() - startTime) / 1000;
    return result;
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