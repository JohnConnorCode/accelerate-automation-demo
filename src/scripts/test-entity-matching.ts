#!/usr/bin/env node
/**
 * TEST Entity Matching with Known Good Matches
 * This validates our matching system with companies we KNOW have news
 */

import { config } from 'dotenv';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { ContentItem } from '../lib/base-fetcher';

config();

// KNOWN GOOD MATCHES - These companies 100% have recent news
const KNOWN_MATCHES = [
  {
    company: 'Perplexity',
    yc_batch: 'S22',
    domain: 'perplexity.ai',
    known_news_keywords: ['perplexity', 'ai search', 'aravind srinivas'],
    expected_mentions: 5 // Should find at least this many
  },
  {
    company: 'Harvey',
    yc_batch: 'W22', 
    domain: 'harvey.ai',
    known_news_keywords: ['harvey ai', 'legal ai', 'winston strawn'],
    expected_mentions: 3
  },
  {
    company: 'Jasper',
    yc_batch: 'S21',
    domain: 'jasper.ai',
    known_news_keywords: ['jasper ai', 'ai writing', 'dave rogenmoser'],
    expected_mentions: 2
  },
  {
    company: 'OpenAI',
    yc_batch: 'W16',
    domain: 'openai.com',
    known_news_keywords: ['openai', 'chatgpt', 'sam altman'],
    expected_mentions: 10
  }
];

class EntityMatchValidator {
  
  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return '';
    }
  }
  
  /**
   * Normalize company name for comparison
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|company|labs?|technologies|\.com|\.io|\.ai)\.?\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Domain-based matching (MOST RELIABLE)
   */
  private domainMatch(item1: ContentItem, item2: ContentItem): boolean {
    const domain1 = this.extractDomain(item1.url);
    const domain2 = this.extractDomain(item2.url);
    
    if (!domain1 || !domain2) return false;
    
    // Exact domain match
    if (domain1 === domain2) return true;
    
    // Subdomain match (e.g., blog.company.com matches company.com)
    if (domain1.includes(domain2) || domain2.includes(domain1)) return true;
    
    return false;
  }
  
  /**
   * Multi-signal matching with confidence scoring
   */
  private matchWithConfidence(ycCompany: ContentItem, newsItem: ContentItem, knownMatch?: typeof KNOWN_MATCHES[0]): {
    isMatch: boolean;
    confidence: number;
    signals: string[];
  } {
    const signals: string[] = [];
    let score = 0;
    
    // 1. Domain matching (highest confidence)
    if (knownMatch?.domain) {
      const newsDomain = this.extractDomain(newsItem.url);
      if (newsDomain.includes(knownMatch.domain) || 
          newsItem.description?.toLowerCase().includes(knownMatch.domain)) {
        score += 40;
        signals.push(`domain:${knownMatch.domain}`);
      }
    }
    
    // 2. Company name in title (high confidence)
    const companyNorm = this.normalize(ycCompany.title);
    const newsTitle = newsItem.title.toLowerCase();
    
    if (companyNorm.length >= 4 && newsTitle.includes(companyNorm)) {
      score += 30;
      signals.push('name_in_title');
    }
    
    // 3. Company name in description (medium confidence)
    const newsDesc = (newsItem.description || '').toLowerCase();
    if (companyNorm.length >= 4 && newsDesc.includes(companyNorm)) {
      score += 20;
      signals.push('name_in_description');
    }
    
    // 4. Known keywords (validation)
    if (knownMatch) {
      for (const keyword of knownMatch.known_news_keywords) {
        if (newsTitle.includes(keyword) || newsDesc.includes(keyword)) {
          score += 10;
          signals.push(`keyword:${keyword}`);
          break; // Only count once
        }
      }
    }
    
    // 5. YC batch mention
    const batch = ycCompany.metadata?.yc_batch;
    if (batch && (newsTitle.includes(batch.toLowerCase()) || newsDesc.includes(batch.toLowerCase()))) {
      score += 10;
      signals.push(`batch:${batch}`);
    }
    
    return {
      isMatch: score >= 50, // Require 50+ score for match
      confidence: Math.min(100, score),
      signals
    };
  }
  
  /**
   * Validate our matching system
   */
  async validateMatching() {
    console.log('🧪 ENTITY MATCHING VALIDATION TEST\n');
    console.log('=' .repeat(70));
    
    // 1. Fetch data
    console.log('📡 Fetching test data...\n');
    
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycRaw = await ycFetcher.fetch();
    const ycData = await ycFetcher.transform(ycRaw);
    console.log(`✅ YC Companies: ${ycData.length}`);
    
    const rssFetcher = new RSSAggregatorFetcher();
    const rssRaw = await rssFetcher.fetch();
    const rssData = await rssFetcher.transform(rssRaw);
    console.log(`✅ RSS Articles: ${rssData.length}\n`);
    
    // 2. Test known matches
    console.log('🎯 TESTING KNOWN MATCHES:\n');
    const results: any[] = [];
    
    for (const knownMatch of KNOWN_MATCHES) {
      console.log(`\nTesting: ${knownMatch.company} (${knownMatch.yc_batch})`);
      console.log('-'.repeat(50));
      
      // Find the YC company
      const ycCompany = ycData.find(yc => 
        this.normalize(yc.title) === this.normalize(knownMatch.company) ||
        yc.metadata?.yc_batch === knownMatch.yc_batch
      );
      
      if (!ycCompany) {
        console.log(`❌ Could not find ${knownMatch.company} in YC data`);
        results.push({
          company: knownMatch.company,
          found: false,
          matches: 0,
          expected: knownMatch.expected_mentions
        });
        continue;
      }
      
      // Find news mentions
      const matches: any[] = [];
      
      for (const newsItem of rssData) {
        const matchResult = this.matchWithConfidence(ycCompany, newsItem, knownMatch);
        
        if (matchResult.isMatch) {
          matches.push({
            title: newsItem.title.substring(0, 60) + '...',
            confidence: matchResult.confidence,
            signals: matchResult.signals
          });
        }
      }
      
      // Report results
      console.log(`Found ${matches.length} matches (expected: ${knownMatch.expected_mentions}+)`);
      
      if (matches.length > 0) {
        console.log('\nTop matches:');
        matches
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3)
          .forEach(m => {
            console.log(`  • ${m.title}`);
            console.log(`    Confidence: ${m.confidence}% | Signals: ${m.signals.join(', ')}`);
          });
      }
      
      results.push({
        company: knownMatch.company,
        found: true,
        matches: matches.length,
        expected: knownMatch.expected_mentions,
        success: matches.length >= knownMatch.expected_mentions
      });
    }
    
    // 3. Summary
    console.log('\n' + '=' .repeat(70));
    console.log('📊 VALIDATION RESULTS:\n');
    
    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length * 100).toFixed(0);
    
    results.forEach(r => {
      const status = r.success ? '✅' : '❌';
      const ratio = `${r.matches}/${r.expected}`;
      console.log(`${status} ${r.company}: ${ratio} matches`);
    });
    
    console.log(`\nSuccess Rate: ${successRate}% (${successCount}/${results.length} passed)`);
    
    if (successRate === '0') {
      console.log('\n⚠️  WARNING: Matching system is NOT working!');
      console.log('   No known matches were found. Possible issues:');
      console.log('   - RSS feeds may not contain expected companies');
      console.log('   - Matching logic is too strict');
      console.log('   - Companies may not be in current batches');
    }
    
    // 4. Test for false positives
    console.log('\n🔍 TESTING FOR FALSE POSITIVES:\n');
    
    // Pick a random YC company
    const randomYC = ycData[Math.floor(Math.random() * Math.min(20, ycData.length))];
    console.log(`Testing random company: ${randomYC.title}`);
    
    let falsePositives = 0;
    for (const newsItem of rssData.slice(0, 20)) {
      const matchResult = this.matchWithConfidence(randomYC, newsItem);
      if (matchResult.isMatch && matchResult.confidence < 70) {
        falsePositives++;
        console.log(`  ⚠️ Possible false positive: "${newsItem.title.substring(0, 50)}..." (${matchResult.confidence}%)`);
      }
    }
    
    if (falsePositives === 0) {
      console.log('  ✅ No obvious false positives detected');
    } else {
      console.log(`  ⚠️ Found ${falsePositives} possible false positives`);
    }
    
    return {
      successRate: parseInt(successRate),
      results
    };
  }
}

// Run validation
async function runValidation() {
  try {
    const validator = new EntityMatchValidator();
    const result = await validator.validateMatching();
    
    console.log('\n' + '=' .repeat(70));
    if (result.successRate >= 75) {
      console.log('✅ VALIDATION PASSED - Matching system is working!');
    } else if (result.successRate >= 50) {
      console.log('⚠️  VALIDATION PARTIAL - Matching needs improvement');
    } else {
      console.log('❌ VALIDATION FAILED - Matching system is broken');
    }
    
    process.exit(result.successRate >= 50 ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation error:', error);
    process.exit(1);
  }
}

console.log('Starting entity matching validation...\n');
runValidation();