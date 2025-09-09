#!/usr/bin/env tsx

/**
 * BRUTAL HONESTY TEST - What Actually Works?
 */

import { Web3JobPlatformsFetcher } from './src/fetchers/platforms/web3-job-platforms';
import { WellfoundFetcher } from './src/fetchers/platforms/angellist-wellfound';
import { DeworkFetcher } from './src/fetchers/platforms/dework-fetcher';
import { Layer3Fetcher } from './src/fetchers/platforms/layer3-fetcher';
import { WonderverseFetcher } from './src/fetchers/platforms/wonderverse-fetcher';
import { GitcoinFetcher } from './src/fetchers/funding/gitcoin';
import { ProductHuntLaunchesFetcher } from './src/fetchers/real-sources/producthunt-launches';
import { GitHubTrendingFetcher } from './src/fetchers/real-sources/github-trending';

async function brutalHonestyTest() {
  console.log('🔥 BRUTAL HONESTY TEST - NO FAKE DATA ALLOWED');
  console.log('=' .repeat(60));
  
  const fetchers = [
    { name: 'Web3JobPlatforms', fetcher: new Web3JobPlatformsFetcher() },
    { name: 'Wellfound', fetcher: new WellfoundFetcher() },
    { name: 'Dework', fetcher: new DeworkFetcher() },
    { name: 'Layer3', fetcher: new Layer3Fetcher() },
    { name: 'Wonderverse', fetcher: new WonderverseFetcher() },
    { name: 'Gitcoin', fetcher: new GitcoinFetcher() },
    { name: 'ProductHunt', fetcher: new ProductHuntLaunchesFetcher() },
    { name: 'GitHub', fetcher: new GitHubTrendingFetcher() }
  ];
  
  const results = {
    working: [] as string[],
    broken: [] as string[],
    fake: [] as string[]
  };
  
  for (const { name, fetcher } of fetchers) {
    console.log(`\n📡 Testing ${name}...`);
    
    try {
      // Set a 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      );
      
      const data = await Promise.race([
        fetcher.fetch(),
        timeoutPromise
      ]) as any[];
      
      const items = fetcher.transform(data);
      
      // Check if it's real data
      let isReal = false;
      let hasFakeData = false;
      
      if (items.length > 0) {
        // Check first item
        const firstItem = items[0];
        
        // Check for fake indicators
        const fakeWords = ['example', 'test', 'demo', 'sample', 'mock', 'fake'];
        const title = (firstItem.title || '').toLowerCase();
        const url = (firstItem.url || '').toLowerCase();
        
        for (const word of fakeWords) {
          if (title.includes(word) || url.includes(word)) {
            hasFakeData = true;
            break;
          }
        }
        
        // Check if URL is valid
        try {
          const urlObj = new URL(firstItem.url);
          if (urlObj.hostname.includes('example.com') || 
              urlObj.hostname.includes('test.com') ||
              urlObj.hostname === 'localhost') {
            hasFakeData = true;
          } else {
            isReal = true;
          }
        } catch {
          hasFakeData = true;
        }
        
        // Check for project_needs (critical field)
        const hasNeeds = firstItem.metadata?.project_needs?.length > 0;
        
        console.log(`  ✅ Got ${items.length} items`);
        console.log(`  📊 First item: ${firstItem.title}`);
        console.log(`  🔗 URL: ${firstItem.url}`);
        console.log(`  🎯 Has needs: ${hasNeeds ? 'YES' : 'NO'}`);
        console.log(`  💯 Real data: ${isReal ? 'YES' : 'NO'}`);
        
        if (hasFakeData) {
          results.fake.push(`${name} (${items.length} fake items)`);
        } else if (isReal) {
          results.working.push(`${name} (${items.length} real items)`);
        } else {
          results.broken.push(`${name} (questionable data)`);
        }
      } else {
        console.log(`  ❌ No data returned`);
        results.broken.push(`${name} (no data)`);
      }
      
    } catch (error: any) {
      if (error.message === 'TIMEOUT') {
        console.log(`  ⏱️ TIMEOUT after 5 seconds`);
        results.broken.push(`${name} (timeout)`);
      } else {
        console.log(`  ❌ ERROR: ${error.message}`);
        results.broken.push(`${name} (${error.message})`);
      }
    }
  }
  
  // BRUTAL TRUTH
  console.log('\n' + '='.repeat(60));
  console.log('🔍 BRUTAL TRUTH RESULTS:\n');
  
  console.log('✅ ACTUALLY WORKING WITH REAL DATA:');
  if (results.working.length > 0) {
    results.working.forEach(r => console.log(`  - ${r}`));
  } else {
    console.log('  NONE! Everything is broken or fake!');
  }
  
  console.log('\n❌ BROKEN/TIMEOUT:');
  if (results.broken.length > 0) {
    results.broken.forEach(r => console.log(`  - ${r}`));
  } else {
    console.log('  None');
  }
  
  console.log('\n🚫 RETURNING FAKE DATA:');
  if (results.fake.length > 0) {
    results.fake.forEach(r => console.log(`  - ${r}`));
  } else {
    console.log('  None');
  }
  
  // Final verdict
  const workingPercentage = (results.working.length / fetchers.length) * 100;
  console.log('\n' + '='.repeat(60));
  console.log(`📊 SYSTEM STATUS: ${Math.round(workingPercentage)}% FUNCTIONAL`);
  
  if (workingPercentage >= 75) {
    console.log('✅ System is ACTUALLY working');
  } else if (workingPercentage >= 50) {
    console.log('🟡 System is PARTIALLY working');
  } else {
    console.log('🔴 System is MOSTLY BROKEN - needs major fixes');
  }
}

brutalHonestyTest().catch(console.error);
