#!/usr/bin/env tsx

/**
 * Complete System Test for ACCELERATE
 * Tests the entire pipeline with REAL data
 */

import { orchestrator } from './src/core/simple-orchestrator';
import { DataValidator } from './src/tests/validate-real-data.test';
import { UnifiedScorer } from './src/lib/unified-scorer';
import { supabase } from './src/lib/supabase-client';

async function testCompletePipeline() {
  console.log('🚀 ACCELERATE COMPLETE SYSTEM TEST');
  console.log('==================================\n');
  
  try {
    // Step 1: Test orchestration
    console.log('📡 Step 1: Running orchestrator to fetch REAL data...');
    orchestrator.setBatchSize(50); // Process up to 50 items
    orchestrator.setScoreThreshold(30); // Only accept quality content
    
    const result = await orchestrator.run();
    
    console.log('\n📊 Orchestration Results:');
    console.log(`  Fetched: ${result.fetched} items`);
    console.log(`  Scored: ${result.scored} items`);
    console.log(`  Stored: ${result.stored} items`);
    console.log(`  Rejected: ${result.rejected} items`);
    console.log(`  Duration: ${result.duration}s`);
    
    if (result.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    // Step 2: Verify stored content
    console.log('\n🔍 Step 2: Verifying stored content...');
    const { data: queuedItems, error } = await supabase
      .from('content_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('❌ Failed to fetch queued items:', error);
      return;
    }
    
    console.log(`  Found ${queuedItems?.length || 0} items in queue`);
    
    if (queuedItems && queuedItems.length > 0) {
      // Step 3: Validate data quality
      console.log('\n✅ Step 3: Validating data quality...');
      
      const contentItems = queuedItems.map(item => ({
        source: item.source,
        type: item.type as any,
        title: item.title,
        description: item.description,
        url: item.url,
        author: item.raw_data?.author || 'Unknown',
        tags: item.tags || [],
        metadata: item.metadata || item.raw_data?.metadata || {}
      }));
      
      const validation = DataValidator.validateBatch(contentItems);
      
      console.log(`  Valid items: ${validation.stats.valid}/${validation.stats.total}`);
      console.log(`  Invalid items: ${validation.stats.invalid}`);
      
      if (validation.stats.invalid > 0) {
        console.log('  Invalid reasons:');
        for (const [reason, count] of Object.entries(validation.stats.reasons)) {
          if (count > 0) {
            console.log(`    - ${reason}: ${count}`);
          }
        }
      }
      
      // Step 4: Test unified scoring
      console.log('\n🎯 Step 4: Testing unified scoring...');
      const scoringStats = UnifiedScorer.getStats(contentItems);
      
      console.log(`  Projects with needs: ${scoringStats.withNeeds}`);
      console.log(`  Average score: ${scoringStats.avgScore}`);
      console.log(`  Score categories:`);
      for (const [category, count] of Object.entries(scoringStats.byCategory)) {
        console.log(`    - ${category}: ${count}`);
      }
      
      // Step 5: Show top projects
      if (scoringStats.topProjects.length > 0) {
        console.log('\n🏆 Top 5 Projects:');
        scoringStats.topProjects.slice(0, 5).forEach((project, i) => {
          const scoring = UnifiedScorer.scoreContent(project);
          console.log(`\n  ${i + 1}. ${project.title}`);
          console.log(`     Score: ${scoring.score} (${scoring.category})`);
          console.log(`     URL: ${project.url}`);
          console.log(`     Needs: ${project.metadata?.project_needs?.join(', ') || 'N/A'}`);
          console.log(`     Reasons: ${scoring.reasons.slice(0, 3).join(', ')}`);
        });
      }
      
      // Step 6: Check for fake data
      console.log('\n🔒 Step 6: Checking for fake data...');
      const fakeIndicators = ['example', 'test', 'demo', 'sample', 'lorem'];
      let fakeCount = 0;
      
      for (const item of contentItems) {
        const title = (item.title || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        
        for (const indicator of fakeIndicators) {
          if (title.includes(indicator) || desc.includes(indicator)) {
            fakeCount++;
            console.log(`  ⚠️ Possible fake data: "${item.title}"`);
            break;
          }
        }
      }
      
      if (fakeCount === 0) {
        console.log('  ✅ No fake data detected!');
      } else {
        console.log(`  ⚠️ Found ${fakeCount} items with possible fake data`);
      }
      
      // Final verdict
      console.log('\n' + '='.repeat(50));
      console.log('📈 FINAL SYSTEM STATUS:');
      
      const successRate = validation.stats.valid / validation.stats.total;
      const hasProjectsWithNeeds = scoringStats.withNeeds > 0;
      const noFakeData = fakeCount === 0;
      
      if (successRate >= 0.8 && hasProjectsWithNeeds && noFakeData) {
        console.log('✅ SYSTEM IS WORKING PERFECTLY!');
        console.log('   - High quality real data');
        console.log('   - Projects with active needs');
        console.log('   - No fake data detected');
      } else if (successRate >= 0.6 && hasProjectsWithNeeds) {
        console.log('🟡 SYSTEM IS WORKING WELL');
        console.log('   - Good data quality');
        console.log('   - Some projects with needs');
        console.log(`   - Success rate: ${Math.round(successRate * 100)}%`);
      } else {
        console.log('🔴 SYSTEM NEEDS IMPROVEMENT');
        console.log(`   - Success rate: ${Math.round(successRate * 100)}%`);
        console.log(`   - Projects with needs: ${scoringStats.withNeeds}`);
        console.log(`   - Fake data items: ${fakeCount}`);
      }
      
    } else {
      console.log('❌ No items found in queue. Pipeline may have issues.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testCompletePipeline().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test error:', err);
  process.exit(1);
});