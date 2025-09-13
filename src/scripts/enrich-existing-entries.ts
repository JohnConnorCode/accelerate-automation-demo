#!/usr/bin/env tsx

/**
 * Enrich existing database entries with additional information
 */

import { supabase } from '../lib/supabase-client';
import { EnrichmentService } from '../services/enrichment';

interface EnrichableItem {
  id: string;
  title: string;
  description: string;
  url: string;
  type: string;
  metadata: any;
  enrichment_status: string;
  enrichment_data: any;
}

class ExistingEntryEnricher {
  private enrichmentService: EnrichmentService;
  
  constructor() {
    this.enrichmentService = new EnrichmentService();
  }
  
  /**
   * Get items that need enrichment
   */
  async getUnenrichedItems(limit: number = 10): Promise<EnrichableItem[]> {
    const { data, error } = await supabase
      .from('content_queue')
      .select('*')
      .or('enrichment_status.is.null,enrichment_status.neq.completed')
      .eq('status', 'pending_review')
      .order('score', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching unenriched items:', error);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Enrich a single item
   */
  async enrichItem(item: EnrichableItem): Promise<boolean> {
    console.log(`\n🔍 Enriching: ${item.title}`);
    
    try {
      // Use the enrichment service to enrich the item
      const enrichedData = await this.enrichmentService.enrichContent({
        title: item.title,
        description: item.description,
        url: item.url,
        source: 'database',
        type: item.type as any,
        metadata: item.metadata
      });
      
      // Combine enrichment data
      const enrichmentData = {
        ...enrichedData,
        enriched_at: new Date().toISOString(),
        sources: ['data-enricher']
      };
      
      // Update the database
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({
          enrichment_data: enrichmentData,
          enrichment_status: 'completed',
          ai_summary: enrichedData?.ai_analysis?.summary || item.description,
          metadata: {
            ...item.metadata,
            ...enrichmentData
          }
        })
        .eq('id', item.id);
      
      if (updateError) {
        console.error(`❌ Failed to update item ${item.id}:`, updateError);
        return false;
      }
      
      console.log(`✅ Enriched: ${item.title}`);
      console.log(`   Sources: ${enrichmentData.sources.join(', ')}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Enrichment failed for ${item.title}:`, error);
      
      // Mark as failed
      await supabase
        .from('content_queue')
        .update({
          enrichment_status: 'failed',
          enrichment_data: {
            error: error.message,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', item.id);
      
      return false;
    }
  }
  
  /**
   * Enrich all unenriched items
   */
  async enrichAll(batchSize: number = 10): Promise<void> {
    console.log('🚀 Starting bulk enrichment...\n');
    
    let totalEnriched = 0;
    let totalFailed = 0;
    let hasMore = true;
    
    while (hasMore) {
      const items = await this.getUnenrichedItems(batchSize);
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`\n📦 Processing batch of ${items.length} items...`);
      
      for (const item of items) {
        const success = await this.enrichItem(item);
        if (success) {
          totalEnriched++;
        } else {
          totalFailed++;
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`\n📊 Batch complete. Enriched: ${totalEnriched}, Failed: ${totalFailed}`);
      
      // Check if we should continue
      if (items.length < batchSize) {
        hasMore = false;
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ ENRICHMENT COMPLETE');
    console.log(`   Total enriched: ${totalEnriched}`);
    console.log(`   Total failed: ${totalFailed}`);
  }
  
  /**
   * Re-enrich items that previously failed
   */
  async retryFailed(): Promise<void> {
    console.log('🔄 Retrying failed enrichments...\n');
    
    const { data: failedItems } = await supabase
      .from('content_queue')
      .select('*')
      .eq('enrichment_status', 'failed')
      .limit(20);
    
    if (!failedItems || failedItems.length === 0) {
      console.log('✅ No failed items to retry');
      return;
    }
    
    console.log(`Found ${failedItems.length} failed items to retry`);
    
    let retrySuccess = 0;
    for (const item of failedItems) {
      const success = await this.enrichItem(item);
      if (success) {retrySuccess++;}
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Retry complete: ${retrySuccess}/${failedItems.length} succeeded`);
  }
  
  /**
   * Get enrichment statistics
   */
  async getStats(): Promise<void> {
    console.log('📊 ENRICHMENT STATISTICS\n');
    
    const { data: stats } = await supabase
      .from('content_queue')
      .select('enrichment_status');
    
    if (!stats) {
      console.log('No data available');
      return;
    }
    
    const statusCounts = stats.reduce((acc: any, item: any) => {
      const status = item.enrichment_status || 'not_enriched';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Enrichment status breakdown:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    const total = stats.length;
    const completed = statusCounts.completed || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    console.log(`\n📈 Overall completion: ${percentage}% (${completed}/${total})`);
  }
}

// Main execution
async function main() {
  const enricher = new ExistingEntryEnricher();
  
  console.log('🎯 DATABASE ENTRY ENRICHMENT TOOL\n');
  console.log('=' .repeat(60));
  
  // Get current stats
  await enricher.getStats();
  
  console.log('\n' + '=' .repeat(60));
  console.log('\nOptions:');
  console.log('1. Enrich all unenriched items');
  console.log('2. Retry failed enrichments');
  console.log('3. Show statistics only');
  
  // For automated run, enrich a small batch
  const args = process.argv.slice(2);
  const action = args[0] || 'enrich';
  const limit = parseInt(args[1]) || 5;
  
  switch (action) {
    case 'retry':
      await enricher.retryFailed();
      break;
    case 'stats':
      // Already shown above
      break;
    case 'enrich':
    default:
      console.log(`\n🚀 Enriching up to ${limit} items...`);
      await enricher.enrichAll(limit);
      break;
  }
  
  // Show final stats
  console.log('\n' + '=' .repeat(60));
  await enricher.getStats();
}

main().catch(console.error);