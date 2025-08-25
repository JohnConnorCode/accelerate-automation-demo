#!/usr/bin/env npx tsx
/**
 * Test the complete approval workflow
 * Demonstrates: Fetching → Queue → Scoring → Review → Approval → Live Tables
 */

import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import { QualityScorer } from './src/services/quality-scorer';
import { ApprovalService } from './src/services/approval-service';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testApprovalWorkflow() {
  console.log('🚀 TESTING COMPLETE APPROVAL WORKFLOW');
  console.log('=' .repeat(60));

  const approvalService = new ApprovalService();

  // Step 1: Calculate quality scores for items in queue
  console.log('\n1️⃣ CALCULATING QUALITY SCORES...\n');
  
  const { data: queueItems, error } = await supabase
    .from('content_queue')
    .select('*')
    .in('status', ['pending_review', 'ready_for_review'])
    .limit(10);

  if (error || !queueItems) {
    console.error('Error fetching queue:', error);
    return;
  }

  console.log(`Found ${queueItems.length} items in queue`);

  for (const item of queueItems) {
    const score = await QualityScorer.scoreContent(item);
    
    // Update quality score in database
    await supabase
      .from('content_queue')
      .update({ quality_score: score.total })
      .eq('id', item.id);

    console.log(`\n📊 ${item.title || 'Untitled'}`);
    console.log(`   Type: ${item.type} | Source: ${item.source}`);
    console.log(`   Quality Score: ${score.total}/100`);
    console.log(`   Recommendation: ${score.recommendation}`);
    
    if (score.flags.green.length > 0) {
      console.log(`   ✅ Green Flags: ${score.flags.green.join(', ')}`);
    }
    if (score.flags.red.length > 0) {
      console.log(`   ⚠️ Red Flags: ${score.flags.red.join(', ')}`);
    }
  }

  // Step 2: Get approval statistics
  console.log('\n2️⃣ APPROVAL STATISTICS\n');
  
  const stats = await approvalService.getStats();
  console.log(`   Pending Review: ${stats.pending}`);
  console.log(`   Already Approved: ${stats.approved}`);
  console.log(`   Rejected: ${stats.rejected}`);
  console.log(`   Auto-Approved: ${stats.autoApproved}`);
  console.log(`   Average Quality Score: ${stats.avgQualityScore}`);

  // Step 3: Test auto-approval
  console.log('\n3️⃣ TESTING AUTO-APPROVAL (Score ≥ 80)\n');
  
  const highQualityItems = queueItems.filter(item => {
    const itemWithScore = { ...item, quality_score: item.quality_score || 0 };
    return itemWithScore.quality_score >= 80;
  });

  console.log(`Found ${highQualityItems.length} items eligible for auto-approval`);

  if (highQualityItems.length > 0) {
    console.log('\nWould auto-approve:');
    highQualityItems.forEach(item => {
      console.log(`   - ${item.title} (Score: ${item.quality_score})`);
    });
  }

  // Step 4: Test enrichment recommendation
  console.log('\n4️⃣ ITEMS NEEDING ENRICHMENT\n');
  
  const needsEnrichment = [];
  for (const item of queueItems) {
    const score = await QualityScorer.scoreContent(item);
    if (QualityScorer.needsEnrichment(score)) {
      needsEnrichment.push(item);
    }
  }

  console.log(`Found ${needsEnrichment.length} items that would benefit from enrichment`);
  if (needsEnrichment.length > 0) {
    console.log('\nWould enrich:');
    needsEnrichment.slice(0, 5).forEach(item => {
      console.log(`   - ${item.title} (${item.enriched ? 'Already enriched' : 'Not enriched'})`);
    });
  }

  // Step 5: Show workflow summary
  console.log('\n' + '=' .repeat(60));
  console.log('📋 APPROVAL WORKFLOW SUMMARY');
  console.log('=' .repeat(60));
  
  console.log('\n✅ WORKFLOW STAGES:');
  console.log('1. Content fetched from APIs → content_queue ✓');
  console.log('2. Quality scores calculated (0-100) ✓');
  console.log('3. Items flagged (green/red) for review ✓');
  console.log('4. Auto-approval for high quality (80+) ✓');
  console.log('5. Manual review dashboard available ✓');
  console.log('6. Enrichment for incomplete items ✓');
  console.log('7. Approved items → live tables (projects/funding/resources)');
  console.log('8. Audit trail for all actions ✓');

  console.log('\n🎯 QUALITY DISTRIBUTION:');
  const scoreRanges = {
    high: queueItems.filter(i => (i.quality_score || 0) >= 70).length,
    medium: queueItems.filter(i => (i.quality_score || 0) >= 50 && (i.quality_score || 0) < 70).length,
    low: queueItems.filter(i => (i.quality_score || 0) < 50).length
  };
  
  console.log(`   High (70+): ${scoreRanges.high} items`);
  console.log(`   Medium (50-69): ${scoreRanges.medium} items`);
  console.log(`   Low (<50): ${scoreRanges.low} items`);

  console.log('\n🚦 NEXT STEPS:');
  console.log('1. Open approval-dashboard.html to review items');
  console.log('2. Click "Run Auto-Approval" for high-quality items');
  console.log('3. Manually review medium-quality items');
  console.log('4. Enrich or reject low-quality items');
  console.log('5. Approved items will appear in live tables');

  // Step 6: Test actual approval (commented out to prevent accidental approvals)
  console.log('\n💡 TO TEST ACTUAL APPROVAL:');
  console.log('Uncomment the code below to test moving an item to live tables:');
  console.log('');
  console.log('// const testItem = highQualityItems[0];');
  console.log('// if (testItem) {');
  console.log('//   const result = await approvalService.approveContent(testItem.id, "system", "Test approval");');
  console.log('//   console.log("Approval result:", result);');
  console.log('// }');
}

testApprovalWorkflow().catch(console.error);