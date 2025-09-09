import { ContentItem } from '../lib/base-fetcher';
import { EntityResolver } from './entity-resolver';
import { AccelerateScorer } from '../lib/accelerate-scorer';

/**
 * DATA AGGREGATOR SERVICE
 * Combines data from multiple sources into unified, enriched results
 * This is the key to getting rich, high-quality data
 */

export interface AggregationResult {
  original_count: number;
  unified_count: number;
  enriched_count: number;
  average_completeness: number;
  sources_used: string[];
  items: ContentItem[];
}

export class DataAggregator {
  private entityResolver: EntityResolver;
  
  constructor() {
    this.entityResolver = new EntityResolver();
  }
  
  /**
   * Aggregate and enrich items from multiple sources
   */
  public async aggregate(items: ContentItem[]): Promise<AggregationResult> {
    console.log(`\n🔄 AGGREGATING ${items.length} items from multiple sources...`);
    
    // Step 1: Group by type for better matching
    const byType = this.groupByType(items);
    
    // Step 2: Resolve entities within each type
    const resolvedByType: ContentItem[] = [];
    
    for (const [type, typeItems] of Object.entries(byType)) {
      console.log(`  Processing ${typeItems.length} ${type} items...`);
      
      // Resolve entities (merge duplicates)
      const entities = this.entityResolver.resolveEntities(typeItems);
      
      // Convert back to content items with merged data
      const enrichedItems = this.entityResolver.entitiesToContentItems(entities);
      
      console.log(`  ✅ Resolved to ${enrichedItems.length} unique ${type}s`);
      
      resolvedByType.push(...enrichedItems);
    }
    
    // Step 3: Cross-enrich between types
    const crossEnriched = this.crossEnrichItems(resolvedByType);
    
    // Step 4: Fill gaps with inferred data
    const gapFilled = this.fillDataGaps(crossEnriched);
    
    // Step 5: Re-score with complete data
    const rescored = this.rescoreItems(gapFilled);
    
    // Step 6: Sort by quality and relevance
    const sorted = rescored.sort((a, b) => {
      const scoreA = a.metadata?.accelerate_score || 0;
      const scoreB = b.metadata?.accelerate_score || 0;
      return scoreB - scoreA;
    });
    
    // Calculate statistics
    const sources = new Set(items.map(i => i.source));
    const avgCompleteness = sorted.reduce((sum, item) => {
      return sum + (item.metadata?.data_completeness || 0);
    }, 0) / sorted.length;
    
    console.log(`\n📊 AGGREGATION COMPLETE:`);
    console.log(`  • Original items: ${items.length}`);
    console.log(`  • Unified entities: ${sorted.length}`);
    console.log(`  • Average completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`  • Sources combined: ${Array.from(sources).join(', ')}`);
    
    return {
      original_count: items.length,
      unified_count: sorted.length,
      enriched_count: sorted.filter(i => (i.metadata?.data_completeness || 0) > 50).length,
      average_completeness: avgCompleteness,
      sources_used: Array.from(sources),
      items: sorted,
    };
  }
  
  /**
   * Group items by type for better matching
   */
  private groupByType(items: ContentItem[]): Record<string, ContentItem[]> {
    const groups: Record<string, ContentItem[]> = {};
    
    for (const item of items) {
      const type = item.type || 'unknown';
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    }
    
    return groups;
  }
  
  /**
   * Cross-enrich items between different types
   * E.g., match a project with its funding announcement
   */
  private crossEnrichItems(items: ContentItem[]): ContentItem[] {
    const enriched = [...items];
    
    // Index items by name for cross-referencing
    const byName = new Map<string, ContentItem[]>();
    
    for (const item of items) {
      const name = this.normalizeCompanyName(item.title);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name)!.push(item);
    }
    
    // Cross-enrich items with same name
    for (const [name, relatedItems] of byName.entries()) {
      if (relatedItems.length > 1) {
        // Merge metadata across related items
        const mergedMeta: Record<string, any> = {};
        
        for (const item of relatedItems) {
          if (item.metadata) {
            for (const [key, value] of Object.entries(item.metadata)) {
              if (value && !mergedMeta[key]) {
                mergedMeta[key] = value;
              }
            }
          }
        }
        
        // Update all related items with merged metadata
        for (const item of relatedItems) {
          item.metadata = {
            ...mergedMeta,
            ...item.metadata, // Preserve original values
            cross_enriched: true,
            related_items: relatedItems.length - 1,
          };
        }
      }
    }
    
    return enriched;
  }
  
  /**
   * Fill data gaps with inferred or estimated values
   */
  private fillDataGaps(items: ContentItem[]): ContentItem[] {
    return items.map(item => {
      const meta = item.metadata || {};
      
      // Infer launch year from various sources
      if (!meta.launch_year) {
        if (meta.yc_batch) {
          // Extract year from YC batch (W24 -> 2024)
          meta.launch_year = parseInt('20' + meta.yc_batch.substring(1));
        } else if (meta.launch_date) {
          meta.launch_year = new Date(meta.launch_date).getFullYear();
        } else if (item.published) {
          // Assume launched near publication date
          meta.launch_year = new Date(item.published).getFullYear();
        }
      }
      
      // Estimate team size if missing
      if (!meta.team_size) {
        if (meta.is_solo_founder) {
          meta.team_size = 1;
        } else if (meta.funding_raised && meta.funding_raised > 200000) {
          meta.team_size = 3; // Funded startups usually have small teams
        } else if (meta.yc_batch) {
          meta.team_size = 2; // YC companies typically have 2+ founders
        } else {
          meta.team_size = 1; // Conservative estimate
        }
      }
      
      // Estimate funding stage if missing
      if (!meta.funding_stage) {
        if (meta.funding_raised) {
          if (meta.funding_raised < 150000) meta.funding_stage = 'pre-seed';
          else if (meta.funding_raised < 500000) meta.funding_stage = 'seed';
          else meta.funding_stage = 'series-a';
        } else if (meta.yc_batch) {
          meta.funding_stage = 'seed'; // YC provides seed funding
        } else {
          meta.funding_stage = 'pre-seed'; // Default for unknowns
        }
      }
      
      // Calculate data completeness
      meta.data_completeness = this.calculateCompleteness(meta);
      
      // Add enrichment timestamp
      meta.enriched_at = new Date().toISOString();
      
      return {
        ...item,
        metadata: meta
      };
    });
  }
  
  /**
   * Re-score items with complete aggregated data
   */
  private rescoreItems(items: ContentItem[]): ContentItem[] {
    // Use ACCELERATE scorer with enhanced data
    const scored = AccelerateScorer.scoreAndRank(items);
    
    // Boost scores for highly complete data
    return scored.map(item => {
      const meta = item.metadata || {};
      const completeness = meta.data_completeness || 0;
      
      // Boost score based on data completeness
      if (completeness > 80) {
        meta.accelerate_score = Math.min(100, (meta.accelerate_score || 0) + 10);
      } else if (completeness > 60) {
        meta.accelerate_score = Math.min(100, (meta.accelerate_score || 0) + 5);
      }
      
      // Boost for multiple source verification
      if (meta.merged_from_sources?.length > 2) {
        meta.accelerate_score = Math.min(100, (meta.accelerate_score || 0) + 10);
        meta.is_verified = true;
      }
      
      return {
        ...item,
        metadata: meta
      };
    });
  }
  
  /**
   * Calculate how complete the data is
   */
  private calculateCompleteness(metadata: Record<string, any>): number {
    const requiredFields = [
      'launch_year', 'team_size', 'funding_stage'
    ];
    
    const importantFields = [
      'funding_raised', 'website', 'description',
      'github_url', 'twitter_url', 'location'
    ];
    
    const bonusFields = [
      'yc_batch', 'ai_score', 'social_handles',
      'discord_url', 'product_hunt_url'
    ];
    
    let score = 0;
    let maxScore = 0;
    
    // Required fields (weight: 3)
    for (const field of requiredFields) {
      maxScore += 3;
      if (metadata[field]) score += 3;
    }
    
    // Important fields (weight: 2)
    for (const field of importantFields) {
      maxScore += 2;
      if (metadata[field]) score += 2;
    }
    
    // Bonus fields (weight: 1)
    for (const field of bonusFields) {
      maxScore += 1;
      if (metadata[field]) score += 1;
    }
    
    return Math.round((score / maxScore) * 100);
  }
  
  /**
   * Normalize company name for matching
   */
  private normalizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|company|co|io|ai|app|labs?)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Get aggregation statistics
   */
  public getStatistics(result: AggregationResult): {
    deduplication_rate: number;
    enrichment_rate: number;
    high_quality_rate: number;
    sources_per_item: number;
  } {
    const deduplicationRate = 1 - (result.unified_count / result.original_count);
    const enrichmentRate = result.enriched_count / result.unified_count;
    
    const highQualityCount = result.items.filter(i => 
      (i.metadata?.accelerate_score || 0) > 60
    ).length;
    const highQualityRate = highQualityCount / result.unified_count;
    
    const totalSourceMentions = result.items.reduce((sum, item) => {
      return sum + (item.metadata?.merged_from_sources?.length || 1);
    }, 0);
    const sourcesPerItem = totalSourceMentions / result.unified_count;
    
    return {
      deduplication_rate: deduplicationRate,
      enrichment_rate: enrichmentRate,
      high_quality_rate: highQualityRate,
      sources_per_item: sourcesPerItem,
    };
  }
}