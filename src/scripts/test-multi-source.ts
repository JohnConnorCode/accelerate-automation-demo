#!/usr/bin/env node
/**
 * TEST MULTI-SOURCE AGGREGATION
 * Demonstrates combining data from multiple sources into rich profiles
 */

import { config } from 'dotenv';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { RedditStartupsFetcher } from '../fetchers/real-sources/reddit-startups';
import { multiSourceAggregator } from '../services/multi-source-aggregator';
import { crossPlatformMatcher } from '../services/cross-platform-matcher';

config();

async function testMultiSourceAggregation() {
  console.log('🚀 MULTI-SOURCE DATA AGGREGATION TEST\n');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Fetch from multiple sources
    console.log('\n📡 STEP 1: FETCHING FROM MULTIPLE SOURCES...\n');
    
    const allItems: any[] = [];
    
    // Fetch YC companies
    console.log('  Fetching YC companies...');
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycRaw = await ycFetcher.fetch();
    const ycData = await ycFetcher.transform(ycRaw);
    console.log(`  ✅ Got ${ycData.length} YC companies`);
    allItems.push(...ycData.slice(0, 10)); // Take 10 for testing
    
    // Fetch RSS items
    console.log('  Fetching RSS feeds...');
    const rssFetcher = new RSSAggregatorFetcher();
    const rssRaw = await rssFetcher.fetch();
    const rssData = await rssFetcher.transform(rssRaw);
    console.log(`  ✅ Got ${rssData.length} RSS items`);
    allItems.push(...rssData.slice(0, 10)); // Take 10 for testing
    
    // Fetch Reddit posts
    console.log('  Fetching Reddit posts...');
    const redditFetcher = new RedditStartupsFetcher();
    const redditRaw = await redditFetcher.fetch();
    const redditData = await redditFetcher.transform(redditRaw);
    console.log(`  ✅ Got ${redditData.length} Reddit posts`);
    allItems.push(...redditData.slice(0, 10)); // Take 10 for testing
    
    console.log(`\n📊 Total items collected: ${allItems.length}`);
    
    // Step 2: Match items across sources
    console.log('\n🔍 STEP 2: MATCHING ITEMS ACROSS SOURCES...\n');
    
    const matches = await crossPlatformMatcher.matchItems(allItems);
    console.log(`  Found ${matches.size} unique entities`);
    
    // Show some matches
    let matchCount = 0;
    for (const [key, items] of matches.entries()) {
      if (items.length > 1 && matchCount < 3) {
        console.log(`\n  Match Group ${++matchCount}:`);
        items.forEach(item => {
          console.log(`    - ${item.title} (${item.source})`);
        });
      }
    }
    
    // Step 3: Aggregate into unified profiles
    console.log('\n🎯 STEP 3: CREATING UNIFIED PROFILES...\n');
    
    const profiles = await multiSourceAggregator.aggregate(allItems);
    console.log(`  Created ${profiles.length} unified profiles`);
    
    // Step 4: Show enriched profiles
    console.log('\n💎 STEP 4: ENRICHED PROFILE EXAMPLES...\n');
    
    // Find the most complete profiles
    const topProfiles = profiles
      .sort((a, b) => b.metadata.data_quality.completeness - a.metadata.data_quality.completeness)
      .slice(0, 3);
    
    topProfiles.forEach((profile, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 PROFILE ${index + 1}: ${profile.canonical_name}`);
      console.log(`${'='.repeat(60)}`);
      
      console.log('\n🆔 IDENTIFIERS:');
      console.log(`  Domain: ${profile.identifiers.domain || 'N/A'}`);
      console.log(`  GitHub: ${profile.identifiers.github_org || 'N/A'}`);
      console.log(`  Twitter: ${profile.identifiers.twitter_handle || 'N/A'}`);
      
      console.log('\n🏢 COMPANY:');
      console.log(`  Stage: ${profile.company.stage}`);
      console.log(`  Tags: ${profile.company.tags.slice(0, 5).join(', ')}`);
      console.log(`  Founded: ${profile.company.founded_date || 'N/A'}`);
      
      console.log('\n👥 TEAM:');
      console.log(`  Size: ${profile.team.size} (${profile.team.size_range})`);
      console.log(`  Founders: ${profile.team.founders.map(f => f.name).join(', ') || 'N/A'}`);
      
      console.log('\n💰 FUNDING:');
      console.log(`  Total Raised: $${(profile.funding.total_raised || 0).toLocaleString()}`);
      console.log(`  Investors: ${profile.funding.investors.slice(0, 3).join(', ') || 'N/A'}`);
      
      console.log('\n📊 METRICS:');
      if (profile.metrics.github_stars) {
        console.log(`  GitHub Stars: ${profile.metrics.github_stars}`);
      }
      if (profile.metrics.product_hunt_votes) {
        console.log(`  ProductHunt Votes: ${profile.metrics.product_hunt_votes}`);
      }
      if (profile.metrics.twitter_followers) {
        console.log(`  Twitter Followers: ${profile.metrics.twitter_followers}`);
      }
      
      console.log('\n📰 CONTENT:');
      console.log(`  News Articles: ${profile.content.news_articles.length}`);
      console.log(`  Launches: ${profile.content.launches.length}`);
      console.log(`  Social Posts: ${profile.content.social_posts.length}`);
      
      console.log('\n✅ DATA QUALITY:');
      console.log(`  Completeness: ${profile.metadata.data_quality.completeness}%`);
      console.log(`  Confidence: ${profile.metadata.data_quality.confidence}%`);
      console.log(`  Sources: ${profile.metadata.sources.join(', ')}`);
      console.log(`  Verification: ${profile.metadata.data_quality.verification_level}`);
      
      console.log('\n🚀 ACCELERATE SCORE:');
      console.log(`  Score: ${profile.accelerate.score}/100`);
      console.log(`  Eligible: ${profile.accelerate.eligible ? '✅ Yes' : '❌ No'}`);
      console.log(`  Recommendation: ${profile.accelerate.recommendation.toUpperCase()}`);
      console.log(`  Criteria Met:`);
      Object.entries(profile.accelerate.criteria_met).forEach(([key, value]) => {
        console.log(`    - ${key}: ${value ? '✅' : '❌'}`);
      });
    });
    
    // Step 5: Statistics
    console.log('\n' + '='.repeat(60));
    console.log('📈 AGGREGATION STATISTICS');
    console.log('='.repeat(60));
    
    const avgCompleteness = profiles.reduce((sum, p) => 
      sum + p.metadata.data_quality.completeness, 0
    ) / profiles.length;
    
    const multiSourceProfiles = profiles.filter(p => 
      p.metadata.sources.length > 1
    );
    
    const highQualityProfiles = profiles.filter(p => 
      p.metadata.data_quality.completeness > 70
    );
    
    const accelerateEligible = profiles.filter(p => 
      p.accelerate.eligible
    );
    
    console.log(`\n  Total Profiles: ${profiles.length}`);
    console.log(`  Multi-Source Profiles: ${multiSourceProfiles.length} (${Math.round(multiSourceProfiles.length / profiles.length * 100)}%)`);
    console.log(`  High Quality (>70%): ${highQualityProfiles.length} (${Math.round(highQualityProfiles.length / profiles.length * 100)}%)`);
    console.log(`  Average Completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`  ACCELERATE Eligible: ${accelerateEligible.length} (${Math.round(accelerateEligible.length / profiles.length * 100)}%)`);
    
    // Step 6: Enrichment opportunities
    console.log('\n🔮 ENRICHMENT OPPORTUNITIES:\n');
    
    const enrichmentNeeded = profiles.filter(p => 
      p.metadata.data_quality.completeness < 50
    );
    
    if (enrichmentNeeded.length > 0) {
      console.log(`  ${enrichmentNeeded.length} profiles need enrichment:`);
      enrichmentNeeded.slice(0, 5).forEach(p => {
        console.log(`    - ${p.canonical_name}: Missing ${p.metadata.data_quality.missing_fields.slice(0, 3).join(', ')}`);
      });
    }
    
    // Step 7: Cross-platform discovery
    console.log('\n🌐 CROSS-PLATFORM DISCOVERY:\n');
    
    // Find a YC company and discover its other platforms
    const ycProfile = profiles.find(p => p.metadata.sources.includes('YCombinator'));
    if (ycProfile) {
      console.log(`  Testing cross-platform discovery for: ${ycProfile.canonical_name}`);
      
      const crossPlatform = await crossPlatformMatcher.findAcrossPlatforms({
        platform: 'yc',
        identifier: ycProfile.canonical_name.toLowerCase().replace(/\s+/g, '-')
      });
      
      console.log(`  Found on ${crossPlatform.platforms.size} platforms:`);
      for (const [platform, identity] of crossPlatform.platforms.entries()) {
        console.log(`    - ${platform}: ${identity.url} (confidence: ${(identity.confidence * 100).toFixed(0)}%)`);
      }
      
      if (crossPlatform.enrichment_opportunities.length > 0) {
        console.log(`  Could enrich from: ${crossPlatform.enrichment_opportunities.join(', ')}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

// Run test
console.log('Testing Multi-Source Data Aggregation System');
console.log('This demonstrates how we combine data from multiple sources\n');

testMultiSourceAggregation().then(() => {
  console.log('\n✅ Test completed successfully');
}).catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});