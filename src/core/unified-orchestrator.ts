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
// Import the no-API sources that actually work
import { getNoApiSources } from '../fetchers/no-api-sources';
import { deduplicationService } from '../services/deduplication';
import { stagingService } from '../services/staging-service';
import { logger } from '../services/logger';
import { metricsService } from '../services/metrics';
import { ErrorHandler, ErrorSeverity, AppError } from '../utils/error-handler';

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
  private fetchers: any[] = [];

  constructor() {
    // Initialize ONLY working fetchers from no-API sources
    this.fetchers = getNoApiSources();
    console.log(`📊 Initialized ${this.fetchers.length} data fetchers (no API keys required)`);
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
      const validated = this.validateAccelerateCriteria(allContent);
      console.log(`✅ ${validated.length} items meet ACCELERATE criteria`);

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

      // Step 4: Insert to queue tables
      console.log('\n💾 Step 4: Inserting to queue tables...');
      const insertResult = await stagingService.insertToStaging(unique);
      
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
   * Fetch from all sources in parallel
   */
  private async fetchFromSources(): Promise<ContentItem[]> {
    const results = await Promise.allSettled(
      this.fetchers.map(async source => {
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
              
              // Transform to ContentItem format
              const contentItems = items.map((item: any) => ({
                ...item,
                type: source.type || this.inferType(item),
                source: source.name
              }));
              
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
   * Validate items against ACCELERATE criteria
   */
  private validateAccelerateCriteria(items: ContentItem[]): ContentItem[] {
    return items.filter(item => {
      // Basic validation - must have essential fields
      if (!item.url) return false;
      if (!item.title && !item.name) return false;
      if (!item.type) return false;

      // Type-specific ACCELERATE criteria
      if (item.type === 'project') {
        const metadata = item.metadata || {};
        
        // Must be from 2024 or later
        if (metadata.launch_date) {
          const year = new Date(metadata.launch_date).getFullYear();
          if (year < 2024) return false;
        }
        
        // Must have less than $500k funding
        if (metadata.funding_raised && metadata.funding_raised > 500000) {
          return false;
        }
        
        // Must have small team (1-10 people)
        if (metadata.team_size && metadata.team_size > 10) {
          return false;
        }

        // If we have a score, it should be decent
        if (item.score && item.score < 30) {
          return false;
        }

        return true;
      }

      // Funding and resources are generally good
      return item.type === 'funding' || item.type === 'resource';
    });
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