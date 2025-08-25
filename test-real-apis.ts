#!/usr/bin/env npx tsx
/**
 * Direct API tests - bypassing fetchers to test raw API endpoints
 * This proves which APIs are REAL and accessible
 */

import axios from 'axios';

console.log('🔬 TESTING RAW API ENDPOINTS DIRECTLY');
console.log('=====================================\n');

interface APITest {
  name: string;
  url: string;
  needsAuth: boolean;
  status: 'working' | 'failed' | 'needs-key';
  dataFound?: number;
  sample?: any;
}

const results: APITest[] = [];

async function testAPI(name: string, url: string, needsAuth: boolean = false): Promise<void> {
  console.log(`Testing ${name}...`);
  
  try {
    const headers: any = {};
    
    if (needsAuth && name.includes('GitHub') && process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    
    const response = await axios.get(url, { 
      headers,
      timeout: 5000 
    });
    
    const hasData = response.data && 
      (Array.isArray(response.data) ? response.data.length > 0 : 
       response.data.items?.length > 0 ||
       response.data.grants?.length > 0 ||
       response.data.protocols?.length > 0 ||
       Object.keys(response.data).length > 0);
    
    if (hasData) {
      console.log(`  ✅ REAL API - Returns actual data`);
      
      // Show sample to prove it's real
      let sample = null;
      if (response.data.items?.[0]) {
        sample = response.data.items[0];
      } else if (Array.isArray(response.data) && response.data[0]) {
        sample = response.data[0];
      } else if (response.data.protocols?.[0]) {
        sample = response.data.protocols[0];
      }
      
      if (sample) {
        console.log(`  Sample: ${JSON.stringify(sample).substring(0, 100)}...`);
      }
      
      results.push({
        name,
        url,
        needsAuth,
        status: 'working',
        dataFound: response.data.items?.length || response.data.length || 1,
        sample
      });
    } else {
      console.log(`  ⚠️ API works but returned no data`);
      results.push({
        name,
        url,
        needsAuth,
        status: 'working',
        dataFound: 0
      });
    }
  } catch (error: any) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(`  🔑 Needs API key`);
      results.push({
        name,
        url,
        needsAuth: true,
        status: 'needs-key'
      });
    } else {
      console.log(`  ❌ Failed: ${error.message}`);
      results.push({
        name,
        url,
        needsAuth,
        status: 'failed'
      });
    }
  }
}

async function runTests() {
  console.log('1️⃣ FREE APIs (No key required)\n');
  
  // These should work without any API key
  await testAPI('GitHub Search', 'https://api.github.com/search/repositories?q=web3+stars:>10&sort=updated&per_page=5');
  await testAPI('Dev.to Articles', 'https://dev.to/api/articles?tag=web3&per_page=5');
  await testAPI('DeFiLlama Protocols', 'https://api.llama.fi/protocols');
  await testAPI('CoinGecko Trending', 'https://api.coingecko.com/api/v3/search/trending');
  
  console.log('\n2️⃣ APIs with Free Tiers (May need key)\n');
  
  await testAPI('ProductHunt Posts', 'https://api.producthunt.com/v2/api/graphql', true);
  await testAPI('GitHub with Auth', 'https://api.github.com/search/repositories?q=blockchain+created:>2024-01-01', true);
  
  console.log('\n3️⃣ Known Mock/Fake APIs (Should fail)\n');
  
  // These are fake URLs from the mock fetchers
  await testAPI('Fake Ecosystem API', 'https://api.ecosystem-programs.example.com/programs');
  await testAPI('Fake Web3 Directory', 'https://api.web3directory.example.com/projects');
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 API TEST RESULTS');
  console.log('='.repeat(60) + '\n');
  
  const working = results.filter(r => r.status === 'working' && r.dataFound! > 0);
  const needsKey = results.filter(r => r.status === 'needs-key');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log('✅ WORKING REAL APIs (with data):');
  working.forEach(r => {
    console.log(`   ${r.name}: ${r.dataFound} items`);
    console.log(`   URL: ${r.url}`);
  });
  
  if (needsKey.length > 0) {
    console.log('\n🔑 APIs needing keys:');
    needsKey.forEach(r => {
      console.log(`   ${r.name}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ Failed/Fake APIs:');
    failed.forEach(r => {
      console.log(`   ${r.name} - ${r.url.includes('example.com') ? 'MOCK URL' : 'API Error'}`);
    });
  }
  
  // Specific Web3 data check
  console.log('\n' + '='.repeat(60));
  console.log('🎯 WEB3-SPECIFIC DATA CHECK');
  console.log('='.repeat(60) + '\n');
  
  const web3APIs = working.filter(r => {
    const data = JSON.stringify(r.sample || '').toLowerCase();
    return data.includes('web3') || data.includes('blockchain') || 
           data.includes('defi') || data.includes('ethereum') ||
           data.includes('solidity') || data.includes('crypto');
  });
  
  if (web3APIs.length > 0) {
    console.log(`✅ Found ${web3APIs.length} APIs returning Web3 data`);
    web3APIs.forEach(r => {
      console.log(`   - ${r.name}`);
    });
  }
  
  // Final verdict
  console.log('\n' + '='.repeat(60));
  console.log('🏁 FINAL VERDICT');
  console.log('='.repeat(60) + '\n');
  
  if (working.length >= 3) {
    console.log('✅ CONFIRMED: At least 3 REAL APIs are working');
    console.log('✅ The system CAN fetch real data from the internet');
    console.log('✅ NOT using mock data for these sources');
    
    console.log('\n📝 Recommendations:');
    console.log('1. Remove all .example.com mock fetchers');
    console.log('2. Use these working APIs:');
    working.forEach(r => {
      console.log(`   - ${r.name}`);
    });
  } else {
    console.log('⚠️ WARNING: Less than 3 real APIs confirmed working');
    console.log('⚠️ System may be relying too much on mock data');
  }
}

// Run all tests
runTests().then(() => process.exit(0)).catch(console.error);