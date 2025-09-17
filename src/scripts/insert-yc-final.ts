#!/usr/bin/env node
/**
 * FINAL WORKING SCRIPT - Insert YC companies to content_queue
 * This script uses the correct schema without non-existent columns
 */

import type { Database } from '../types/supabase';
import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';

config();

async function insertYCCompanies() {
  console.log('🚀 ACCELERATE Content Automation - YC Companies Insertion\n');
  console.log('=' .repeat(60));
  
  const results = {
    fetched: 0,
    inserted: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  try {
    // 1. Fetch YC Companies
    console.log('\n📡 FETCHING YC COMPANIES...');
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycRaw = await ycFetcher.fetch();
    const ycCompanies = await ycFetcher.transform(ycRaw);
    results.fetched = ycCompanies.length;
    console.log(`✅ Fetched ${ycCompanies.length} YC companies from 2024 batches`);
    
    // 2. Fetch RSS for comparison
    console.log('\n📡 FETCHING RSS FEEDS...');
    const rssFetcher = new RSSAggregatorFetcher();
    const rssRaw = await rssFetcher.fetch();
    const rssItems = await rssFetcher.transform(rssRaw);
    console.log(`✅ Fetched ${rssItems.length} RSS items`);
    
    // 3. Select top items
    const topYC = ycCompanies
      .sort((a, b) => (b.metadata?.accelerate_score || 0) - (a.metadata?.accelerate_score || 0))
      .slice(0, 30);
    
    const topRSS = rssItems
      .filter(item => item.type === 'funding' || item.metadata?.is_funding_news)
      .slice(0, 10);
    
    const itemsToInsert = [...topYC, ...topRSS];
    
    console.log(`\n📊 PREPARING ${itemsToInsert.length} ITEMS FOR INSERTION`);
    console.log(`  - ${topYC.length} YC companies`);
    console.log(`  - ${topRSS.length} RSS funding news`);
    
    // 4. Prepare data for content_queue (using ONLY existing columns)
    const queueData = itemsToInsert.map(item => {
      // Calculate a simple score
      const score = item.metadata?.accelerate_score || 
                   (item.source === 'YCombinator' ? 70 : 50);
      
      return {
        // Core fields that definitely exist
        title: item.title || 'Untitled',
        description: (item.description || '').substring(0, 2000),
        url: item.url || '',
        source: item.source || 'unknown',
        type: item.type || 'project',
        
        // Scoring fields
        score: score,
        confidence: score / 100,
        recommendation: score > 60 ? 'feature' : 'approve',
        
        // Status
        status: 'pending_review',
        
        // Store everything else in raw_data and metadata
        raw_data: {
          ...item,
          yc_batch: item.metadata?.yc_batch,
          launch_year: item.metadata?.launch_year,
          funding_raised: item.metadata?.funding_raised,
          is_yc_backed: item.metadata?.is_yc_backed,
          fetched_at: new Date().toISOString()
        },
        metadata: {
          accelerate_criteria: {
            launch_year: item.metadata?.launch_year || 2024,
            funding_stage: item.metadata?.funding_stage || 'seed',
            team_size: item.metadata?.team_size || 2,
            has_yc_backing: item.metadata?.is_yc_backed || false
          },
          source_metadata: item.metadata || {}
        },
        tags: item.tags || [],
        
        // Timestamps
        created_at: new Date().toISOString()
      };
    });
    
    // 5. Show sample
    console.log('\n📝 SAMPLE ITEM:');
    const sample = queueData[0];
    console.log(`  Title: ${sample.title}`);
    console.log(`  Source: ${sample.source}`);
    console.log(`  Score: ${sample.score}`);
    console.log(`  YC Batch: ${sample.raw_data.yc_batch || 'N/A'}`);
    
    // 6. Insert in batches
    console.log('\n💾 INSERTING TO CONTENT_QUEUE...');
    
    const batchSize = 5;
    for (let i = 0; i < queueData.length; i += batchSize) {
      const batch = queueData.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      try {
        const { data, error } = await supabase
          .from('content_queue')
          .insert(batch as any)
          .select('id, title');
        
        if (error) {
          console.log(`  ❌ Batch ${batchNum}: ${error.message}`);
          results.failed += batch.length;
          results.errors.push(error.message);
        } else if (data) {
          console.log(`  ✅ Batch ${batchNum}: Inserted ${data.length} items`);
          results.inserted += data.length;
          
          // Show inserted titles
          data.forEach(item => {
            console.log(`     - ${item.title}`);
          });
        }
      } catch (e: any) {
        console.log(`  ❌ Batch ${batchNum}: ${e.message}`);
        results.failed += batch.length;
        results.errors.push(e.message);
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 7. Verify total count
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    // 8. Final report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL RESULTS:');
    console.log('=' .repeat(60));
    console.log(`✅ Successfully inserted: ${results.inserted} items`);
    console.log(`❌ Failed: ${results.failed} items`);
    console.log(`📋 Total items in queue: ${count}`);
    
    if (results.inserted > 0) {
      console.log('\n🎉 SUCCESS! YC companies are now in the content queue.');
      console.log('👉 Visit http://localhost:3002/content-queue to review and approve them.');
    }
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      [...new Set(results.errors)].forEach(e => console.log(`  - ${e}`));
    }
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

// Run the script
console.log('ACCELERATE CONTENT AUTOMATION');
console.log('Inserting real YC companies into the queue...\n');

insertYCCompanies().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Script failed:', err);
  process.exit(1);
});