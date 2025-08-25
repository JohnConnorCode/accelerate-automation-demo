#!/usr/bin/env npx tsx
/**
 * Quick verification that we're using REAL APIs, not mock data
 */

import { config } from 'dotenv';
config();

// Test a few known REAL fetchers
import { GitHubReposFetcher } from './src/fetchers/projects/github-repos';
import { DevToFetcher } from './src/fetchers/resources/devto';

console.log('🔍 VERIFYING REAL DATA SOURCES (NOT MOCK)');
console.log('=========================================\n');

async function verifyRealData() {
  let realCount = 0;
  let mockCount = 0;
  
  // Test 1: GitHub API (REAL)
  console.log('1. GitHub API:');
  try {
    const github = new GitHubReposFetcher();
    const data = await github.fetch();
    const items = await github.transform(data);
    
    if (items.length > 0 && !items[0].url.includes('example.com')) {
      console.log(`   ✅ REAL - Found ${items.length} actual GitHub repos`);
      console.log(`   Sample: ${items[0].url}`);
      realCount++;
    } else {
      console.log('   ❌ No data or mock detected');
      mockCount++;
    }
  } catch (e) {
    console.log('   ⚠️ API error (may need token)');
  }
  
  // Test 2: Dev.to API (REAL)
  console.log('\n2. Dev.to API:');
  try {
    const devto = new DevToFetcher();
    const data = await devto.fetch();
    const items = await devto.transform(data);
    
    if (items.length > 0 && items[0].url.includes('dev.to')) {
      console.log(`   ✅ REAL - Found ${items.length} actual Dev.to articles`);
      console.log(`   Sample: ${items[0].url}`);
      realCount++;
    } else {
      console.log('   ❌ No data or mock detected');
      mockCount++;
    }
  } catch (e) {
    console.log('   ⚠️ API error');
  }
  
  // Check for mock fetchers
  console.log('\n3. Checking for mock data in codebase:');
  const { execSync } = require('child_process');
  
  try {
    const mockFiles = execSync('grep -l "getMockData\\|example\\.com" src/fetchers/**/*.ts 2>/dev/null | wc -l', { encoding: 'utf8' }).trim();
    const totalFiles = execSync('find src/fetchers -name "*.ts" | wc -l', { encoding: 'utf8' }).trim();
    
    console.log(`   Found ${mockFiles} fetchers using mock data out of ${totalFiles} total`);
    
    if (parseInt(mockFiles) > 0) {
      console.log('\n   Files with mock data:');
      const mockList = execSync('grep -l "getMockData\\|example\\.com" src/fetchers/**/*.ts 2>/dev/null | head -5', { encoding: 'utf8' });
      mockList.split('\n').filter(f => f).forEach(f => {
        console.log(`   - ${f.replace('src/fetchers/', '')}`);
      });
    }
  } catch (e) {
    console.log('   Could not scan files');
  }
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VERIFICATION RESULTS:');
  console.log('='.repeat(50));
  
  if (realCount >= 2) {
    console.log('✅ CONFIRMED: Using REAL APIs for data fetching');
    console.log(`✅ ${realCount} real data sources verified`);
  } else {
    console.log('⚠️ WARNING: Not enough real data sources confirmed');
  }
  
  console.log('\n📝 To fix mock fetchers:');
  console.log('1. Replace example.com URLs with real API endpoints');
  console.log('2. Remove getMockData() calls');
  console.log('3. Use actual APIs like:');
  console.log('   - api.github.com (working)');
  console.log('   - dev.to/api (working)');
  console.log('   - api.llama.fi (DeFiLlama - free)');
  console.log('   - api.coingecko.com/api/v3 (free tier)');
}

verifyRealData().then(() => process.exit(0)).catch(console.error);