#!/usr/bin/env npx tsx

import { projectExtractor } from './src/extractors/project-extractor';
import { fundingExtractor } from './src/extractors/funding-extractor';

async function testExtractors() {
  console.log('🧪 TESTING DATA EXTRACTORS WITH REAL DATA\n');
  console.log('='.repeat(60));
  
  // Test 1: GitHub data
  console.log('\n📊 TEST 1: GitHub Repository Data\n');
  
  const githubData = {
    name: 'awesome-web3-project',
    full_name: 'user/awesome-web3-project',
    description: 'A DeFi protocol',
    html_url: 'https://github.com/user/awesome-web3-project',
    stargazers_count: 150,
    created_at: '2024-01-15T00:00:00Z',
    pushed_at: '2024-03-01T00:00:00Z',
    language: 'Solidity',
    topics: ['defi', 'ethereum'],
    contributors: [
      { login: 'founder1', name: 'John Doe' },
      { login: 'founder2' }
    ]
  };
  
  const extracted = projectExtractor.extract(githubData, 'github');
  
  if (extracted) {
    console.log('✅ Extraction successful');
    console.log('\nRequired fields check:');
    console.log(`  name: ${extracted.name ? '✅' : '❌'} "${extracted.name}"`);
    console.log(`  description: ${extracted.description?.length >= 100 ? '✅' : '❌'} (${extracted.description?.length} chars)`);
    console.log(`  team_size: ${extracted.team_size > 0 ? '✅' : '❌'} ${extracted.team_size}`);
    console.log(`  founder_names: ${extracted.founder_names?.length > 0 ? '✅' : '❌'} ${JSON.stringify(extracted.founder_names)}`);
    console.log(`  funding_raised: ${extracted.funding_raised >= 0 ? '✅' : '❌'} $${extracted.funding_raised}`);
    console.log(`  launch_date: ${extracted.launch_date ? '✅' : '❌'} ${extracted.launch_date}`);
    console.log(`  technical_stack: ${extracted.technical_stack?.length > 0 ? '✅' : '❌'} ${JSON.stringify(extracted.technical_stack)}`);
    console.log(`  project_needs: ${extracted.project_needs?.length > 0 ? '✅' : '❌'} ${JSON.stringify(extracted.project_needs)}`);
    console.log(`  problem_statement: ${extracted.problem_statement?.length >= 100 ? '✅' : '❌'} (${extracted.problem_statement?.length} chars)`);
    console.log(`  completeness: ${extracted.data_completeness_score}`);
  } else {
    console.log('❌ Extraction failed!');
  }
  
  // Test 2: ProductHunt data
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST 2: ProductHunt Data\n');
  
  const phData = {
    name: 'CoolWeb3App',
    tagline: 'The future of DeFi',
    description: 'Short desc',
    website: 'https://coolweb3.app',
    makers: [
      { name: 'Alice Founder' }
    ],
    votes_count: 500,
    topics: [
      { name: 'DeFi' },
      { name: 'Web3' }
    ]
  };
  
  const phExtracted = projectExtractor.extract(phData, 'producthunt');
  
  if (phExtracted) {
    console.log('✅ Extraction successful');
    console.log(`  description length: ${phExtracted.description?.length} chars`);
    console.log(`  problem_statement length: ${phExtracted.problem_statement?.length} chars`);
    console.log(`  founder_names: ${JSON.stringify(phExtracted.founder_names)}`);
  } else {
    console.log('❌ Extraction failed!');
  }
  
  // Test 3: Minimal data
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST 3: Minimal/Bad Data\n');
  
  const minimalData = {
    title: 'Something'
  };
  
  const minExtracted = projectExtractor.extract(minimalData, 'unknown');
  
  if (minExtracted) {
    console.log('✅ Extraction handled bad data');
    console.log(`  Generated description: ${minExtracted.description?.substring(0, 50)}...`);
    console.log(`  Generated team_size: ${minExtracted.team_size}`);
    console.log(`  Generated founder_names: ${JSON.stringify(minExtracted.founder_names)}`);
    console.log(`  Completeness score: ${minExtracted.data_completeness_score}`);
  } else {
    console.log('❌ Extraction failed on minimal data!');
  }
  
  // Test 4: Funding extractor
  console.log('\n' + '='.repeat(60));
  console.log('\n💰 TEST 4: Funding Extractor\n');
  
  const grantData = {
    name: 'Web3 Grant Program',
    description: 'Fund builders',
    min_amount: '10K',
    max_amount: '100,000',
    deadline: '2024-12-31',
    requirements: ['Open source', 'Web3 focus']
  };
  
  console.log('  Input max_amount:', grantData.max_amount);
  
  const fundingExtracted = fundingExtractor.extract(grantData, 'grants');
  
  if (fundingExtracted) {
    console.log('✅ Funding extraction successful');
    console.log(`  min_amount: $${fundingExtracted.min_amount}`);
    console.log(`  max_amount: $${fundingExtracted.max_amount}`);
    console.log(`  description length: ${fundingExtracted.description?.length} chars`);
    console.log(`  eligibility_criteria: ${JSON.stringify(fundingExtracted.eligibility_criteria)}`);
    console.log(`  benefits: ${JSON.stringify(fundingExtracted.benefits)}`);
  } else {
    console.log('❌ Funding extraction failed!');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 EXTRACTION ISSUES FOUND:\n');
  
  const issues = [];
  
  if (!extracted || extracted.description.length < 100) {
    issues.push('❌ Description expansion not always reaching 100 chars');
  }
  
  if (!extracted || extracted.problem_statement.length < 100) {
    issues.push('❌ Problem statement generation not always 100+ chars');
  }
  
  if (!phExtracted || phExtracted.founder_names.length === 0) {
    issues.push('❌ Founder extraction can fail');
  }
  
  if (!minExtracted || minExtracted.data_completeness_score > 0.5) {
    issues.push('❌ Completeness scoring too generous for bad data');
  }
  
  if (issues.length === 0) {
    console.log('✅ All extractors working correctly!');
  } else {
    issues.forEach(issue => console.log(issue));
  }
  
  console.log('\n🔍 CRITICAL ASSESSMENT:\n');
  console.log('1. Extractors generate data but quality varies');
  console.log('2. Required field generation works but is often generic');
  console.log('3. Completeness scoring needs calibration');
  console.log('4. Need better handling of edge cases');
}

testExtractors().catch(console.error);