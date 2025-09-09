#!/usr/bin/env npx tsx

/**
 * Test inserting items into content_queue
 */

import { supabase } from './src/lib/supabase-client';

async function testQueueInsert() {
  console.log('🧪 Testing content_queue insertion...\n');
  
  // Test data for each content type
  const testItems = [
    {
      title: 'Test Project ' + Date.now(),
      description: 'A test Web3 project for validation. This is an early-stage blockchain startup focusing on innovative DeFi solutions with a small team and minimal funding.',
      url: 'https://test-project-' + Date.now() + '.example.com',
      source: 'test',
      type: 'project',
      status: 'pending_review',
      score: 75,
      confidence: 0.8,
      metadata: {
        team_size: 3,
        funding_raised: 50000,
        launch_date: '2024-01-01'
      },
      ai_summary: 'Test project for queue validation',
      category: 'project',
      created_at: new Date().toISOString()
    },
    {
      title: 'Test Grant Program ' + Date.now(),
      description: 'A comprehensive Web3 grant program offering funding for innovative blockchain projects. This program supports early-stage teams with non-dilutive capital.',
      url: 'https://test-grant-' + Date.now() + '.example.com',
      source: 'test',
      type: 'funding',
      status: 'pending_review',
      score: 85,
      confidence: 0.9,
      metadata: {
        min_amount: 10000,
        max_amount: 100000,
        deadline: '2025-12-31'
      },
      ai_summary: 'Test grant program',
      category: 'funding',
      created_at: new Date().toISOString()
    },
    {
      title: 'Test Resource ' + Date.now(),
      description: 'A powerful development tool for Web3 builders. This resource provides essential infrastructure and documentation for blockchain developers.',
      url: 'https://test-resource-' + Date.now() + '.example.com',
      source: 'test',
      type: 'resource',
      status: 'pending_review',
      score: 65,
      confidence: 0.7,
      metadata: {
        price_type: 'free',
        category: 'tool'
      },
      ai_summary: 'Test resource for developers',
      category: 'resource',
      created_at: new Date().toISOString()
    }
  ];
  
  console.log('📝 Attempting to insert 3 test items...\n');
  
  for (const item of testItems) {
    console.log(`\n🔄 Inserting ${item.type}: "${item.title}"`);
    
    const { data, error } = await supabase
      .from('content_queue')
      .insert(item)
      .select()
      .single();
    
    if (error) {
      console.log(`  ❌ Failed: ${error.message}`);
      console.log(`  Error details:`, error);
    } else {
      console.log(`  ✅ Success! ID: ${data.id}`);
    }
  }
  
  // Check queue status
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Queue Status:\n');
  
  const { data: queueStats, error: statsError } = await supabase
    .from('content_queue')
    .select('type, status')
    .in('status', ['pending_review', 'approved', 'rejected']);
  
  if (statsError) {
    console.log(`❌ Error fetching stats: ${statsError.message}`);
  } else {
    const stats: Record<string, Record<string, number>> = {};
    
    queueStats?.forEach(item => {
      const type = item.type || 'unknown';
      const status = item.status || 'unknown';
      
      if (!stats[type]) stats[type] = {};
      if (!stats[type][status]) stats[type][status] = 0;
      stats[type][status]++;
    });
    
    Object.entries(stats).forEach(([type, statusCounts]) => {
      console.log(`\n${type.toUpperCase()}:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test complete!');
}

testQueueInsert().catch(console.error);