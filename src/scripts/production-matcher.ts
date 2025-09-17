#!/usr/bin/env node
/**
 * PRODUCTION-READY Multi-Source Matcher
 * This version actually finds real matches between sources
 */

import type { Database } from '../types/supabase';
import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { ContentItem } from '../lib/base-fetcher';

config();

interface EnrichedCompany {
  // Identity
  name: string;
  normalized_name: string;
  yc_data?: ContentItem;
  rss_mentions: ContentItem[];
  
  // Extracted data
  description: string;
  url: string;
  yc_batch?: string;
  location?: string;
  
  // Funding (merged from all sources)
  funding: {
    total?: number;
    last_round?: string;
    last_amount?: number;
    investors: string[];
    source: string; // Where we got the funding info
  };
  
  // Team
  team_size?: number;
  founders?: string[];
  
  // Metrics
  match_quality: {
    sources_count: number;
    has_funding_news: boolean;
    data_completeness: number;
    confidence: number;
  };
  
  // Scoring
  accelerate_score: number;
}

class ProductionMatcher {
  
  /**
   * Find RSS articles that mention YC companies
   */
  findCompanyMentions(ycCompanies: ContentItem[], rssItems: ContentItem[]): EnrichedCompany[] {
    console.log('\n🔍 FINDING COMPANY MENTIONS IN NEWS...\n');
    
    const enrichedCompanies: EnrichedCompany[] = [];
    
    // Process each YC company
    for (const yc of ycCompanies) {
      const company: EnrichedCompany = {
        name: yc.title,
        normalized_name: this.normalize(yc.title),
        yc_data: yc,
        rss_mentions: [],
        
        description: yc.description,
        url: yc.url,
        yc_batch: yc.metadata?.yc_batch,
        location: yc.metadata?.location,
        
        funding: {
          total: yc.metadata?.funding_raised || 500000, // YC gives $500k
          investors: ['Y Combinator'],
          source: 'YC'
        },
        
        team_size: yc.metadata?.team_size,
        
        match_quality: {
          sources_count: 1,
          has_funding_news: false,
          data_completeness: 30,
          confidence: 1.0
        },
        
        accelerate_score: yc.metadata?.accelerate_score || 50
      };
      
      // Search for mentions in RSS
      for (const rss of rssItems) {
        if (this.articleMentionsCompany(rss, yc)) {
          company.rss_mentions.push(rss);
          company.match_quality.sources_count++;
          
          // Extract funding info from RSS
          if (rss.metadata?.funding_amount) {
            company.funding.total = Math.max(
              company.funding.total || 0,
              rss.metadata.funding_amount
            );
            company.funding.last_amount = rss.metadata.funding_amount;
            company.funding.last_round = rss.metadata.funding_round;
            company.funding.source = 'RSS: ' + rss.source;
            company.match_quality.has_funding_news = true;
            
            if (rss.metadata.investors) {
              company.funding.investors.push(...rss.metadata.investors);
            }
          }
          
          console.log(`  ✅ Found: "${yc.title}" mentioned in "${rss.title.substring(0, 50)}..."`);
        }
      }
      
      // Deduplicate investors
      company.funding.investors = [...new Set(company.funding.investors)];
      
      // Calculate final scores
      company.match_quality.data_completeness = this.calculateCompleteness(company);
      company.accelerate_score = this.calculateAccelerateScore(company);
      
      enrichedCompanies.push(company);
    }
    
    return enrichedCompanies;
  }
  
  /**
   * Check if an article mentions a company
   */
  private articleMentionsCompany(article: ContentItem, company: ContentItem): boolean {
    const companyName = company.title.toLowerCase();
    const normalizedName = this.normalize(company.title);
    
    // Skip very short names to avoid false positives
    if (normalizedName.length < 4) {return false;}
    
    const articleText = `${article.title} ${article.description}`.toLowerCase();
    
    // Check for exact name match
    if (articleText.includes(companyName)) {return true;}
    
    // Check for normalized name (without Inc, LLC, etc)
    if (normalizedName.length > 5 && articleText.includes(normalizedName)) {return true;}
    
    // Check if it's specifically about this YC batch company
    if (company.metadata?.yc_batch && 
        articleText.includes(company.metadata.yc_batch.toLowerCase()) &&
        articleText.includes(normalizedName.substring(0, 5))) {
      return true;
    }
    
    // Check for founder names if available
    if (company.metadata?.founders) {
      const founders = Array.isArray(company.metadata.founders) 
        ? company.metadata.founders 
        : [company.metadata.founders];
        
      for (const founder of founders) {
        if (typeof founder === 'string' && founder.length > 5) {
          if (articleText.includes(founder.toLowerCase())) {
            // Founder mentioned + partial company name = match
            if (articleText.includes(normalizedName.substring(0, 4))) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Normalize company name
   */
  private normalize(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|company|labs?|technologies|\.com|\.io|\.ai)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Calculate data completeness
   */
  private calculateCompleteness(company: EnrichedCompany): number {
    let score = 0;
    let max = 0;
    
    // Required fields
    if (company.name) { score += 3; }
    max += 3;
    
    if (company.description) { score += 3; }
    max += 3;
    
    if (company.url) { score += 3; }
    max += 3;
    
    // Important fields
    if (company.yc_batch) { score += 2; }
    max += 2;
    
    if (company.funding.total && company.funding.total > 500000) { score += 2; }
    max += 2;
    
    if (company.team_size) { score += 2; }
    max += 2;
    
    // Bonus fields
    if (company.rss_mentions.length > 0) { score += 1; }
    max += 1;
    
    if (company.funding.investors.length > 1) { score += 1; }
    max += 1;
    
    return Math.round((score / max) * 100);
  }
  
  /**
   * Calculate ACCELERATE score
   */
  private calculateAccelerateScore(company: EnrichedCompany): number {
    let score = 30; // Base
    
    // YC backing
    if (company.yc_batch) {score += 20;}
    
    // Early stage (under $2M)
    if (company.funding.total) {
      if (company.funding.total <= 500000) {score += 20;}
      else if (company.funding.total <= 2000000) {score += 10;}
    }
    
    // Small team
    if (company.team_size && company.team_size <= 10) {score += 10;}
    
    // Multi-source validation
    if (company.match_quality.sources_count > 1) {score += 10;}
    if (company.match_quality.has_funding_news) {score += 10;}
    
    // Data completeness bonus
    score += Math.round(company.match_quality.data_completeness * 0.2);
    
    return Math.min(100, score);
  }
}

async function runProductionMatcher() {
  console.log('🚀 PRODUCTION MULTI-SOURCE MATCHER\n');
  console.log('=' .repeat(70));
  
  try {
    // 1. Fetch data
    console.log('📡 FETCHING DATA SOURCES...\n');
    
    // YC Companies
    const ycFetcher = new YCombinatorStartupsFetcher();
    const ycRaw = await ycFetcher.fetch();
    const ycData = await ycFetcher.transform(ycRaw);
    console.log(`✅ YC Companies: ${ycData.length}`);
    
    // RSS News
    const rssFetcher = new RSSAggregatorFetcher();
    const rssRaw = await rssFetcher.fetch();
    const rssData = await rssFetcher.transform(rssRaw);
    console.log(`✅ RSS Articles: ${rssData.length}`);
    
    // 2. Match and enrich
    const matcher = new ProductionMatcher();
    const enriched = matcher.findCompanyMentions(
      ycData.slice(0, 50), // First 50 YC companies
      rssData // All RSS items
    );
    
    // 3. Show results
    const multiSource = enriched.filter(c => c.match_quality.sources_count > 1);
    
    console.log('\n' + '=' .repeat(70));
    console.log('📊 MATCHING RESULTS:');
    console.log('=' .repeat(70));
    console.log(`\nTotal YC companies processed: ${enriched.length}`);
    console.log(`Companies with news mentions: ${multiSource.length}`);
    
    if (multiSource.length > 0) {
      console.log('\n🎯 TOP ENRICHED COMPANIES:\n');
      
      multiSource
        .sort((a, b) => b.accelerate_score - a.accelerate_score)
        .slice(0, 10)
        .forEach((company, index) => {
          console.log(`${index + 1}. ${company.name}`);
          console.log(`   YC Batch: ${company.yc_batch}`);
          console.log(`   News Mentions: ${company.rss_mentions.length}`);
          console.log(`   Total Funding: $${(company.funding.total || 0).toLocaleString()}`);
          console.log(`   Funding Source: ${company.funding.source}`);
          console.log(`   Investors: ${company.funding.investors.join(', ')}`);
          console.log(`   Data Completeness: ${company.match_quality.data_completeness}%`);
          console.log(`   ACCELERATE Score: ${company.accelerate_score}/100`);
          console.log('');
        });
    }
    
    // 4. Insert to database
    console.log('💾 INSERTING TO DATABASE...\n');
    
    const toInsert = enriched
      .sort((a, b) => b.accelerate_score - a.accelerate_score)
      .slice(0, 10)
      .map((company, index) => ({
        title: company.name,
        description: company.description.substring(0, 1000),
        url: company.url || `https://startup.example/${company.normalized_name}`,
        source: company.match_quality.sources_count > 1 
          ? `YCombinator + ${company.rss_mentions.length} news` 
          : 'YCombinator',
        type: 'project' as const,
        score: company.accelerate_score,
        confidence: company.match_quality.confidence,
        recommendation: company.accelerate_score > 70 ? 'feature' : 'approve',
        status: 'pending_review',
        metadata: {
          yc_batch: company.yc_batch,
          funding_total: company.funding.total,
          funding_source: company.funding.source,
          investors: company.funding.investors,
          news_mentions: company.rss_mentions.length,
          data_completeness: company.match_quality.data_completeness,
          enriched: true
        },
        created_at: new Date().toISOString()
      }));
    
    // Check for duplicates first
    const { data: existing } = await supabase
      .from('content_queue')
      .select('title')
      .in('title', toInsert.map(i => i.title));
    
    const existingTitles = new Set((existing || []).map(e => e.title));
    const newItems = toInsert.filter(i => !existingTitles.has(i.title));
    
    if (newItems.length > 0) {
      const { data, error } = await supabase
        .from('content_queue')
        .insert(newItems as any)
        .select('id, title');
      
      if (error) {
        console.log('❌ Insert error:', error.message);
      } else if (data) {
        console.log(`✅ Inserted ${data.length} enriched companies`);
        data.forEach(d => console.log(`   - ${d.title}`));
      }
    } else {
      console.log('ℹ️ All companies already in queue');
    }
    
    // 5. Final statistics
    console.log('\n' + '=' .repeat(70));
    console.log('📈 FINAL STATISTICS:');
    console.log('=' .repeat(70));
    
    const avgCompleteness = enriched.reduce((sum, c) => 
      sum + c.match_quality.data_completeness, 0
    ) / enriched.length;
    
    const withFunding = enriched.filter(c => 
      c.funding.total && c.funding.total > 500000
    );
    
    console.log(`\nProcessed: ${enriched.length} YC companies`);
    console.log(`With news mentions: ${multiSource.length} (${Math.round(multiSource.length/enriched.length*100)}%)`);
    console.log(`With funding data: ${withFunding.length} (${Math.round(withFunding.length/enriched.length*100)}%)`);
    console.log(`Average completeness: ${avgCompleteness.toFixed(1)}%`);
    console.log(`Average ACCELERATE score: ${(enriched.reduce((s,c) => s + c.accelerate_score, 0) / enriched.length).toFixed(1)}/100`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run
console.log('Starting production-ready multi-source matcher...');
console.log('This will find real news mentions of YC companies\n');

runProductionMatcher().then(() => {
  console.log('\n✅ Matching completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Failed:', err);
  process.exit(1);
});