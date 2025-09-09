#!/usr/bin/env node
/**
 * DOMAIN-BASED Entity Matcher
 * Uses domains/URLs as primary matching signal for higher accuracy
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { RedditStartupsFetcher } from '../fetchers/real-sources/reddit-startups';
import { ContentItem } from '../lib/base-fetcher';

config();

interface EnrichedEntity {
  // Core identity
  name: string;
  normalized_name: string;
  domain: string | null;
  
  // Source data
  yc_data?: ContentItem;
  news_mentions: ContentItem[];
  reddit_mentions: ContentItem[];
  
  // Extracted info
  description: string;
  url: string;
  yc_batch?: string;
  
  // Match quality
  match_confidence: number;
  match_signals: string[];
  verified: boolean;
  
  // Scoring
  accelerate_score: number;
}

class DomainBasedMatcher {
  
  /**
   * Extract clean domain from URL
   */
  private extractDomain(url: string): string | null {
    if (!url) return null;
    
    try {
      // Handle various URL formats
      let cleanUrl = url.trim();
      if (!cleanUrl.includes('://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const urlObj = new URL(cleanUrl);
      // Remove www and trailing slashes
      return urlObj.hostname
        .replace(/^www\./, '')
        .toLowerCase();
    } catch {
      // Try basic extraction for malformed URLs
      const match = url.match(/(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
      return match ? match[1].toLowerCase() : null;
    }
  }
  
  /**
   * Extract all URLs/domains from text
   */
  private extractDomainsFromText(text: string): string[] {
    if (!text) return [];
    
    const domains = new Set<string>();
    
    // Match URLs
    const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?:[\/\s,;]|$)/gi;
    const matches = text.matchAll(urlRegex);
    
    for (const match of matches) {
      const domain = this.extractDomain(match[0]);
      if (domain && !this.isCommonDomain(domain)) {
        domains.add(domain);
      }
    }
    
    return Array.from(domains);
  }
  
  /**
   * Check if domain is too common (news sites, social media, etc)
   */
  private isCommonDomain(domain: string): boolean {
    const commonDomains = [
      'twitter.com', 'x.com', 'facebook.com', 'linkedin.com', 
      'github.com', 'youtube.com', 'medium.com',
      'techcrunch.com', 'venturebeat.com', 'forbes.com',
      'bloomberg.com', 'reuters.com', 'wsj.com',
      'ycombinator.com', 'producthunt.com'
    ];
    
    return commonDomains.includes(domain);
  }
  
  /**
   * Normalize company name
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc\.?|llc|ltd|corp|company|labs?|technologies|\.com|\.io|\.ai)\.?\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Check if company name appears with proper boundaries
   */
  private nameMatches(text: string, companyName: string): boolean {
    if (!text || !companyName) return false;
    
    const normalized = this.normalize(companyName);
    
    // Skip very short names
    if (normalized.length < 4) return false;
    
    const textLower = text.toLowerCase();
    
    // Check for exact company name (case insensitive)
    if (textLower.includes(companyName.toLowerCase())) return true;
    
    // Check for normalized version (only if long enough)
    if (normalized.length >= 5) {
      // Create word boundary regex
      const regex = new RegExp(`\\b${normalized}\\b`, 'i');
      if (regex.test(textLower)) return true;
    }
    
    return false;
  }
  
  /**
   * Match YC company with news/Reddit items
   */
  private matchCompanyWithContent(
    ycCompany: ContentItem,
    contentItems: ContentItem[],
    source: 'news' | 'reddit'
  ): ContentItem[] {
    const matches: ContentItem[] = [];
    const companyDomain = this.extractDomain(ycCompany.url);
    
    for (const item of contentItems) {
      let confidence = 0;
      const signals: string[] = [];
      
      // 1. Domain matching (highest confidence)
      if (companyDomain) {
        // Check if article mentions the company's domain
        const contentDomains = this.extractDomainsFromText(
          `${item.title} ${item.description}`
        );
        
        if (contentDomains.includes(companyDomain)) {
          confidence += 70;
          signals.push(`domain:${companyDomain}`);
        }
        
        // Check if article is FROM the company's domain
        const itemDomain = this.extractDomain(item.url);
        if (itemDomain === companyDomain) {
          confidence += 30;
          signals.push('same_domain');
        }
      }
      
      // 2. Name matching (medium confidence)
      const content = `${item.title} ${item.description}`;
      if (this.nameMatches(content, ycCompany.title)) {
        confidence += 40;
        signals.push('name_match');
      }
      
      // 3. YC batch mention (supporting signal)
      const batch = ycCompany.metadata?.yc_batch;
      if (batch && content.toLowerCase().includes(batch.toLowerCase())) {
        confidence += 10;
        signals.push(`batch:${batch}`);
      }
      
      // 4. Context validation for news
      if (source === 'news' && confidence > 0) {
        // Check for startup/funding context
        const startupKeywords = ['startup', 'founder', 'raises', 'funding', 'seed', 'series', 'yc'];
        const hasContext = startupKeywords.some(kw => 
          content.toLowerCase().includes(kw)
        );
        
        if (hasContext) {
          confidence += 10;
          signals.push('startup_context');
        }
      }
      
      // Require minimum confidence
      if (confidence >= 50) {
        // Add match metadata
        (item as any).__match_confidence = confidence;
        (item as any).__match_signals = signals;
        matches.push(item);
      }
    }
    
    return matches;
  }
  
  /**
   * Create enriched entity from YC company
   */
  private createEnrichedEntity(
    ycCompany: ContentItem,
    newsMatches: ContentItem[],
    redditMatches: ContentItem[]
  ): EnrichedEntity {
    const domain = this.extractDomain(ycCompany.url);
    
    // Calculate overall confidence
    const hasNews = newsMatches.length > 0;
    const hasReddit = redditMatches.length > 0;
    const hasDomain = domain !== null;
    
    let confidence = 50; // Base confidence for YC company
    if (hasDomain) confidence += 20;
    if (hasNews) confidence += 20;
    if (hasReddit) confidence += 10;
    
    // Collect all match signals
    const allSignals = new Set<string>();
    if (hasDomain) allSignals.add('has_domain');
    if (hasNews) allSignals.add(`news:${newsMatches.length}`);
    if (hasReddit) allSignals.add(`reddit:${redditMatches.length}`);
    
    // Add specific match signals
    [...newsMatches, ...redditMatches].forEach(match => {
      const signals = (match as any).__match_signals;
      if (signals) {
        signals.forEach((s: string) => allSignals.add(s));
      }
    });
    
    return {
      name: ycCompany.title,
      normalized_name: this.normalize(ycCompany.title),
      domain,
      
      yc_data: ycCompany,
      news_mentions: newsMatches,
      reddit_mentions: redditMatches,
      
      description: ycCompany.description,
      url: ycCompany.url,
      yc_batch: ycCompany.metadata?.yc_batch,
      
      match_confidence: Math.min(100, confidence),
      match_signals: Array.from(allSignals),
      verified: confidence >= 70 && hasDomain,
      
      accelerate_score: ycCompany.metadata?.accelerate_score || 50
    };
  }
  
  /**
   * Run domain-based matching
   */
  async runMatching() {
    console.log('🌐 DOMAIN-BASED ENTITY MATCHING\n');
    console.log('=' .repeat(70));
    
    try {
      // 1. Fetch all data sources
      console.log('📡 Fetching data sources...\n');
      
      const ycFetcher = new YCombinatorStartupsFetcher();
      const ycRaw = await ycFetcher.fetch();
      const ycData = await ycFetcher.transform(ycRaw);
      console.log(`✅ YC Companies: ${ycData.length}`);
      
      const rssFetcher = new RSSAggregatorFetcher();
      const rssRaw = await rssFetcher.fetch();
      const rssData = await rssFetcher.transform(rssRaw);
      console.log(`✅ RSS Articles: ${rssData.length}`);
      
      const redditFetcher = new RedditStartupsFetcher();
      const redditRaw = await redditFetcher.fetch();
      const redditData = await redditFetcher.transform(redditRaw);
      console.log(`✅ Reddit Posts: ${redditData.length}\n`);
      
      // 2. Filter YC companies with valid domains
      const companiesWithDomains = ycData.filter(yc => {
        const domain = this.extractDomain(yc.url);
        return domain && !this.isCommonDomain(domain);
      });
      
      console.log(`📊 YC companies with valid domains: ${companiesWithDomains.length}/${ycData.length}\n`);
      
      // 3. Perform matching
      console.log('🔍 MATCHING ENTITIES...\n');
      
      const enrichedEntities: EnrichedEntity[] = [];
      
      // Process first 50 companies for demonstration
      for (const ycCompany of companiesWithDomains.slice(0, 50)) {
        const newsMatches = this.matchCompanyWithContent(ycCompany, rssData, 'news');
        const redditMatches = this.matchCompanyWithContent(ycCompany, redditData, 'reddit');
        
        const entity = this.createEnrichedEntity(ycCompany, newsMatches, redditMatches);
        enrichedEntities.push(entity);
        
        if (newsMatches.length > 0 || redditMatches.length > 0) {
          console.log(`✅ ${entity.name} - News: ${newsMatches.length}, Reddit: ${redditMatches.length}`);
        }
      }
      
      // 4. Analyze results
      const withMatches = enrichedEntities.filter(e => 
        e.news_mentions.length > 0 || e.reddit_mentions.length > 0
      );
      
      const verified = enrichedEntities.filter(e => e.verified);
      
      console.log('\n' + '=' .repeat(70));
      console.log('📊 MATCHING RESULTS:');
      console.log('=' .repeat(70));
      
      console.log(`\nTotal entities processed: ${enrichedEntities.length}`);
      console.log(`Entities with matches: ${withMatches.length} (${(withMatches.length/enrichedEntities.length*100).toFixed(1)}%)`);
      console.log(`Verified entities: ${verified.length} (${(verified.length/enrichedEntities.length*100).toFixed(1)}%)`);
      
      if (withMatches.length > 0) {
        console.log('\n🏆 TOP ENRICHED ENTITIES:\n');
        
        withMatches
          .sort((a, b) => b.match_confidence - a.match_confidence)
          .slice(0, 5)
          .forEach((entity, index) => {
            console.log(`${index + 1}. ${entity.name} (${entity.yc_batch})`);
            console.log(`   Domain: ${entity.domain || 'none'}`);
            console.log(`   News mentions: ${entity.news_mentions.length}`);
            console.log(`   Reddit mentions: ${entity.reddit_mentions.length}`);
            console.log(`   Confidence: ${entity.match_confidence}%`);
            console.log(`   Signals: ${entity.match_signals.slice(0, 3).join(', ')}`);
            console.log(`   Verified: ${entity.verified ? '✅' : '❌'}`);
            console.log('');
          });
      }
      
      // 5. Insert high-confidence matches to database
      if (verified.length > 0) {
        console.log('💾 INSERTING VERIFIED ENTITIES...\n');
        
        const insertData = verified
          .sort((a, b) => b.match_confidence - a.match_confidence)
          .slice(0, 10)
          .map(entity => ({
            title: entity.name,
            description: entity.description.substring(0, 1000),
            url: entity.url,
            source: `YC + ${entity.news_mentions.length > 0 ? 'News' : ''} ${entity.reddit_mentions.length > 0 ? 'Reddit' : ''}`.trim(),
            type: 'project' as const,
            score: entity.accelerate_score,
            confidence: entity.match_confidence / 100,
            recommendation: entity.match_confidence >= 80 ? 'feature' : 'approve',
            status: 'pending_review',
            metadata: {
              yc_batch: entity.yc_batch,
              domain: entity.domain,
              news_count: entity.news_mentions.length,
              reddit_count: entity.reddit_mentions.length,
              match_signals: entity.match_signals,
              verified: entity.verified,
              enriched: true
            },
            created_at: new Date().toISOString()
          }));
        
        // Check for duplicates
        const { data: existing } = await supabase
          .from('content_queue')
          .select('title')
          .in('title', insertData.map(d => d.title));
        
        const existingTitles = new Set((existing || []).map(e => e.title));
        const newItems = insertData.filter(d => !existingTitles.has(d.title));
        
        if (newItems.length > 0) {
          const { data, error } = await supabase
            .from('content_queue')
            .insert(newItems)
            .select('id, title');
          
          if (error) {
            console.log('❌ Database error:', error.message);
          } else if (data) {
            console.log(`✅ Inserted ${data.length} verified entities:`);
            data.forEach(d => console.log(`   - ${d.title}`));
          }
        } else {
          console.log('ℹ️  All verified entities already in database');
        }
      }
      
      // 6. Summary
      console.log('\n' + '=' .repeat(70));
      console.log('📈 FINAL SUMMARY:');
      console.log('=' .repeat(70));
      
      console.log(`\nMatch rate: ${(withMatches.length/enrichedEntities.length*100).toFixed(1)}%`);
      console.log(`Verification rate: ${(verified.length/enrichedEntities.length*100).toFixed(1)}%`);
      console.log(`Average confidence: ${(enrichedEntities.reduce((sum, e) => sum + e.match_confidence, 0) / enrichedEntities.length).toFixed(1)}%`);
      
      if (withMatches.length === 0) {
        console.log('\n⚠️  No matches found. This is expected for very new YC companies.');
        console.log('   They may not have press coverage yet.');
        console.log('   Consider adding more news sources or waiting for coverage.');
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
}

// Run the matcher
async function main() {
  console.log('Starting domain-based entity matching...\n');
  console.log('This version uses domains as the primary matching signal\n');
  
  const matcher = new DomainBasedMatcher();
  await matcher.runMatching();
  
  console.log('\n✅ Domain-based matching completed');
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});