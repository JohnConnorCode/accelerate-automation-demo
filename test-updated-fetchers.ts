#!/usr/bin/env npx tsx
/**
 * Test the updated fetchers with real APIs
 */

import { config } from 'dotenv';
config();

import { EcosystemListsFetcher } from './src/fetchers/projects/ecosystem-lists';
import { Web3DirectoriesFetcher } from './src/fetchers/projects/web3-directories';
import { AccelerateScorer } from './src/lib/accelerate-scorer';

async function testUpdatedFetchers() {
  console.log('🧪 TESTING UPDATED FETCHERS WITH REAL APIS');
  console.log('=' .repeat(60));
  
  const results: any = {
    ecosystemLists: { success: false, count: 0, error: null },
    web3Directories: { success: false, count: 0, error: null }
  };
  
  // Test EcosystemListsFetcher
  console.log('\n1️⃣ Testing EcosystemListsFetcher...');
  try {
    const fetcher = new EcosystemListsFetcher();
    const result = await fetcher.execute();
    results.ecosystemLists.success = result.success;
    results.ecosystemLists.count = result.fetched;
    
    console.log(`   ✅ Success! Found ${result.fetched} projects`);
    if (result.errors && result.errors.length > 0) {
      console.log(`   ⚠️ Errors: ${result.errors.join(', ')}`);
    }
  } catch (error: any) {
    results.ecosystemLists.error = error.message;
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Test Web3DirectoriesFetcher
  console.log('\n2️⃣ Testing Web3DirectoriesFetcher...');
  try {
    const fetcher = new Web3DirectoriesFetcher();
    const result = await fetcher.execute();
    results.web3Directories.success = result.success;
    results.web3Directories.count = result.fetched;
    
    console.log(`   ✅ Success! Found ${result.fetched} projects`);
    if (result.errors && result.errors.length > 0) {
      console.log(`   ⚠️ Errors: ${result.errors.join(', ')}`);
    }
  } catch (error: any) {
    results.web3Directories.error = error.message;
    console.log(`   ❌ Failed: ${error.message}`);
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 FETCHER TEST SUMMARY');
  console.log('=' .repeat(60));
  
  const totalSuccess = Object.values(results).filter((r: any) => r.success).length;
  const totalProjects = Object.values(results).reduce((sum: number, r: any) => sum + r.count, 0);
  
  console.log(`\n✅ Successful fetchers: ${totalSuccess}/2`);
  console.log(`📦 Total projects fetched: ${totalProjects}`);
  
  console.log('\nDetails:');
  Object.entries(results).forEach(([name, result]: [string, any]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${name}: ${result.count} items ${result.error ? `(${result.error})` : ''}`);
  });
  
  if (totalSuccess === 2) {
    console.log('\n🎉 All updated fetchers are working with real APIs!');
  } else {
    console.log('\n⚠️ Some fetchers need attention');
  }
  
  // Test scoring on combined results
  if (totalProjects > 0) {
    console.log('\n🎯 Testing Scoring System...');
    console.log('Note: Fetchers save directly to database, scoring test skipped');
    // The fetchers now save directly to the database via execute()
    // To test scoring, we would need to query the database
  }
}

testUpdatedFetchers().catch(console.error);