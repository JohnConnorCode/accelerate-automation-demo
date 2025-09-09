#!/usr/bin/env npx tsx

import { projectExtractor } from './src/extractors/project-extractor';
import { fundingExtractor } from './src/extractors/funding-extractor';

async function testRealWorldExtraction() {
  console.log('🌍 TESTING WITH REAL-WORLD DATA PATTERNS\n');
  console.log('='.repeat(60));
  
  // Test 1: Real GitHub project pattern
  console.log('\n📊 TEST 1: Real GitHub Project Pattern\n');
  
  const realGitHubProject = {
    name: 'uniswap-v4-core',
    full_name: 'Uniswap/v4-core',
    description: 'Uniswap V4 is a new automated market maker protocol that provides extensible and customizable pools. V4-core is the core logic of the Uniswap V4 protocol',
    html_url: 'https://github.com/Uniswap/v4-core',
    stargazers_count: 1823,
    forks_count: 487,
    created_at: '2023-06-12T00:00:00Z',
    pushed_at: '2024-03-15T12:34:56Z',
    language: 'Solidity',
    topics: ['defi', 'ethereum', 'automated-market-maker', 'smart-contracts'],
    license: { key: 'bsl-1.1', name: 'Business Source License 1.1' },
    open_issues_count: 42,
    watchers_count: 1823,
    default_branch: 'main',
    network_count: 487,
    subscribers_count: 89,
    size: 12456,
    has_wiki: true,
    has_pages: false,
    archived: false,
    disabled: false,
    visibility: 'public',
    contributors: [
      { login: 'haydenadams', name: 'Hayden Adams', contributions: 234 },
      { login: 'moodysalem', name: 'Moody Salem', contributions: 189 },
      { login: 'noahzinsmeister', name: 'Noah Zinsmeister', contributions: 156 },
      { login: 'danrobinson', contributions: 78 },
      { login: 'willpote', contributions: 45 }
    ]
  };
  
  const extracted = projectExtractor.extract(realGitHubProject, 'github');
  
  if (extracted) {
    console.log('✅ Extraction successful');
    console.log('\n📋 Extracted Data Quality:');
    console.log(`  Name: "${extracted.name}"`);
    console.log(`  Description: "${extracted.description?.substring(0, 100)}..."`);
    console.log(`  Team size: ${extracted.team_size} (from ${realGitHubProject.contributors.length} contributors)`);
    console.log(`  Founders: ${JSON.stringify(extracted.founder_names)}`);
    console.log(`  Tech stack: ${JSON.stringify(extracted.technical_stack)}`);
    console.log(`  Problem statement: "${extracted.problem_statement?.substring(0, 100)}..."`);
    console.log(`  Completeness: ${extracted.data_completeness_score}`);
    console.log(`  Metrics: ${extracted.active_users || 0} users, TVL: $${extracted.tvl_usd || 0}`);
  }
  
  // Test 2: Real funding program pattern
  console.log('\n' + '='.repeat(60));
  console.log('\n💰 TEST 2: Real Accelerator Pattern\n');
  
  const realAccelerator = {
    name: 'Y Combinator W24',
    organization: 'Y Combinator',
    description: 'YC provides seed funding for startups. Twice a year we invest $500K in a large number of startups.',
    website: 'https://www.ycombinator.com',
    investment_amount: 500000,
    equity_percentage: 7,
    batch_size: 250,
    program_duration: '3 months',
    location: 'San Francisco',
    application_deadline: '2024-01-15',
    verticals: ['B2B', 'Consumer', 'Fintech', 'Healthcare', 'Deep Tech'],
    requirements: [
      'Incorporated company',
      'At least 10% equity per founder',
      'Full-time commitment'
    ],
    benefits: [
      '$500K investment',
      'Access to YC partner network',
      'Demo Day with 1000+ investors',
      'Alumni network of 4000+ companies',
      'Office hours with partners',
      'Deal flow sharing'
    ],
    notable_alumni: ['Airbnb', 'Stripe', 'Coinbase', 'DoorDash', 'Reddit'],
    acceptance_rate: 1.5,
    founded: 2005,
    total_companies: 4000,
    combined_valuation: 600000000000
  };
  
  const fundingExtracted = fundingExtractor.extract(realAccelerator, 'accelerator');
  
  if (fundingExtracted) {
    console.log('✅ Funding extraction successful');
    console.log('\n📋 Extracted Funding Data:');
    console.log(`  Name: "${fundingExtracted.name}"`);
    console.log(`  Investment: $${fundingExtracted.min_amount} - $${fundingExtracted.max_amount}`);
    console.log(`  Equity: ${fundingExtracted.equity_percentage_min}%`);
    console.log(`  Benefits: ${fundingExtracted.benefits.length} benefits listed`);
    console.log(`  Eligibility: ${fundingExtracted.eligibility_criteria.length} criteria`);
    console.log(`  Notable portfolio: ${fundingExtracted.notable_portfolio_companies?.length || 0} companies`);
    console.log(`  Completeness: ${fundingExtracted.data_completeness_score}`);
  }
  
  // Test 3: Real Web3 grant pattern
  console.log('\n' + '='.repeat(60));
  console.log('\n🎁 TEST 3: Real Web3 Grant Pattern\n');
  
  const realGrant = {
    name: 'Optimism RetroPGF Round 3',
    round_name: 'RetroPGF 3',
    organization: 'Optimism Collective',
    description: 'Retroactive Public Goods Funding rewards builders who have created positive impact',
    total_allocation: 30000000,
    token: 'OP',
    categories: [
      'OP Stack',
      'Collective Governance',
      'Developer Ecosystem',
      'End User Experience'
    ],
    eligibility: [
      'Projects must have created impact between Jan 2023 - Oct 2023',
      'Open source projects preferred',
      'Must benefit Optimism ecosystem'
    ],
    application_start: '2023-09-19',
    application_end: '2023-10-23',
    voting_start: '2023-11-06',
    voting_end: '2023-12-07',
    badgeholders: 146,
    projects_submitted: 1613,
    projects_awarded: 501,
    median_grant: 30000,
    max_grant: 500000,
    website: 'https://optimism.io/retropgf',
    previous_rounds: [
      { round: 1, amount: 1000000, projects: 58 },
      { round: 2, amount: 10000000, projects: 195 }
    ]
  };
  
  const grantExtracted = fundingExtractor.extract(realGrant, 'grants');
  
  if (grantExtracted) {
    console.log('✅ Grant extraction successful');
    console.log('\n📋 Extracted Grant Data:');
    console.log(`  Name: "${grantExtracted.name}"`);
    console.log(`  Total pool: $${grantExtracted.total_fund_size || 0}`);
    console.log(`  Grant range: $${grantExtracted.min_amount} - $${grantExtracted.max_amount}`);
    console.log(`  Categories: ${grantExtracted.sector_focus.length} sectors`);
    console.log(`  Deadline: ${grantExtracted.application_deadline || 'Not set'}`);
    console.log(`  Process: "${grantExtracted.application_process_description?.substring(0, 100)}..."`);
    console.log(`  Completeness: ${grantExtracted.data_completeness_score}`);
  }
  
  // Test 4: Complex nested data
  console.log('\n' + '='.repeat(60));
  console.log('\n🔧 TEST 4: Complex Nested Data\n');
  
  const complexData = {
    project: {
      name: 'ZK-Rollup Framework',
      details: {
        description: 'Advanced zero-knowledge rollup solution',
        tech: {
          languages: ['Rust', 'Solidity'],
          frameworks: ['zkSNARK', 'Circom']
        }
      }
    },
    metrics: {
      github: {
        stars: 450,
        contributors: 12
      },
      onchain: {
        tvl: 25000000,
        transactions: 150000
      }
    },
    team: {
      founders: [
        { name: 'Alex Chen', role: 'CEO', github: 'alexchen' },
        { name: 'Sarah Kim', role: 'CTO' }
      ],
      size: 8
    },
    funding: {
      raised: 3500000,
      investors: ['a16z', 'Paradigm'],
      stage: 'Seed'
    }
  };
  
  const complexExtracted = projectExtractor.extract(complexData, 'unknown');
  
  if (complexExtracted) {
    console.log('✅ Complex data extraction successful');
    console.log('\n📋 Extracted from nested structure:');
    console.log(`  Found name: ${complexExtracted.name ? '✅' : '❌'}`);
    console.log(`  Found founders: ${complexExtracted.founder_names?.length > 0 ? '✅' : '❌'}`);
    console.log(`  Found TVL: ${complexExtracted.tvl_usd > 0 ? '✅' : '❌'} ($${complexExtracted.tvl_usd || 0})`);
    console.log(`  Found funding: ${complexExtracted.funding_raised > 0 ? '✅' : '❌'} ($${complexExtracted.funding_raised})`);
    console.log(`  Found tech stack: ${complexExtracted.technical_stack?.length > 0 ? '✅' : '❌'}`);
    console.log(`  Completeness: ${complexExtracted.data_completeness_score}`);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 DATA QUALITY ASSESSMENT:\n');
  
  const qualityChecks = {
    'Handles real GitHub data': extracted?.founder_names?.includes('Hayden Adams'),
    'Parses investment amounts': fundingExtracted?.min_amount === 500000,
    'Extracts token allocations': grantExtracted?.currency === 'OP',
    'Finds nested data': complexExtracted?.tvl_usd === 25000000,
    'Generates meaningful descriptions': extracted?.description?.length > 100,
    'Calculates proper team sizes': extracted?.team_size <= 10,
    'Identifies funding stages': complexExtracted?.funding_stage === 'seed'
  };
  
  let passed = 0;
  let failed = 0;
  
  for (const [check, result] of Object.entries(qualityChecks)) {
    if (result) {
      console.log(`✅ ${check}`);
      passed++;
    } else {
      console.log(`❌ ${check}`);
      failed++;
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some quality checks failed - extractors need improvement');
  } else {
    console.log('\n✨ All quality checks passed!');
  }
}

testRealWorldExtraction().catch(console.error);