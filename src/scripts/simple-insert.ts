#!/usr/bin/env node
/**
 * Simplified script to fetch and insert data without enrichment
 * This bypasses the heavy aggregation and enrichment pipelines
 */

import type { Database } from '../types/supabase';
import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { RedditStartupsFetcher } from '../fetchers/real-sources/reddit-startups';

config();

async function main() {
  console.log('🚀 Starting simplified data insertion...\n');
  
  const allItems: any[] = [];
  const errors: string[] = [];
  
  try {
    // 1. Fetch YC Companies
    console.log('📡 Fetching YC companies...');
    const ycFetcher = new YCombinatorStartupsFetcher();
    try {
      const ycRaw = await ycFetcher.fetch();
      const ycData = await ycFetcher.transform(ycRaw);
      console.log(`✅ Got ${ycData.length} YC companies`);
      allItems.push(...ycData.slice(0, 20)); // Take top 20
    } catch (e) {
      console.log('⚠️ YC fetch failed:', e);
      errors.push(`YC: ${e}`);
    }
    
    // 2. Fetch RSS Items
    console.log('\n📡 Fetching RSS feeds...');
    const rssFetcher = new RSSAggregatorFetcher();
    try {
      const rssRaw = await rssFetcher.fetch();
      const rssData = await rssFetcher.transform(rssRaw);
      console.log(`✅ Got ${rssData.length} RSS items`);
      allItems.push(...rssData.slice(0, 10)); // Take top 10
    } catch (e) {
      console.log('⚠️ RSS fetch failed:', e);
      errors.push(`RSS: ${e}`);
    }
    
    // 3. Fetch Reddit Posts
    console.log('\n📡 Fetching Reddit posts...');
    const redditFetcher = new RedditStartupsFetcher();
    try {
      const redditRaw = await redditFetcher.fetch();
      const redditData = await redditFetcher.transform(redditRaw);
      console.log(`✅ Got ${redditData.length} Reddit posts`);
      allItems.push(...redditData.slice(0, 10)); // Take top 10
    } catch (e) {
      console.log('⚠️ Reddit fetch failed:', e);
      errors.push(`Reddit: ${e}`);
    }
    
    console.log(`\n📊 Total items collected: ${allItems.length}`);
    
    if (allItems.length === 0) {
      console.log('❌ No items to insert');
      return;
    }
    
    // 4. Prepare for insertion
    console.log('\n💾 Preparing data for insertion...');
    
    const queueData = allItems.map(item => ({
      // Required fields
      title: item.title || item.name || 'Untitled',
      description: (item.description || '').substring(0, 2000),
      url: item.url || '',
      source: item.source || 'unknown',
      type: item.type || 'project',
      
      // Scoring
      score: item.metadata?.accelerate_score || 50,
      confidence: 0.7,
      factors: {
        recency: 0.8,
        relevance: 0.7,
        quality: 0.6
      },
      
      // Queue specific  
      status: 'pending_review',
      recommendation: 'approve',
      
      // Metadata
      raw_data: {
        ...item,
        simplified: true,
        inserted_at: new Date().toISOString()
      },
      metadata: item.metadata || {},
      tags: item.tags || [],
      
      // Timestamps
      queued_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    
    console.log('📝 Sample item to insert:');
    console.log(JSON.stringify(queueData[0], null, 2).substring(0, 500) + '...');
    
    // 5. Insert to content_queue
    console.log(`\n💾 Inserting ${queueData.length} items to content_queue...`);
    
    let inserted = 0;
    let failed = 0;
    
    // Insert in small batches
    const batchSize = 3;
    for (let i = 0; i < queueData.length; i += batchSize) {
      const batch = queueData.slice(i, i + batchSize);
      
      try {
        const { data, error } = await supabase
          .from('content_queue')
          .insert(batch as any)
          .select('id, title');
        
        if (error) {
          console.log(`  ❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
          failed += batch.length;
        } else if (data) {
          console.log(`  ✅ Batch ${Math.floor(i/batchSize) + 1}: Inserted ${data.length} items`);
          inserted += data.length;
        }
      } catch (e) {
        console.log(`  ❌ Batch ${Math.floor(i/batchSize) + 1} exception:`, e);
        failed += batch.length;
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 6. Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 FINAL RESULTS:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully inserted: ${inserted} items`);
    console.log(`❌ Failed: ${failed} items`);
    console.log(`📝 Total attempted: ${queueData.length} items`);
    
    if (errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      errors.forEach(e => console.log(`  - ${e}`));
    }
    
    // 7. Verify
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total items in queue: ${count}`);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run
main().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Script failed:', err);
  process.exit(1);
});