/**
 * Script to insert YC companies into content_queue for approval
 */

import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { config } from 'dotenv';

config();

async function insertToQueue() {
  console.log('🚀 Starting content queue insertion...');
  
  try {
    // Test connection
    const { data: testData, error: testError } = await supabase
      .from('content_queue')
      .select('count(*)', { count: 'exact', head: true });
    
    if (testError) {
      console.error('❌ Cannot connect to content_queue:', testError);
      return;
    }
    
    console.log('✅ Connected to database');
    
    // Fetch YC companies
    const ycFetcher = new YCombinatorStartupsFetcher();
    console.log('📡 Fetching YC companies...');
    const ycRawData = await ycFetcher.fetch();
    const ycCompanies = await ycFetcher.transform(ycRawData);
    console.log(`✅ Fetched ${ycCompanies.length} YC companies`);
    
    // Fetch RSS items
    const rssFetcher = new RSSAggregatorFetcher();
    console.log('📡 Fetching RSS items...');
    const rssRawData = await rssFetcher.fetch();
    const rssItems = await rssFetcher.transform(rssRawData);
    console.log(`✅ Fetched ${rssItems.length} RSS items`);
    
    // Combine and take top items
    const allItems = [...ycCompanies, ...rssItems];
    const topItems = allItems
      .sort((a, b) => (b.metadata?.accelerate_score || 0) - (a.metadata?.accelerate_score || 0))
      .slice(0, 30); // Insert top 30 items
    
    console.log(`📊 Selected top ${topItems.length} items for queue`);
    
    // Prepare data for content_queue
    const queueData = topItems.map(item => ({
      title: item.title || 'Untitled',
      description: item.description || '',
      url: item.url || '',
      source: item.source,
      type: item.type || 'project',
      score: item.metadata?.accelerate_score || 50,
      confidence: 0.8,
      factors: {
        source_quality: item.source === 'YCombinator' ? 0.9 : 0.7,
        content_relevance: 0.8,
        recency: 0.9
      },
      recommendation: item.metadata?.accelerate_score > 60 ? 'feature' : 'approve',
      status: 'pending_review',
      ai_recommendation: 'approve',
      ai_score: (item.metadata?.accelerate_score || 50) / 100,
      raw_data: item,
      metadata: item.metadata || {},
      tags: item.tags || [],
      queued_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }));
    
    console.log(`💾 Inserting ${queueData.length} items into content_queue...`);
    console.log('Sample item:', JSON.stringify(queueData[0], null, 2));
    
    // Insert in batches
    const batchSize = 5;
    let totalInserted = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < queueData.length; i += batchSize) {
      const batch = queueData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('content_queue')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += data?.length || 0;
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Inserted ${data?.length || 0} items`);
      }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`  ✅ Successfully inserted: ${totalInserted} items`);
    console.log(`  ❌ Failed: ${totalErrors} items`);
    
    // Verify insertion
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last minute
    
    console.log(`  📊 Items added in last minute: ${count}`);
    
    // Show a few items for verification
    const { data: sampleItems } = await supabase
      .from('content_queue')
      .select('title, source, score, status')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sampleItems && sampleItems.length > 0) {
      console.log('\n📋 Latest items in queue:');
      sampleItems.forEach(item => {
        console.log(`  - ${item.title} (${item.source}, score: ${item.score}, status: ${item.status})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
insertToQueue().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});