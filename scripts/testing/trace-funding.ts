#!/usr/bin/env tsx

import { SimpleOrchestrator } from './src/core/simple-orchestrator';
import { ChainSpecificFetcher } from './src/fetchers/funding/chain-specific';
import { UnifiedScorer } from './src/lib/unified-scorer';

async function traceFundingPipeline() {
  console.log('🔍 TRACING FUNDING PIPELINE...\n');
  
  // Step 1: Fetch funding item
  const fetcher = new ChainSpecificFetcher();
  const data = await fetcher.fetch();
  const items = fetcher.transform(data);
  
  if (items.length === 0) {
    console.log('❌ No funding items fetched');
    return;
  }
  
  const fundingItem = items[0];
  console.log('✅ Step 1: Fetched funding item');
  console.log(`   Title: ${fundingItem.title}`);
  console.log(`   Type: ${fundingItem.type}`);
  console.log(`   Source: ${fundingItem.source}`);
  
  // Step 2: Score it
  const score = UnifiedScorer.scoreContent(fundingItem);
  console.log('\n✅ Step 2: Scored item');
  console.log(`   Score: ${score.score} (threshold: 30)`);
  console.log(`   Pass: ${score.score >= 30 ? 'YES' : 'NO'}`);
  console.log(`   Category: ${score.category}`);
  
  // Step 3: Check detection
  const orch = new SimpleOrchestrator();
  const contentType = orch['detectContentType'](fundingItem, 'chaingrants');
  console.log('\n✅ Step 3: Content type detection');
  console.log(`   Detected as: ${contentType}`);
  
  // Step 4: Run through orchestrator
  console.log('\n📊 Step 4: Running through full orchestrator...\n');
  orch.setBatchSize(10);
  orch.setScoreThreshold(30);
  
  const result = await orch.run();
  
  console.log('\n📈 RESULTS:');
  console.log(`   Total fetched: ${result.fetched}`);
  console.log(`   Total scored: ${result.scored}`);
  console.log(`   Total stored: ${result.stored}`);
  
  // Step 5: Check database for funding items
  const { supabase } = await import('./src/lib/supabase-client');
  const { data: dbItems } = await supabase
    .from('content_queue')
    .select('type, title')
    .eq('type', 'funding')
    .limit(5);
  
  console.log('\n💾 Funding items in database:', dbItems?.length || 0);
  if (dbItems && dbItems.length > 0) {
    dbItems.forEach(item => console.log(`   - ${item.title}`));
  }
  
  // Find the issue
  console.log('\n🔴 DIAGNOSIS:');
  if (score.score < 30) {
    console.log('   Issue: Funding items scored too low');
  } else if (contentType !== 'funding') {
    console.log('   Issue: Not detected as funding type');
  } else if (result.fetched === 0) {
    console.log('   Issue: Not fetching from funding sources');
  } else if (result.stored === 0) {
    console.log('   Issue: Items fetched but not stored');
  } else if (dbItems?.length === 0) {
    console.log('   Issue: Stored but with wrong type');
  } else {
    console.log('   ✅ Funding pipeline working!');
  }
}

traceFundingPipeline().catch(console.error);