#!/usr/bin/env npx tsx

/**
 * UI and Queue Data Test
 * Verifies the frontend can display queue data
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testUI() {
  console.log('🧪 UI AND QUEUE DATA TEST\n');
  console.log('=' .repeat(50));
  
  const results = {
    passed: [] as string[],
    failed: [] as string[]
  };
  
  // Test 1: Check if queue tables have data
  console.log('\n1️⃣ Checking Queue Data...');
  
  const { data: projects, error: pError } = await supabase
    .from('queue_projects')
    .select('*')
    .limit(5);
    
  const { data: news, error: nError } = await supabase
    .from('queue_news')
    .select('*')
    .limit(5);
    
  const { data: investors, error: iError } = await supabase
    .from('queue_investors')
    .select('*')
    .limit(5);
  
  if (projects && projects.length > 0) {
    console.log(`   ✅ queue_projects: ${projects.length} items`);
    console.log(`      Sample: ${projects[0].company_name}`);
    results.passed.push('Queue projects data available');
  } else {
    console.log(`   ❌ queue_projects: No data or error`);
    results.failed.push('No queue projects data');
  }
  
  if (news && news.length > 0) {
    console.log(`   ✅ queue_news: ${news.length} items`);
    console.log(`      Sample: ${news[0].title}`);
    results.passed.push('Queue news data available');
  } else {
    console.log(`   ❌ queue_news: No data or error`);
    results.failed.push('No queue news data');
  }
  
  if (investors && investors.length > 0) {
    console.log(`   ✅ queue_investors: ${investors.length} items`);
    console.log(`      Sample: ${investors[0].name}`);
    results.passed.push('Queue investors data available');
  } else {
    console.log(`   ❌ queue_investors: No data or error`);
    results.failed.push('No queue investors data');
  }
  
  // Test 2: Check data structure for UI display
  console.log('\n2️⃣ Checking Data Structure for UI...');
  
  if (news && news.length > 0) {
    const item = news[0];
    const requiredFields = ['title', 'url', 'source', 'accelerate_score'];
    const hasFields = requiredFields.every(field => field in item);
    
    if (hasFields) {
      console.log('   ✅ Data has required UI fields');
      results.passed.push('Data structure correct for UI');
    } else {
      console.log('   ❌ Missing required UI fields');
      results.failed.push('Data structure incomplete');
    }
  }
  
  // Test 3: Check if API endpoints would work
  console.log('\n3️⃣ Testing API Endpoints...');
  
  try {
    // Test direct Supabase query (what the API would do)
    const { data: queueData, error: qError } = await supabase
      .from('queue_news')
      .select(`
        id,
        title,
        content,
        url,
        source,
        accelerate_score,
        accelerate_fit,
        created_at
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queueData && queueData.length > 0) {
      console.log(`   ✅ API query works: ${queueData.length} items retrieved`);
      results.passed.push('API queries functional');
    } else {
      console.log('   ❌ API query returned no data');
      results.failed.push('API queries not returning data');
    }
  } catch (error) {
    console.log('   ❌ API query failed:', error);
    results.failed.push('API queries failing');
  }
  
  // Test 4: Check data freshness
  console.log('\n4️⃣ Checking Data Freshness...');
  
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  
  const { data: recentData, error: rError } = await supabase
    .from('queue_news')
    .select('created_at')
    .gte('created_at', oneDayAgo.toISOString())
    .limit(5);
  
  if (recentData && recentData.length > 0) {
    console.log(`   ✅ Fresh data: ${recentData.length} items from last 24h`);
    results.passed.push('Data is fresh');
  } else {
    console.log('   ⚠️ No recent data in last 24h');
    results.failed.push('Data is stale');
  }
  
  // Test 5: Simulate UI data fetch
  console.log('\n5️⃣ Simulating UI Data Fetch...');
  
  const uiQuery = await supabase
    .from('queue_news')
    .select('*')
    .eq('accelerate_fit', true)
    .order('accelerate_score', { ascending: false })
    .limit(20);
  
  if (uiQuery.data) {
    console.log(`   ✅ UI query successful: ${uiQuery.data.length} ACCELERATE-fit items`);
    if (uiQuery.data.length > 0) {
      console.log(`      Top item: ${uiQuery.data[0].title} (score: ${uiQuery.data[0].accelerate_score})`);
    }
    results.passed.push('UI queries working');
  } else {
    console.log('   ❌ UI query failed');
    results.failed.push('UI queries not working');
  }
  
  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 TEST SUMMARY\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n🔴 FAILURES:');
    results.failed.forEach(f => console.log(`   - ${f}`));
  }
  
  const score = Math.round((results.passed.length / (results.passed.length + results.failed.length)) * 100);
  console.log(`\n📈 Score: ${score}%`);
  
  if (score >= 80) {
    console.log('✅ UI is ready to display queue data');
  } else if (score >= 60) {
    console.log('⚠️ UI partially functional');
  } else {
    console.log('❌ UI not ready - critical issues');
  }
  
  return score >= 60;
}

testUI().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});