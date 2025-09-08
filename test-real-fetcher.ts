// Test the REAL fetchers directly
import { config } from 'dotenv';
config();

import { GitHubWeb3ProjectsFetcher } from './src/fetchers/real-sources/github-web3-projects';
import { DevToStartupResourcesFetcher } from './src/fetchers/real-sources/devto-startup-resources';

async function testRealFetchers() {
  console.log('🔍 TESTING REAL FETCHERS - NO FAKE DATA');
  console.log('========================================\n');
  
  // Test GitHub fetcher
  console.log('1️⃣ Testing GitHub Web3 Projects Fetcher...');
  try {
    const githubFetcher = new GitHubWeb3ProjectsFetcher();
    const githubData = await githubFetcher.fetch();
    console.log(`   ✅ Fetched ${githubData.length} GitHub responses`);
    
    const githubItems = await githubFetcher.transform(githubData);
    console.log(`   ✅ Transformed to ${githubItems.length} project items`);
    
    if (githubItems.length > 0) {
      const sample = githubItems[0];
      console.log('\n   📦 Sample GitHub Project:');
      console.log(`   - Title: ${sample.title}`);
      console.log(`   - URL: ${sample.url}`);
      console.log(`   - Description: ${sample.description?.substring(0, 100)}...`);
      console.log(`   - Score: ${sample.metadata?.accelerate_score}`);
      console.log(`   - Stars: ${sample.metadata?.github_stars}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n2️⃣ Testing Dev.to Startup Resources Fetcher...');
  try {
    const devtoFetcher = new DevToStartupResourcesFetcher();
    const devtoData = await devtoFetcher.fetch();
    console.log(`   ✅ Fetched ${devtoData.length} Dev.to responses`);
    
    const devtoItems = await devtoFetcher.transform(devtoData);
    console.log(`   ✅ Transformed to ${devtoItems.length} resource items`);
    
    if (devtoItems.length > 0) {
      const sample = devtoItems[0];
      console.log('\n   📚 Sample Dev.to Resource:');
      console.log(`   - Title: ${sample.title}`);
      console.log(`   - URL: ${sample.url}`);
      console.log(`   - Type: ${sample.type}`);
      console.log(`   - Score: ${sample.metadata?.accelerate_score}`);
      console.log(`   - Reactions: ${sample.metadata?.reactions_count}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n========================================');
  console.log('✅ Test complete - check results above');
}

testRealFetchers();