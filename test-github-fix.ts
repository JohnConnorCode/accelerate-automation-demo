#!/usr/bin/env npx tsx

import { GitHubTrendingFetcher } from './src/fetchers/real-sources/github-trending';

async function testGitHub() {
  console.log('🔍 Testing GitHub Fetcher\n');
  
  const fetcher = new GitHubTrendingFetcher();
  const result = await fetcher.fetch();
  
  console.log(`Fetched ${result.items.length} GitHub repos`);
  
  if (result.items.length > 0) {
    const sample = result.items[0];
    console.log('\n📦 Sample repo structure:');
    console.log('Keys:', Object.keys(sample));
    console.log('\nSample data:');
    console.log('- name:', sample.name);
    console.log('- full_name:', sample.full_name);
    console.log('- description:', sample.description);
    console.log('- html_url:', sample.html_url);
    console.log('- title:', sample.title);
    console.log('- url:', sample.url);
    
    // Check what's missing for validation
    const hasTitle = sample.title || sample.name;
    const hasUrl = sample.url || sample.html_url;
    
    console.log('\n✅ Has title/name:', !!hasTitle);
    console.log('✅ Has URL:', !!hasUrl);
    
    if (!hasTitle) {
      console.log('\n❌ PROBLEM: GitHub repos missing title field!');
      console.log('Need to map name -> title');
    }
  }
  
  return result.items.length;
}

testGitHub().catch(console.error);