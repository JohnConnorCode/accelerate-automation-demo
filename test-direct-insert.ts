#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

async function testInsert() {
  console.log('🧪 Testing direct insert to queue tables...\n');
  
  // Test data for queue_projects
  const testProject = {
    company_name: 'Test Startup ' + Date.now(),
    description: 'This is a test startup for validating the queue system. It has all the required fields and should insert successfully.',
    website: 'https://example.com',
    founded_year: 2024,
    accelerate_fit: true,
    accelerate_reason: 'Testing queue functionality',
    accelerate_score: 8.5,
    confidence_score: 0.9,
    source: 'test_script',
    location: 'San Francisco, CA',
    team_size: 10,
    funding_amount: 1000000,
    technology_stack: ['React', 'Node.js', 'PostgreSQL'],
    industry_tags: ['SaaS', 'AI', 'Web3']
  };
  
  // Test data for queue_news
  const testNews = {
    title: 'Test News Article ' + Date.now(),
    content: 'This is test news content for validating the news queue. It contains important information about the Web3 ecosystem.',
    url: 'https://example.com/news',
    published_date: new Date().toISOString(),
    accelerate_fit: true,
    accelerate_reason: 'Relevant to ACCELERATE criteria',
    accelerate_score: 7.5,
    confidence_score: 0.85,
    source: 'test_script',
    author: 'Test Author',
    publication: 'Test Publication',
    category: 'Technology',
    tags: ['Web3', 'Innovation']
  };
  
  // Test data for queue_investors
  const testInvestor = {
    name: 'Test Ventures ' + Date.now(),
    type: 'VC',
    description: 'A test venture capital firm focused on early-stage Web3 startups.',
    website: 'https://example.com/vc',
    accelerate_fit: true,
    accelerate_reason: 'Active Web3 investor',
    accelerate_score: 9.0,
    confidence_score: 0.95,
    source: 'test_script',
    investment_stage: ['Seed', 'Series A'],
    industry_focus: ['Web3', 'DeFi', 'Infrastructure']
  };
  
  // Insert into queue_projects
  console.log('1️⃣ Inserting into queue_projects...');
  const { data: projectData, error: projectError } = await supabase
    .from('queue_projects')
    .insert(testProject)
    .select()
    .single();
  
  if (projectError) {
    console.error('❌ Project insert failed:', projectError);
  } else {
    console.log('✅ Project inserted:', projectData.company_name);
  }
  
  // Insert into queue_news
  console.log('\n2️⃣ Inserting into queue_news...');
  const { data: newsData, error: newsError } = await supabase
    .from('queue_news')
    .insert(testNews)
    .select()
    .single();
  
  if (newsError) {
    console.error('❌ News insert failed:', newsError);
  } else {
    console.log('✅ News inserted:', newsData.title);
  }
  
  // Insert into queue_investors
  console.log('\n3️⃣ Inserting into queue_investors...');
  const { data: investorData, error: investorError } = await supabase
    .from('queue_investors')
    .insert(testInvestor)
    .select()
    .single();
  
  if (investorError) {
    console.error('❌ Investor insert failed:', investorError);
  } else {
    console.log('✅ Investor inserted:', investorData.name);
  }
  
  // Check counts
  console.log('\n📊 Final counts:');
  const { count: projectCount } = await supabase
    .from('queue_projects')
    .select('*', { count: 'exact', head: true });
  const { count: newsCount } = await supabase
    .from('queue_news')
    .select('*', { count: 'exact', head: true });
  const { count: investorCount } = await supabase
    .from('queue_investors')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  queue_projects: ${projectCount} items`);
  console.log(`  queue_news: ${newsCount} items`);
  console.log(`  queue_investors: ${investorCount} items`);
  
  if (projectCount > 0 || newsCount > 0 || investorCount > 0) {
    console.log('\n🎉 SUCCESS! Queue tables are working properly!');
  }
}

testInsert().catch(console.error);