// Test the QUALITY fetchers
import { config } from 'dotenv';
config();

import { ProductHuntLaunchesFetcher } from './src/fetchers/real-sources/producthunt-launches';
import { YCombinatorStartupsFetcher } from './src/fetchers/real-sources/ycombinator-startups';

async function testQualityFetchers() {
  console.log('🎯 TESTING QUALITY STARTUP SOURCES');
  console.log('=====================================\n');
  
  // Test ProductHunt
  console.log('1️⃣ ProductHunt Launches:');
  try {
    const phFetcher = new ProductHuntLaunchesFetcher();
    const phData = await phFetcher.fetch();
    console.log(`   Fetched: ${phData.length} responses`);
    
    const phItems = await phFetcher.transform(phData);
    console.log(`   Products: ${phItems.length} items`);
    
    if (phItems.length > 0) {
      console.log('\n   Sample launches:');
      phItems.slice(0, 3).forEach(item => {
        console.log(`   • ${item.title}`);
        console.log(`     ${item.url}`);
        console.log(`     Score: ${item.metadata?.accelerate_score}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test YCombinator
  console.log('\n2️⃣ YCombinator Startups:');
  try {
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycData = await ycFetcher.fetch();
    console.log(`   Fetched: ${ycData.length} responses`);
    
    const ycItems = await ycFetcher.transform(ycData);
    console.log(`   Companies: ${ycItems.length} items`);
    
    if (ycItems.length > 0) {
      console.log('\n   Sample YC companies:');
      ycItems.slice(0, 3).forEach(item => {
        console.log(`   • ${item.title} (${item.metadata?.yc_batch})`);
        console.log(`     ${item.description}`);
        console.log(`     Score: ${item.metadata?.accelerate_score}`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

testQualityFetchers();