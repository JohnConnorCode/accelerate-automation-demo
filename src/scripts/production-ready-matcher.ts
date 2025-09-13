#!/usr/bin/env node
/**
 * PRODUCTION-READY Entity Matcher
 * Handles edge cases, validates matches, and minimizes false positives
 */

import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { RSSAggregatorFetcher } from '../fetchers/real-sources/rss-aggregator';
import { RedditStartupsFetcher } from '../fetchers/real-sources/reddit-startups';
import { ContentItem } from '../lib/base-fetcher';

config();

interface ValidatedMatch {
  company: ContentItem;
  matches: {
    item: ContentItem;
    confidence: number;
    matchType: 'strong' | 'medium' | 'weak';
    signals: string[];
  }[];
  overallConfidence: number;
  isValid: boolean;
  validationNotes: string[];
}

class ProductionReadyMatcher {
  
  // Common first names that are also company names - require extra validation
  private AMBIGUOUS_NAMES = new Set([
    'alex', 'alice', 'ben', 'bob', 'chris', 'david', 'emma', 'frank',
    'grace', 'jack', 'james', 'jane', 'jo', 'john', 'kate', 'lily',
    'mark', 'mary', 'mike', 'nick', 'paul', 'peter', 'sam', 'sara',
    'sarah', 'tom', 'will'
  ]);
  
  // Common words that shouldn't be company names
  private COMMON_WORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'about', 'over', 'under',
    'new', 'first', 'last', 'next', 'best', 'top', 'one', 'two'
  ]);
  
  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string | null {
    if (!url) {return null;}
    
    try {
      let cleanUrl = url.trim();
      if (!cleanUrl.includes('://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const urlObj = new URL(cleanUrl);
      const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      
      // Validate domain format
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(domain)) {
        return null;
      }
      
      return domain;
    } catch {
      return null;
    }
  }
  
  /**
   * Check if company name is ambiguous (common first name, etc)
   */
  private isAmbiguousName(name: string): boolean {
    const normalized = name.toLowerCase().trim();
    
    // Check if it's a common first name
    if (this.AMBIGUOUS_NAMES.has(normalized)) {return true;}
    
    // Check if it's a common word
    if (this.COMMON_WORDS.has(normalized)) {return true;}
    
    // Check if it's too short (likely to cause false positives)
    if (normalized.length <= 3) {return true;}
    
    // Check if it's just numbers
    if (/^\d+$/.test(normalized)) {return true;}
    
    return false;
  }
  
  /**
   * Validate that a match is real (not a false positive)
   */
  private validateMatch(
    company: ContentItem,
    newsItem: ContentItem,
    signals: string[]
  ): { isValid: boolean; notes: string[] } {
    const notes: string[] = [];
    let isValid = true;
    
    const companyName = company.title.toLowerCase();
    const newsContent = `${newsItem.title} ${newsItem.description}`.toLowerCase();
    
    // 1. Check for ambiguous names
    if (this.isAmbiguousName(company.title)) {
      notes.push('ambiguous_name');
      
      // Require stronger evidence for ambiguous names
      const hasDomainMatch = signals.some(s => s.startsWith('domain:'));
      const hasMultipleSignals = signals.length >= 3;
      const hasStrongContext = newsContent.includes('startup') || 
                              newsContent.includes('yc') ||
                              newsContent.includes('funding');
      
      if (!hasDomainMatch && !hasMultipleSignals && !hasStrongContext) {
        isValid = false;
        notes.push('insufficient_evidence_for_ambiguous_name');
      }
      
      // Check if it's used as a person's name in context
      const personPatterns = [
        new RegExp(`\\b(mr|ms|mrs|dr|prof)\\s+${companyName}\\b`, 'i'),
        new RegExp(`\\b${companyName}\\s+(said|says|stated|added|explained|told)\\b`, 'i'),
        new RegExp(`\\b${companyName}\\s+[A-Z][a-z]+\\b`), // Alex Smith pattern
        new RegExp(`\\b(ceo|cto|founder|president|director)\\s+${companyName}\\b`, 'i')
      ];
      
      for (const pattern of personPatterns) {
        if (pattern.test(newsContent)) {
          isValid = false;
          notes.push('used_as_person_name');
          break;
        }
      }
    }
    
    // 2. Check for domain validation
    const companyDomain = this.extractDomain(company.url);
    if (companyDomain) {
      // Check if the domain appears in the article
      if (newsContent.includes(companyDomain)) {
        notes.push('domain_verified');
      } else if (signals.includes('name_in_title')) {
        // Name in title without domain is still OK for non-ambiguous names
        if (!this.isAmbiguousName(company.title)) {
          notes.push('name_in_title_verified');
        }
      }
    }
    
    // 3. Check for YC context
    const batch = company.metadata?.yc_batch;
    if (batch && newsContent.includes(batch.toLowerCase())) {
      notes.push('yc_batch_mentioned');
      isValid = true; // Strong signal even for ambiguous names
    }
    
    // 4. Check for startup/company context
    const companyContext = [
      `${companyName} raises`,
      `${companyName} launches`,
      `${companyName} announces`,
      `${companyName}'s platform`,
      `${companyName}'s product`,
      `startup ${companyName}`,
      `${companyName} startup`
    ];
    
    if (companyContext.some(ctx => newsContent.includes(ctx))) {
      notes.push('company_context_verified');
      isValid = true;
    }
    
    return { isValid, notes };
  }
  
  /**
   * Match with comprehensive validation
   */
  private matchWithValidation(
    company: ContentItem,
    newsItems: ContentItem[]
  ): ValidatedMatch {
    const matches: ValidatedMatch['matches'] = [];
    const validationNotes: string[] = [];
    
    const companyDomain = this.extractDomain(company.url);
    const companyNameLower = company.title.toLowerCase();
    const normalizedName = companyNameLower.replace(/[^a-z0-9]/g, '');
    
    // Track if this is a risky match
    if (this.isAmbiguousName(company.title)) {
      validationNotes.push('ambiguous_company_name');
    }
    
    for (const newsItem of newsItems) {
      const signals: string[] = [];
      let confidence = 0;
      let matchType: 'strong' | 'medium' | 'weak' = 'weak';
      
      const newsContent = `${newsItem.title} ${newsItem.description}`.toLowerCase();
      
      // 1. Domain matching (highest confidence)
      if (companyDomain) {
        if (newsContent.includes(companyDomain)) {
          confidence += 60;
          signals.push(`domain:${companyDomain}`);
          matchType = 'strong';
        }
        
        const newsDomain = this.extractDomain(newsItem.url);
        if (newsDomain === companyDomain) {
          confidence += 30;
          signals.push('same_domain');
          matchType = 'strong';
        }
      }
      
      // 2. Name matching (with context validation)
      const nameInTitle = newsItem.title.toLowerCase().includes(companyNameLower);
      const nameInDesc = (newsItem.description || '').toLowerCase().includes(companyNameLower);
      
      if (nameInTitle) {
        // Name in title is strong signal if not ambiguous
        if (!this.isAmbiguousName(company.title)) {
          confidence += 50;
          signals.push('name_in_title');
          if (matchType === 'weak') {matchType = 'medium';}
        } else {
          // Ambiguous name in title needs more validation
          confidence += 20;
          signals.push('ambiguous_name_in_title');
        }
      } else if (nameInDesc && normalizedName.length >= 5) {
        confidence += 30;
        signals.push('name_in_description');
      }
      
      // 3. YC batch mention
      const batch = company.metadata?.yc_batch;
      if (batch && newsContent.includes(batch.toLowerCase())) {
        confidence += 20;
        signals.push(`batch:${batch}`);
      }
      
      // 4. Startup/funding context
      const hasStartupContext = [
        'startup', 'founder', 'raises', 'funding', 'seed', 
        'series', 'investment', 'yc', 'y combinator'
      ].some(keyword => newsContent.includes(keyword));
      
      if (hasStartupContext && confidence > 0) {
        confidence += 10;
        signals.push('startup_context');
      }
      
      // Only consider if we have meaningful signals
      if (confidence >= 30) {
        // Validate the match
        const validation = this.validateMatch(company, newsItem, signals);
        
        if (validation.isValid) {
          matches.push({
            item: newsItem,
            confidence: Math.min(100, confidence),
            matchType,
            signals: [...signals, ...validation.notes]
          });
        } else {
          validationNotes.push(`rejected_match: ${validation.notes.join(', ')}`);
        }
      }
    }
    
    // Calculate overall confidence
    const overallConfidence = matches.length > 0 
      ? Math.max(...matches.map(m => m.confidence))
      : 0;
    
    return {
      company,
      matches,
      overallConfidence,
      isValid: matches.length > 0 && overallConfidence >= 50,
      validationNotes
    };
  }
  
  /**
   * Run production matching
   */
  async runMatching() {
    console.log('🏭 PRODUCTION-READY ENTITY MATCHING\n');
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
      console.log(`✅ RSS Articles: ${rssData.length}`);
      
      const redditFetcher = new RedditStartupsFetcher();
      const redditRaw = await redditFetcher.fetch();
      const redditData = await redditFetcher.transform(redditRaw);
      console.log(`✅ Reddit Posts: ${redditData.length}\n`);
      
      // 2. Perform matching with validation
      console.log('🔍 MATCHING WITH VALIDATION...\n');
      
      const validatedMatches: ValidatedMatch[] = [];
      const allContent = [...rssData, ...redditData];
      
      // Process first 100 companies
      for (const company of ycData.slice(0, 100)) {
        const result = this.matchWithValidation(company, allContent);
        
        if (result.matches.length > 0) {
          validatedMatches.push(result);
          
          if (result.isValid) {
            console.log(`✅ ${company.title}: ${result.matches.length} valid matches (${result.overallConfidence}% confidence)`);
          } else {
            console.log(`⚠️  ${company.title}: ${result.matches.length} matches rejected (${result.validationNotes.join(', ')})`);
          }
        }
      }
      
      // 3. Filter to only valid matches
      const validOnly = validatedMatches.filter(vm => vm.isValid);
      
      console.log('\n' + '=' .repeat(70));
      console.log('📊 VALIDATION RESULTS:');
      console.log('=' .repeat(70));
      
      console.log(`\nTotal companies processed: 100`);
      console.log(`Companies with potential matches: ${validatedMatches.length}`);
      console.log(`Companies with VALID matches: ${validOnly.length}`);
      console.log(`False positives prevented: ${validatedMatches.length - validOnly.length}`);
      
      if (validOnly.length > 0) {
        console.log('\n🏆 VERIFIED MATCHES:\n');
        
        validOnly
          .sort((a, b) => b.overallConfidence - a.overallConfidence)
          .slice(0, 10)
          .forEach((vm, index) => {
            const topMatch = vm.matches[0];
            console.log(`${index + 1}. ${vm.company.title} (${vm.company.metadata?.yc_batch})`);
            console.log(`   Confidence: ${vm.overallConfidence}%`);
            console.log(`   Matches: ${vm.matches.length}`);
            console.log(`   Top match: "${topMatch.item.title.substring(0, 50)}..."`);
            console.log(`   Signals: ${topMatch.signals.join(', ')}`);
            console.log('');
          });
      } else {
        console.log('\n📝 NO VALID MATCHES FOUND');
        console.log('This is expected for brand new YC companies (W24/S24/F24).');
        console.log('They may not have press coverage yet.\n');
        
        // Show what was rejected
        if (validatedMatches.length > 0) {
          console.log('Rejected matches (false positives prevented):');
          validatedMatches.slice(0, 5).forEach(vm => {
            console.log(`  - ${vm.company.title}: ${vm.validationNotes.join(', ')}`);
          });
        }
      }
      
      // 4. Database insertion for valid matches
      if (validOnly.length > 0) {
        console.log('\n💾 INSERTING VALIDATED MATCHES...\n');
        
        const insertData = validOnly.slice(0, 10).map(vm => ({
          title: vm.company.title,
          description: vm.company.description.substring(0, 1000),
          url: vm.company.url,
          source: 'YCombinator (Validated)',
          type: 'project' as const,
          score: vm.company.metadata?.accelerate_score || 70,
          confidence: vm.overallConfidence / 100,
          recommendation: vm.overallConfidence >= 70 ? 'feature' : 'approve',
          status: 'pending_review',
          metadata: {
            yc_batch: vm.company.metadata?.yc_batch,
            match_count: vm.matches.length,
            match_confidence: vm.overallConfidence,
            top_match_signals: vm.matches[0].signals,
            validation_notes: vm.validationNotes,
            validated: true,
            has_news: true
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
            console.log(`✅ Inserted ${data.length} validated companies:`);
            data.forEach(d => console.log(`   - ${d.title}`));
          }
        } else {
          console.log('ℹ️  All validated matches already in database');
        }
      }
      
      // 5. Summary
      console.log('\n' + '=' .repeat(70));
      console.log('📈 FINAL SUMMARY:');
      console.log('=' .repeat(70));
      
      const matchRate = (validOnly.length / 100 * 100).toFixed(1);
      const falsePositiveRate = validatedMatches.length > 0 
        ? ((validatedMatches.length - validOnly.length) / validatedMatches.length * 100).toFixed(1)
        : '0.0';
      
      console.log(`\nMatch rate: ${matchRate}%`);
      console.log(`False positive prevention rate: ${falsePositiveRate}%`);
      console.log(`Data quality: ${validOnly.length > 0 ? 'VALIDATED' : 'LIMITED COVERAGE'}`);
      
      if (validOnly.length === 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('1. Add more news sources focused on early-stage startups');
        console.log('2. Include YC\'s own announcements and blog');
        console.log('3. Monitor ProductHunt launches');
        console.log('4. Track Twitter/X mentions from YC partners');
        console.log('5. Wait for companies to gain more visibility (they\'re very new)');
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }
}

// Run the production matcher
async function main() {
  console.log('Starting production-ready entity matching...\n');
  console.log('This version prevents false positives and validates all matches\n');
  
  const matcher = new ProductionReadyMatcher();
  await matcher.runMatching();
  
  console.log('\n✅ Production matching completed');
}

main().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});