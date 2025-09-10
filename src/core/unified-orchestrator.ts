/**
 * UNIFIED ORCHESTRATOR - The ONLY orchestrator in the system
 * 
 * Simple, reliable, testable pipeline:
 * 1. Fetch from sources
 * 2. Validate ACCELERATE criteria  
 * 3. Deduplicate
 * 4. Insert to queue tables
 * 
 * NO enrichment, NO aggregation, NO AI until basics work
 */

import { ContentItem } from '../types';
import { deduplicationService } from '../services/deduplication';
import { stagingService } from '../services/staging-service';
import { logger } from '../services/logger';
import { metricsService } from '../services/metrics';
import { ErrorHandler, ErrorSeverity, AppError } from '../utils/error-handler';
import { AccelerateValidator } from '../validators/accelerate-validator';
import { MetadataExtractor } from '../services/metadata-extractor';
import { aiScorer } from '../services/ai-scorer';

export interface OrchestratorResult {
  success: boolean;
  fetched: number;
  validated: number;
  unique: number;
  inserted: number;
  errors: string[];
  duration: number;
}

export class UnifiedOrchestrator {
  constructor() {
    console.log(`📊 Unified Orchestrator initialized`);
  }

  /**
   * Main pipeline - KISS principle
   */
  async run(): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      // Step 1: Fetch from all sources
      console.log('\n🔍 Step 1: Fetching from sources...');
      const allContent = await this.fetchFromSources();
      console.log(`✅ Fetched ${allContent.length} items`);
      
      if (allContent.length === 0) {
        return {
          success: false,
          fetched: 0,
          validated: 0,
          unique: 0,
          inserted: 0,
          errors: ['No content fetched from any source'],
          duration: Date.now() - startTime
        };
      }

      // Step 2: Validate ACCELERATE criteria
      console.log('\n✅ Step 2: Validating ACCELERATE criteria...');
      const validationResult = AccelerateValidator.validateBatch(allContent);
      const validated = validationResult.valid;
      
      console.log(`✅ ${validated.length} items meet ACCELERATE criteria`);
      console.log(`   Perfect: ${validationResult.stats.byCategory.perfect}`);
      console.log(`   Good: ${validationResult.stats.byCategory.good}`);
      console.log(`   Maybe: ${validationResult.stats.byCategory.maybe}`);
      console.log(`   Rejected: ${validationResult.stats.byCategory.rejected}`);

      if (validated.length === 0) {
        return {
          success: true,
          fetched: allContent.length,
          validated: 0,
          unique: 0,
          inserted: 0,
          errors: ['No items met ACCELERATE criteria'],
          duration: Date.now() - startTime
        };
      }

      // Step 3: Deduplicate
      console.log('\n🔁 Step 3: Deduplicating...');
      const { unique, duplicates } = await deduplicationService.filterDuplicates(validated);
      console.log(`✅ ${unique.length} unique items (${duplicates.length} duplicates removed)`);

      if (unique.length === 0) {
        return {
          success: true,
          fetched: allContent.length,
          validated: validated.length,
          unique: 0,
          inserted: 0,
          errors: ['All items were duplicates'],
          duration: Date.now() - startTime
        };
      }
      
      // Step 3.5: REAL AI SCORING - No more fake scores!
      console.log('\n🤖 Step 3.5: AI Scoring...');
      const scoringResults = await aiScorer.scoreBatch(unique);
      
      // Apply real scores to items
      const enrichedItems = unique.map(item => {
        const itemId = item.id || item.url || item.title || 'unknown';
        const scoring = scoringResults.get(itemId) || {
          score: 5,
          accelerate_fit: false,
          reasoning: 'Unable to score',
          confidence: 0.5,
          criteria_met: {}
        };
        
        return {
          ...item,
          accelerate_fit: scoring.accelerate_fit,
          accelerate_score: scoring.score,
          accelerate_reason: scoring.reasoning,
          confidence_score: scoring.confidence,
          criteria_met: scoring.criteria_met
        };
      });
      
      // Log some real scores
      const sampleScores = enrichedItems.slice(0, 3).map(item => ({
        name: item.title || item.company_name || item.name,
        score: item.accelerate_score,
        fit: item.accelerate_fit,
        reason: item.accelerate_reason
      }));
      console.log('   Sample scores:', JSON.stringify(sampleScores, null, 2));

      // Step 4: Insert to queue tables
      console.log('\n💾 Step 4: Inserting to queue tables...');
      const insertResult = await stagingService.insertToStaging(enrichedItems);
      
      const totalInserted = 
        insertResult.inserted.projects + 
        insertResult.inserted.funding + 
        insertResult.inserted.resources;
      
      console.log(`✅ Inserted ${totalInserted} items to queue`);
      console.log(`   Projects: ${insertResult.inserted.projects}`);
      console.log(`   Funding: ${insertResult.inserted.funding}`);
      console.log(`   Resources: ${insertResult.inserted.resources}`);
      
      if (insertResult.errors.length > 0) {
        errors.push(...insertResult.errors);
      }

      // Track metrics
      const duration = Date.now() - startTime;
      metricsService.trackFetch(totalInserted, duration);

      // Calculate success
      const successRate = allContent.length > 0 
        ? ((totalInserted / allContent.length) * 100).toFixed(1)
        : 0;
      
      console.log(`\n📈 Pipeline Complete:`);
      console.log(`   Success rate: ${successRate}%`);
      console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);

      return {
        success: totalInserted > 0,
        fetched: allContent.length,
        validated: validated.length,
        unique: unique.length,
        inserted: totalInserted,
        errors,
        duration
      };

    } catch (error) {
      logger.error('Pipeline failed', error);
      errors.push(`Fatal error: ${error}`);
      
      return {
        success: false,
        fetched: 0,
        validated: 0,
        unique: 0,
        inserted: 0,
        errors,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get MULTIPLE data sources - not just 2!
   */
  private getSources() {
    return [
      // Original sources
      {
        name: 'HackerNews Show HN',
        url: 'https://hn.algolia.com/api/v1/search?tags=show_hn&hitsPerPage=20',
        parser: (data: any) => data.hits || []
      },
      {
        name: 'GitHub Trending',
        url: 'https://api.github.com/search/repositories?q=created:>2024-01-01&sort=stars&order=desc&per_page=20',
        parser: (data: any) => data.items || []
      },
      // Add more diverse sources
      {
        name: 'GitHub Web3',
        url: 'https://api.github.com/search/repositories?q=web3+OR+blockchain+OR+defi+created:>2024-01-01&sort=updated&per_page=20',
        parser: (data: any) => data.items || []
      },
      {
        name: 'GitHub AI Startups',
        url: 'https://api.github.com/search/repositories?q=ai+OR+ml+OR+gpt+created:>2024-01-01&sort=stars&per_page=20',
        parser: (data: any) => data.items || []
      },
      {
        name: 'HackerNews Ask HN',
        url: 'https://hn.algolia.com/api/v1/search?tags=ask_hn&query=startup&hitsPerPage=10',
        parser: (data: any) => data.hits || []
      },
      {
        name: 'HackerNews Jobs',
        url: 'https://hn.algolia.com/api/v1/search?tags=job&query=startup+OR+founding&hitsPerPage=10',
        parser: (data: any) => data.hits || []
      },
      {
        name: 'DevTo Startups',
        url: 'https://dev.to/api/articles?tag=startup&per_page=10',
        parser: (data: any) => data || []
      },
      {
        name: 'DevTo Web3',
        url: 'https://dev.to/api/articles?tag=web3&per_page=10',
        parser: (data: any) => data || []
      }
    ];
  }

  /**
   * Fetch from all sources in parallel
   */
  private async fetchFromSources(): Promise<ContentItem[]> {
    const sources = this.getSources();
    const results = await Promise.allSettled(
      sources.map(async source => {
        return await ErrorHandler.wrap(
          async () => {
            console.log(`   Fetching from ${source.name}...`);
            
            // Fetch with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
            
            try {
              const response = await fetch(source.url, { signal: controller.signal });
              clearTimeout(timeout);
              
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              
              const data = await response.json();
              const items = source.parser(data);
              
              // Transform to ContentItem format with metadata extraction
              const contentItems = items.map((item: any) => {
                // Use MetadataExtractor for proper extraction
                return MetadataExtractor.extract(item, source.name);
              });
              
              console.log(`   ✓ ${source.name}: ${contentItems.length} items`);
              return contentItems;
            } finally {
              clearTimeout(timeout);
            }
          },
          `Fetching from ${source.name}`,
          ErrorSeverity.LOW // Individual source failures are low severity
        ) || [];
      })
    );

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as any).value)
      .flat();
  }

  /**
   * Infer content type from item data
   */
  private inferType(item: any): 'project' | 'funding' | 'resource' {
    if (item.funding_amount || item.investment_size) return 'funding';
    if (item.company_name || item.startup_name || item.team_size) return 'project';
    return 'resource';
  }


  /**
   * Get current pipeline status
   */
  async getStatus() {
    const metrics = await metricsService.getMetrics();
    
    return {
      healthy: metrics.successRate > 50,
      lastRun: metrics.lastFetchTime,
      successRate: metrics.successRate,
      queueDepth: metrics.queueDepth,
      fetchCount: metrics.fetchCount
    };
  }
}