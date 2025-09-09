#!/usr/bin/env node
/**
 * REAL Multi-Source Data Matcher
 * Actually matches and combines YC, RSS, and Reddit data
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { RedditStartupsFetcher } from '../fetchers/real-sources/reddit-startups';
import { ContentItem } from '../lib/base-fetcher';

config();

interface MatchedEntity {
  name: string;
  normalized_name: string;
  items: ContentItem[];
  sources: string[];
  
  // Merged data
  description: string;
  url: string;
  
  // YC specific
  yc_batch?: string;
  yc_location?: string;
  
  // Funding (from multiple sources)
  funding_amount?: number;
  funding_round?: string;
  investors?: string[];
  
  // Metrics
  reddit_upvotes?: number;
  team_size?: number;
  
  // Scoring
  match_confidence: number;
  data_completeness: number;
  accelerate_score: number;
}

class RealMatcher {
  /**
   * Normalize company name for matching
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|company|labs?|technologies|ai|io)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Calculate string similarity (0-1) - IMPROVED VERSION
   */
  private similarity(str1: string, str2: string): number {
    const s1 = this.normalizeName(str1);
    const s2 = this.normalizeName(str2);
    
    // Exact match
    if (s1 === s2) return 1.0;
    
    // Skip if one string is too short (avoid false matches like "jo")
    if (s1.length < 3 || s2.length < 3) {
      return s1 === s2 ? 1.0 : 0.0;
    }
    
    // One contains the other (but must be significant portion)
    if (s1.length > 5 && s2.length > 5) {
      if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    }
    
    // Levenshtein distance for similar strings
    const distance = this.levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLen);
    
    return similarity;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Match items from different sources
   */
  async matchItems(ycItems: ContentItem[], rssItems: ContentItem[], redditItems: ContentItem[]): Promise<MatchedEntity[]> {
    console.log('\n🔍 MATCHING ITEMS ACROSS SOURCES...');
    
    const entities: MatchedEntity[] = [];
    const processedRss = new Set<number>();
    const processedReddit = new Set<number>();
    
    // Start with YC companies as base
    for (const ycItem of ycItems) {
      const entity: MatchedEntity = {
        name: ycItem.title,
        normalized_name: this.normalizeName(ycItem.title),
        items: [ycItem],
        sources: ['YCombinator'],
        
        description: ycItem.description,
        url: ycItem.url,
        yc_batch: ycItem.metadata?.yc_batch,
        yc_location: ycItem.metadata?.location,
        team_size: ycItem.metadata?.team_size,
        funding_amount: ycItem.metadata?.funding_raised,
        
        match_confidence: 1.0,
        data_completeness: 30,
        accelerate_score: ycItem.metadata?.accelerate_score || 50
      };
      
      // Try to find matches in RSS
      rssItems.forEach((rssItem, index) => {
        if (processedRss.has(index)) return;
        
        const rssTitleNorm = this.normalizeName(rssItem.title);
        const similarity = this.similarity(ycItem.title, rssItem.title);
        
        // Check if RSS item mentions this company
        const mentionsCompany = rssItem.description?.toLowerCase().includes(entity.normalized_name) ||
                               rssItem.title.toLowerCase().includes(entity.normalized_name);
        
        // Stricter matching - require high similarity OR explicit mention
        if (similarity > 0.8 || (mentionsCompany && entity.normalized_name.length > 3)) {
          console.log(`  ✅ Matched: "${ycItem.title}" ← → "${rssItem.title}" (similarity: ${(similarity * 100).toFixed(0)}%)`);
          
          entity.items.push(rssItem);
          entity.sources.push('RSS');
          processedRss.add(index);
          
          // Merge funding data from RSS
          if (rssItem.metadata?.funding_amount && rssItem.metadata.funding_amount > (entity.funding_amount || 0)) {
            entity.funding_amount = rssItem.metadata.funding_amount;
            entity.funding_round = rssItem.metadata.funding_round;
          }
          
          if (rssItem.metadata?.investors) {
            entity.investors = [...(entity.investors || []), ...rssItem.metadata.investors];
          }
          
          // Update description if RSS has more detail
          if (rssItem.description && rssItem.description.length > entity.description.length) {
            entity.description = rssItem.description;
          }
          
          entity.match_confidence = Math.min(1.0, entity.match_confidence + 0.2);
          entity.data_completeness += 20;
        }
      });
      
      // Try to find matches in Reddit
      redditItems.forEach((redditItem, index) => {
        if (processedReddit.has(index)) return;
        
        const similarity = this.similarity(ycItem.title, redditItem.title);
        const mentionsCompany = redditItem.description?.toLowerCase().includes(entity.normalized_name) ||
                               redditItem.title.toLowerCase().includes(entity.normalized_name);
        
        // Stricter Reddit matching
        if (similarity > 0.75 || (mentionsCompany && entity.normalized_name.length > 3)) {
          console.log(`  ✅ Matched: "${ycItem.title}" ← → Reddit post (similarity: ${(similarity * 100).toFixed(0)}%)`);
          
          entity.items.push(redditItem);
          entity.sources.push('Reddit');
          processedReddit.add(index);
          
          // Add Reddit metrics
          entity.reddit_upvotes = redditItem.metadata?.upvotes || redditItem.metadata?.score;
          
          entity.match_confidence = Math.min(1.0, entity.match_confidence + 0.1);
          entity.data_completeness += 10;
        }
      });
      
      // Deduplicate sources
      entity.sources = [...new Set(entity.sources)];
      
      // Recalculate score based on enriched data
      entity.accelerate_score = this.calculateScore(entity);
      
      entities.push(entity);
    }
    
    // Add unmatched RSS items as standalone entities
    rssItems.forEach((rssItem, index) => {
      if (!processedRss.has(index) && rssItem.type === 'funding') {
        entities.push({
          name: rssItem.title,
          normalized_name: this.normalizeName(rssItem.title),
          items: [rssItem],
          sources: ['RSS'],
          
          description: rssItem.description,
          url: rssItem.url,
          funding_amount: rssItem.metadata?.funding_amount,
          funding_round: rssItem.metadata?.funding_round,
          investors: rssItem.metadata?.investors,
          
          match_confidence: 0.5,
          data_completeness: 20,
          accelerate_score: 40
        });
      }
    });
    
    return entities;
  }
  
  /**
   * Calculate ACCELERATE score based on all available data
   */
  private calculateScore(entity: MatchedEntity): number {
    let score = 30; // Base score
    
    // Multi-source bonus
    if (entity.sources.length >= 3) score += 20;
    else if (entity.sources.length >= 2) score += 10;
    
    // YC backing
    if (entity.yc_batch) score += 15;
    
    // Early stage funding
    if (entity.funding_amount) {
      if (entity.funding_amount < 500000) score += 20;
      else if (entity.funding_amount < 2000000) score += 10;
    }
    
    // Small team
    if (entity.team_size && entity.team_size <= 10) score += 10;
    
    // Reddit validation
    if (entity.reddit_upvotes && entity.reddit_upvotes > 100) score += 5;
    
    // Data completeness bonus
    score += Math.round(entity.data_completeness * 0.2);
    
    return Math.min(100, score);
  }
}

async function runRealMultiSource() {
  console.log('🚀 REAL MULTI-SOURCE DATA MATCHING\n');
  console.log('=' .repeat(70));
  
  try {
    // 1. Fetch from all sources
    console.log('📡 FETCHING FROM ALL SOURCES...\n');
    
    // YC Companies
    console.log('Fetching YC companies...');
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycRaw = await ycFetcher.fetch();
    const ycData = await ycFetcher.transform(ycRaw);
    console.log(`✅ Got ${ycData.length} YC companies`);
    
    // RSS Feeds
    console.log('\nFetching RSS feeds...');
    const rssFetcher = new RSSAggregatorFetcher();
    const rssRaw = await rssFetcher.fetch();
    const rssData = await rssFetcher.transform(rssRaw);
    console.log(`✅ Got ${rssData.length} RSS items`);
    
    // Reddit Posts
    console.log('\nFetching Reddit posts...');
    const redditFetcher = new RedditStartupsFetcher();
    const redditRaw = await redditFetcher.fetch();
    const redditData = await redditFetcher.transform(redditRaw);
    console.log(`✅ Got ${redditData.length} Reddit posts`);
    
    // 2. Match and merge
    const matcher = new RealMatcher();
    const matched = await matcher.matchItems(
      ycData.slice(0, 30),  // Process first 30 YC companies
      rssData.slice(0, 50), // First 50 RSS items
      redditData.slice(0, 50) // First 50 Reddit posts
    );
    
    console.log(`\n✅ Created ${matched.length} matched entities`);
    
    // 3. Show multi-source matches
    console.log('\n🎯 MULTI-SOURCE MATCHES:');
    console.log('=' .repeat(70));
    
    const multiSource = matched.filter(e => e.sources.length > 1);
    console.log(`\nFound ${multiSource.length} companies with multiple sources:\n`);
    
    multiSource.slice(0, 10).forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name}`);
      console.log(`   Sources: ${entity.sources.join(', ')}`);
      console.log(`   YC Batch: ${entity.yc_batch || 'N/A'}`);
      console.log(`   Funding: $${(entity.funding_amount || 0).toLocaleString()}`);
      console.log(`   Match Confidence: ${(entity.match_confidence * 100).toFixed(0)}%`);
      console.log(`   Data Completeness: ${entity.data_completeness}%`);
      console.log(`   ACCELERATE Score: ${entity.accelerate_score}/100`);
      console.log('');
    });
    
    // 4. Prepare for database insertion
    console.log('💾 PREPARING FOR DATABASE INSERTION...\n');
    
    const topEntities = matched
      .sort((a, b) => b.accelerate_score - a.accelerate_score)
      .slice(0, 20);
    
    const insertData = topEntities.map((entity, index) => ({
      title: entity.name,
      description: entity.description.substring(0, 1000),
      url: entity.url || `https://placeholder.com/${entity.normalized_name}-${Date.now()}-${index}`,
      source: entity.sources.join(', '),
      type: 'project',
      score: entity.accelerate_score,
      confidence: entity.match_confidence,
      recommendation: entity.accelerate_score > 70 ? 'feature' : 'approve',
      status: 'pending_review',
      metadata: {
        yc_batch: entity.yc_batch,
        funding_amount: entity.funding_amount,
        funding_round: entity.funding_round,
        investors: entity.investors,
        team_size: entity.team_size,
        reddit_upvotes: entity.reddit_upvotes,
        sources: entity.sources,
        data_completeness: entity.data_completeness,
        items_merged: entity.items.length
      },
      created_at: new Date().toISOString()
    }));
    
    console.log('Inserting top 20 enriched entities...\n');
    
    // Insert in batches
    const batchSize = 5;
    let inserted = 0;
    
    for (let i = 0; i < insertData.length; i += batchSize) {
      const batch = insertData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('content_queue')
        .insert(batch)
        .select('id, title');
      
      if (error) {
        console.log(`❌ Batch failed: ${error.message}`);
      } else if (data) {
        inserted += data.length;
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${data.length} items`);
      }
    }
    
    // 5. Statistics
    console.log('\n📊 FINAL STATISTICS:');
    console.log('=' .repeat(70));
    
    const avgCompleteness = matched.reduce((sum, e) => sum + e.data_completeness, 0) / matched.length;
    const avgScore = matched.reduce((sum, e) => sum + e.accelerate_score, 0) / matched.length;
    
    console.log(`\nTotal entities: ${matched.length}`);
    console.log(`Multi-source entities: ${multiSource.length} (${Math.round(multiSource.length/matched.length*100)}%)`);
    console.log(`Average data completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`Average ACCELERATE score: ${avgScore.toFixed(1)}/100`);
    console.log(`Items inserted to database: ${inserted}`);
    
    // Get total count
    const { count } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total items in queue: ${count}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the real multi-source matcher
console.log('Starting REAL multi-source data matching...');
console.log('This will actually match and merge data from YC, RSS, and Reddit\n');

runRealMultiSource().then(() => {
  console.log('\n✅ Multi-source matching completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Failed:', err);
  process.exit(1);
});