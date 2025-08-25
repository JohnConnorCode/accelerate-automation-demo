#!/usr/bin/env npx tsx
/**
 * Test ONLY REAL data fetchers - NO MOCK DATA
 * Verifies actual API connections and real data retrieval
 */

import { config } from 'dotenv';
config();

// REAL FETCHERS ONLY - Confirmed to use actual APIs
import { DevToBuilderResourcesFetcher, GitHubBuilderToolsFetcher } from './src/fetchers/accelerate-specific/builder-resources';
import { EarlyStageProjectsFetcher, ProductHuntEarlyStageFetcher } from './src/fetchers/accelerate-specific/early-stage-projects';
import { GitHubReposFetcher } from './src/fetchers/projects/github-repos';
import { DevToFetcher } from './src/fetchers/resources/devto';
import { ProductHuntFetcher } from './src/fetchers/resources/producthunt';
import { GitHubToolsFetcher } from './src/fetchers/resources/github-tools';
import { DefiLlamaFetcher } from './src/fetchers/metrics/defi-llama';

console.log('🔍 TESTING REAL DATA FETCHERS ONLY - NO MOCK DATA');
console.log('==================================================\n');

interface TestResult {
  name: string;
  status: 'success' | 'failed' | 'needs-key';
  itemsFound: number;
  sample?: any;
  error?: string;
}

const results: TestResult[] = [];

async function testRealFetcher(name: string, fetcher: any): Promise<TestResult> {
  console.log(`Testing ${name}...`);
  try {
    const data = await fetcher.fetch();
    const items = await fetcher.transform(data);
    
    if (items.length === 0) {
      return {
        name,
        status: 'failed',
        itemsFound: 0,
        error: 'No items returned (API may have changed)'
      };
    }
    
    console.log(`  ✅ Found ${items.length} real items`);
    
    // Verify this is real data, not mock
    const firstItem = items[0];
    const isMock = firstItem.url?.includes('example.com') || 
                   firstItem.url?.includes('test.com') ||
                   firstItem.description?.includes('mock') ||
                   firstItem.description?.includes('example');
    
    if (isMock) {
      console.log(`  ⚠️ WARNING: This appears to be mock data!`);
      return {
        name,
        status: 'failed',
        itemsFound: items.length,
        error: 'Detected mock/example data in response'
      };
    }
    
    // Show sample to prove it's real
    console.log(`  Sample: "${firstItem.title?.substring(0, 50)}..."`);
    console.log(`  URL: ${firstItem.url}`);
    
    return {
      name,
      status: 'success',
      itemsFound: items.length,
      sample: firstItem
    };
  } catch (error: any) {
    console.log(`  ❌ Failed: ${error.message}`);
    
    if (error.message?.includes('401') || error.message?.includes('403')) {
      return {
        name,
        status: 'needs-key',
        itemsFound: 0,
        error: 'API key required'
      };
    }
    
    return {
      name,
      status: 'failed',
      itemsFound: 0,
      error: error.message
    };
  }
}

async function runTests() {
  console.log('1️⃣ GITHUB FETCHERS (Real GitHub API)\n');
  
  // GitHub fetchers - REAL API
  results.push(await testRealFetcher('GitHub Repos', new GitHubReposFetcher()));
  results.push(await testRealFetcher('GitHub Tools', new GitHubToolsFetcher()));
  results.push(await testRealFetcher('GitHub Early Stage', new EarlyStageProjectsFetcher()));
  
  console.log('\n2️⃣ DEV.TO FETCHERS (Real Dev.to API)\n');
  
  // Dev.to fetchers - REAL API
  results.push(await testRealFetcher('Dev.to Articles', new DevToFetcher()));
  results.push(await testRealFetcher('Dev.to Builder Resources', new DevToBuilderResourcesFetcher()));
  
  console.log('\n3️⃣ PRODUCTHUNT FETCHERS (Real ProductHunt API)\n');
  
  // ProductHunt fetchers - May need API key
  results.push(await testRealFetcher('ProductHunt', new ProductHuntFetcher()));
  results.push(await testRealFetcher('ProductHunt Early Stage', new ProductHuntEarlyStageFetcher()));
  
  console.log('\n4️⃣ DEFI LLAMA (Real DeFiLlama API - FREE!)\n');
  
  // DeFiLlama - REAL FREE API
  results.push(await testRealFetcher('DeFiLlama TVL Data', new DefiLlamaFetcher()));
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 REAL DATA TEST RESULTS');
  console.log('='.repeat(60) + '\n');
  
  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');
  const needsKey = results.filter(r => r.status === 'needs-key');
  
  console.log(`✅ Working with REAL data: ${successful.length}`);
  successful.forEach(r => {
    console.log(`   - ${r.name}: ${r.itemsFound} items`);
  });
  
  if (needsKey.length > 0) {
    console.log(`\n🔑 Need API keys: ${needsKey.length}`);
    needsKey.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed or returning mock: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }
  
  // Verify we're getting Web3 content
  console.log('\n' + '='.repeat(60));
  console.log('🎯 WEB3 CONTENT VERIFICATION');
  console.log('='.repeat(60) + '\n');
  
  const allItems = successful.flatMap(r => [r.sample]).filter(Boolean);
  const web3Items = allItems.filter(item => {
    const text = `${item.title} ${item.description} ${item.tags?.join(' ')}`.toLowerCase();
    return text.includes('web3') || text.includes('blockchain') || 
           text.includes('defi') || text.includes('nft') || 
           text.includes('crypto') || text.includes('ethereum') ||
           text.includes('solidity') || text.includes('smart contract');
  });
  
  console.log(`Found ${web3Items.length}/${allItems.length} items related to Web3`);
  
  if (web3Items.length > 0) {
    console.log('\nSample Web3 content found:');
    web3Items.slice(0, 3).forEach(item => {
      console.log(`  • ${item.title}`);
      console.log(`    ${item.url}`);
    });
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (successful.length >= 3) {
    console.log('✅ VERDICT: System is fetching REAL data from REAL APIs');
    console.log('✅ At least 3 fetchers are working with actual internet data');
  } else {
    console.log('⚠️ WARNING: Less than 3 real data sources working');
    console.log('⚠️ Need to fix fetchers or add API keys');
  }
  console.log('='.repeat(60));
}

// Run all tests
runTests().catch(console.error);