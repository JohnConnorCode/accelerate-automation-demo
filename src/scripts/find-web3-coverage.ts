#!/usr/bin/env node
/**
 * Find ACTUAL coverage of Web3 YC companies
 * These companies are 15-20 months old - they HAVE coverage
 */

import { config } from 'dotenv';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';

config();

async function findWeb3Coverage() {
  console.log('🔍 FINDING WEB3 YC COMPANY COVERAGE\n');
  console.log('=' .repeat(70));
  
  // Get YC companies
  const ycFetcher = new YCombinatorStartupsFetcher();
  const ycRaw = await ycFetcher.fetch();
  const ycAll = await ycFetcher.transform(ycRaw);
  
  // Filter for Web3
  const web3Keywords = ['crypto', 'blockchain', 'web3', 'defi', 'nft', 'token', 'wallet', 'chain', 'protocol', 'dapp', 'ethereum', 'solana'];
  
  const web3Companies = ycAll.filter(c => {
    const text = (c.title + ' ' + c.description).toLowerCase();
    return web3Keywords.some(kw => text.includes(kw));
  });
  
  console.log(`✅ Found ${web3Companies.length} Web3 YC companies\n`);
  
  // Get news
  const rssFetcher = new RSSAggregatorFetcher();
  const rssRaw = await rssFetcher.fetch();
  const rssData = await rssFetcher.transform(rssRaw);
  
  console.log(`✅ Found ${rssData.length} news articles\n`);
  
  // Search for SPECIFIC companies in news
  const companiesWithCoverage: any[] = [];
  
  // Test a few specific Web3 companies
  const testCompanies = web3Companies.slice(0, 10);
  
  console.log('SEARCHING FOR THESE SPECIFIC COMPANIES:\n');
  
  for (const company of testCompanies) {
    console.log(`Searching for: ${company.title}`);
    
    // Search in Google
    try {
      const searchQuery = `"${company.title}" YC W24 S24 crypto blockchain`;
      console.log(`  Google search: ${searchQuery}`);
      
      // Check if company appears in our RSS feeds
      const mentions = rssData.filter(article => {
        const content = (article.title + ' ' + article.description).toLowerCase();
        return content.includes(company.title.toLowerCase());
      });
      
      if (mentions.length > 0) {
        console.log(`  ✅ FOUND ${mentions.length} mentions!`);
        companiesWithCoverage.push({ company, mentions });
      } else {
        console.log(`  ❌ No mentions in current RSS`);
      }
    } catch (e) {
      console.log(`  Error searching`);
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('REALITY CHECK:\n');
  
  if (companiesWithCoverage.length === 0) {
    console.log('❌ PROBLEM: 0 matches found\n');
    console.log('WHY THIS IS WRONG:');
    console.log('1. These companies are 15-20 months old');
    console.log('2. They went through YC (high visibility)');
    console.log('3. Web3 companies get tons of coverage');
    console.log('');
    console.log('THE REAL ISSUE:');
    console.log('• Wrong RSS sources (need crypto-specific feeds)');
    console.log('• Need to search by domain not just name');
    console.log('• Need Twitter/X API for launch announcements');
    console.log('• Need CryptoSlate, CoinTelegraph, Decrypt feeds');
    console.log('• Need to check TokenOwl.ai, Celest.dev directly');
  } else {
    console.log(`✅ Found ${companiesWithCoverage.length} companies with coverage`);
    companiesWithCoverage.forEach(({ company, mentions }) => {
      console.log(`\n${company.title}:`);
      mentions.forEach((m: any) => {
        console.log(`  - ${m.title}`);
      });
    });
  }
  
  console.log('\n💡 WHAT WE NEED:');
  console.log('1. Add CoinDesk startups feed');
  console.log('2. Add CoinTelegraph feed');
  console.log('3. Add Decrypt feed');
  console.log('4. Add The Block funding feed');
  console.log('5. Search by company DOMAIN not just name');
  console.log('6. Check YC\'s own announcements');
}

findWeb3Coverage().catch(console.error);