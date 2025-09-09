#!/usr/bin/env node
/**
 * MINIMAL insertion - only use columns we know exist
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';

config();

async function minimalInsert() {
  console.log('🚀 Minimal YC insertion (basic columns only)\n');
  
  // Fetch YC companies
  const fetcher = new YCombinatorStartupsFetcher();
  const raw = await fetcher.fetch();
  const companies = await fetcher.transform(raw);
  
  console.log(`✅ Got ${companies.length} YC companies\n`);
  
  // Take next batch (skip first 10 already inserted) and filter for good descriptions
  const nextBatch = companies
    .slice(10, 200) // Get more companies
    .filter(c => c.description && c.description.length > 10) // Only those with real descriptions
    .slice(0, 30); // Take 30 with good descriptions
  
  // Create minimal records (only columns that definitely exist)
  const records = nextBatch.map(c => ({
    title: c.title,
    description: c.description.substring(0, 500),
    url: c.url,
    source: 'YCombinator',
    type: 'project',
    score: 70,
    confidence: 0.7,
    recommendation: 'approve',
    status: 'pending_review',
    metadata: {
      yc_batch: c.metadata?.yc_batch,
      year: c.metadata?.yc_year,
      location: c.metadata?.location,
      is_yc: true,
      accelerate_score: c.metadata?.accelerate_score || 70
    },
    created_at: new Date().toISOString()
  }));
  
  console.log('Inserting these companies:');
  records.forEach(r => console.log(`  - ${r.title} (${r.metadata.yc_batch})`));
  
  console.log('\n💾 Inserting...');
  
  const { data, error } = await supabase
    .from('content_queue')
    .insert(records)
    .select('id, title');
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else if (data) {
    console.log(`\n✅ SUCCESS! Inserted ${data.length} YC companies:`);
    data.forEach(d => console.log(`  - ID ${d.id}: ${d.title}`));
    
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Total items in queue: ${count}`);
    console.log('\n🎉 YC companies are now in the queue!');
    console.log('👉 Visit http://localhost:3002/content-queue to review them');
  }
}

minimalInsert().catch(console.error);