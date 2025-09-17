#!/usr/bin/env node
/**
 * IMPROVED Entity Matcher with Better Precision
 * Reduces false positives while finding real matches
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { ContentItem } from '../lib/base-fetcher';

config();

interface MatchResult {
  ycCompany: ContentItem;
  newsItem: ContentItem;
  confidence: number;
  matchType: string;
  signals: string[];
}

class ImprovedMatcher {
  
  /**
   * Extract domain from URL or text
   */
  private extractDomain(url: string): string {
    if (!url) {return '';}
    try {
      // If it's a full URL
      if (url.includes('://')) {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '').toLowerCase();
      }
      // If it's just a domain
      return url.replace('www.', '').toLowerCase();
    } catch {
      return '';
    }
  }
  
  /**
   * Strict normalization - preserves more of the name
   */
  private strictNormalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Loose normalization - removes common suffixes
   */
  private looseNormalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc\.?|llc|ltd|corp|company|labs?|technologies|\.com|\.io|\.ai|\.co)\s*/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  /**
   * Check if text contains a company name with word boundaries
   */
  private containsCompanyName(text: string, companyName: string): boolean {
    if (!text || !companyName) {return false;}
    
    const textLower = text.toLowerCase();
    const strict = this.strictNormalize(companyName);
    const loose = this.looseNormalize(companyName);
    
    // Skip very short names
    if (loose.length < 4) {return false;}
    
    // Check for exact match with word boundaries
    const strictRegex = new RegExp(`\\b${strict.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (strictRegex.test(textLower)) {return true;}
    
    // Check for loose match (only if name is long enough)
    if (loose.length >= 5) {
      const looseRegex = new RegExp(`\\b${loose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (looseRegex.test(textLower)) {return true;}
    }
    
    return false;
  }
  
  /**
   * Enhanced matching with multiple signals
   */
  private matchItems(ycCompany: ContentItem, newsItem: ContentItem): MatchResult | null {
    const signals: string[] = [];
    let confidence = 0;
    let matchType = 'none';
    
    const companyName = ycCompany.title;
    const newsTitle = newsItem.title || '';
    const newsDesc = newsItem.description || '';
    const newsContent = `${newsTitle} ${newsDesc}`;
    
    // 1. Check for company name in title (highest confidence)
    if (this.containsCompanyName(newsTitle, companyName)) {
      confidence += 60;
      signals.push('name_in_title');
      matchType = 'strong';
    }
    
    // 2. Check for company name in description
    else if (this.containsCompanyName(newsDesc, companyName)) {
      confidence += 40;
      signals.push('name_in_description');
      matchType = 'medium';
    }
    
    // 3. Domain matching (if we have URLs)
    const ycDomain = this.extractDomain(ycCompany.url);
    const newsDomain = this.extractDomain(newsItem.url);
    
    if (ycDomain && newsDomain) {
      // Check if news is from company's own domain
      if (ycDomain === newsDomain) {
        confidence += 30;
        signals.push('same_domain');
        matchType = 'strong';
      }
      // Check if domain is mentioned in content
      else if (ycDomain && newsContent.toLowerCase().includes(ycDomain)) {
        confidence += 20;
        signals.push('domain_mentioned');
      }
    }
    
    // 4. YC batch mention (supporting signal)
    const batch = ycCompany.metadata?.yc_batch;
    if (batch && newsContent.toLowerCase().includes(batch.toLowerCase())) {
      confidence += 10;
      signals.push(`batch:${batch}`);
    }
    
    // 5. Funding context (supporting signal)
    const fundingKeywords = ['raises', 'funding', 'series', 'seed', 'investment', 'valued', 'million', 'capital'];
    const hasFundingContext = fundingKeywords.some(kw => newsTitle.toLowerCase().includes(kw));
    
    if (hasFundingContext && confidence > 0) {
      confidence += 10;
      signals.push('funding_context');
    }
    
    // 6. Location match (supporting signal)
    const location = ycCompany.metadata?.location;
    if (location && newsContent.toLowerCase().includes(location.toLowerCase())) {
      confidence += 5;
      signals.push('location_match');
    }
    
    // Require minimum confidence for a match
    if (confidence >= 40) {
      return {
        ycCompany,
        newsItem,
        confidence: Math.min(100, confidence),
        matchType,
        signals
      };
    }
    
    return null;
  }
  
  /**
   * Run improved matching
   */
  async runMatching() {
    console.log('🚀 IMPROVED ENTITY MATCHING\n');
    console.log('=' .repeat(70));
    
    try {
      // 1. Fetch data
      console.log('📡 Fetching data sources...\n');
      
      const ycFetcher = new YCombinatorStartupsFetcher();
      const ycRaw = await ycFetcher.fetch();
      const ycData = await ycFetcher.transform(ycRaw);
      console.log(`✅ YC Companies: ${ycData.length}`);
      
      const rssFetcher = new RSSAggregatorFetcher();
      const rssRaw = await rssFetcher.fetch();
      const rssData = await rssFetcher.transform(rssRaw);
      console.log(`✅ RSS Articles: ${rssData.length}\n`);
      
      // 2. Perform matching
      console.log('🔍 MATCHING COMPANIES TO NEWS...\n');
      
      const matches: MatchResult[] = [];
      const processedYC = new Set<string>();
      
      // Process first 100 YC companies for speed
      for (const ycCompany of ycData.slice(0, 100)) {
        for (const newsItem of rssData) {
          const match = this.matchItems(ycCompany, newsItem);
          
          if (match) {
            matches.push(match);
            processedYC.add(ycCompany.title);
          }
        }
      }
      
      // 3. Show results
      console.log('📊 MATCHING RESULTS:');
      console.log('=' .repeat(70));
      console.log(`\nTotal matches found: ${matches.length}`);
      console.log(`Unique companies with news: ${processedYC.size}\n`);
      
      if (matches.length > 0) {
        // Group by confidence
        const strongMatches = matches.filter(m => m.confidence >= 70);
        const mediumMatches = matches.filter(m => m.confidence >= 50 && m.confidence < 70);
        const weakMatches = matches.filter(m => m.confidence < 50);
        
        console.log(`Strong matches (70%+): ${strongMatches.length}`);
        console.log(`Medium matches (50-69%): ${mediumMatches.length}`);
        console.log(`Weak matches (<50%): ${weakMatches.length}\n`);
        
        // Show top matches
        console.log('🏆 TOP MATCHES:\n');
        
        matches
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10)
          .forEach((match, index) => {
            console.log(`${index + 1}. ${match.ycCompany.title} (${match.ycCompany.metadata?.yc_batch})`);
            console.log(`   News: "${match.newsItem.title.substring(0, 60)}..."`);
            console.log(`   Confidence: ${match.confidence}%`);
            console.log(`   Signals: ${match.signals.join(', ')}`);
            console.log('');
          });
      } else {
        console.log('⚠️  No matches found. This could mean:');
        console.log('   1. Current RSS feeds don\'t mention 2024 YC companies');
        console.log('   2. Matching criteria is too strict');
        console.log('   3. Need more diverse news sources');
      }
      
      // 4. Test for false positives
      console.log('🔬 FALSE POSITIVE CHECK:\n');
      
      // Create some fake company names that shouldn't match
      const fakeCompanies = [
        { title: 'XYZABC123', metadata: {} },
        { title: 'NoSuchCompany', metadata: {} },
        { title: 'FakeStartup2024', metadata: {} }
      ];
      
      let falsePositives = 0;
      for (const fake of fakeCompanies) {
        for (const news of rssData.slice(0, 20)) {
          const match = this.matchItems(fake as ContentItem, news);
          if (match) {
            falsePositives++;
            console.log(`❌ False positive: "${fake.title}" matched with "${news.title}"`);
          }
        }
      }
      
      if (falsePositives === 0) {
        console.log('✅ No false positives detected with fake companies');
      }
      
      // 5. Save best matches to database
      if (matches.length > 0) {
        console.log('\n💾 PREPARING DATABASE INSERTION...\n');
        
        // Get unique companies with highest confidence matches
        const uniqueCompanies = new Map<string, MatchResult>();
        
        for (const match of matches) {
          const key = match.ycCompany.title;
          const existing = uniqueCompanies.get(key);
          
          if (!existing || match.confidence > existing.confidence) {
            uniqueCompanies.set(key, match);
          }
        }
        
        // Prepare for insertion
        const topMatches = Array.from(uniqueCompanies.values())
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10);
        
        const insertData = topMatches.map(match => ({
          title: match.ycCompany.title,
          description: match.ycCompany.description.substring(0, 1000),
          url: match.ycCompany.url || `https://ycombinator.com/companies/${match.ycCompany.title.toLowerCase().replace(/\s+/g, '-')}`,
          source: 'YCombinator + News',
          type: 'project' as const,
          score: match.ycCompany.metadata?.accelerate_score || 70,
          confidence: match.confidence / 100,
          recommendation: match.confidence >= 70 ? 'feature' : 'approve',
          status: 'pending_review',
          metadata: {
            yc_batch: match.ycCompany.metadata?.yc_batch,
            match_confidence: match.confidence,
            match_signals: match.signals,
            news_title: match.newsItem.title,
            news_url: match.newsItem.url,
            verified_match: match.confidence >= 70
          },
          created_at: new Date().toISOString()
        }));
        
        console.log(`Ready to insert ${insertData.length} high-confidence matches`);
        
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
            .insert(newItems as any)
            .select('id, title');
          
          if (error) {
            console.log('❌ Database error:', error.message);
          } else if (data) {
            console.log(`\n✅ Inserted ${data.length} new matches to content_queue:`);
            data.forEach(d => console.log(`   - ${d.title}`));
          }
        } else {
          console.log('ℹ️  All matches already in database');
        }
      }
      
      // 6. Final summary
      console.log('\n' + '=' .repeat(70));
      console.log('📈 SUMMARY:');
      console.log(`Match Rate: ${(processedYC.size / Math.min(100, ycData.length) * 100).toFixed(1)}%`);
      console.log(`False Positive Rate: ${falsePositives > 0 ? 'FAILED' : 'PASSED'}`);
      console.log(`Data Quality: ${matches.length > 0 ? 'GOOD' : 'NEEDS MORE SOURCES'}`);
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
}

// Run the improved matcher
async function main() {
  console.log('Starting improved entity matching...\n');
  console.log('This version reduces false positives and improves accuracy\n');
  
  const matcher = new ImprovedMatcher();
  await matcher.runMatching();
  
  console.log('\n✅ Matching completed');
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});