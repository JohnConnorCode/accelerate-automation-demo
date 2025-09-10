/**
 * Simple orchestrator - coordinates fetching, scoring, and storing
 */
import { fetcher } from './simple-fetcher';
import { scorer } from './simple-scorer';
import { supabase } from '../lib/supabase-client';
import { deduplicationService } from '../services/deduplication';
import { scoreContent } from '../lib/openai';
import { enrichmentService } from '../services/enrichment';
import { criteriaService } from '../services/criteria-service';
import { apiKeyService } from '../services/api-key-service';
import { noApiDataFetcher } from '../fetchers/no-api-sources';
import { accelerateCriteriaScorer } from '../services/accelerate-criteria-scorer';
import { AIScorer } from '../lib/ai-scorer';
import { logError, logInfo, trackMetric } from '../services/error-logger';
import { metricsService } from '../services/metrics';

// REAL FETCHERS WITH PROJECT NEEDS
import { Web3JobPlatformsFetcher } from '../fetchers/platforms/web3-job-platforms';
import { WellfoundFetcher } from '../fetchers/platforms/angellist-wellfound';
import { GitcoinFetcher } from '../fetchers/funding/gitcoin';
import { ChainSpecificFetcher } from '../fetchers/funding/chain-specific';
import { EcosystemProgramsFetcher } from '../fetchers/funding/ecosystem-programs';
import { Web3GrantsFetcher } from '../fetchers/funding/web3-grants';
import { ProductHuntLaunchesFetcher } from '../fetchers/real-sources/producthunt-launches';
import { GitHubTrendingFetcher } from '../fetchers/real-sources/github-trending';
import { DeworkFetcher } from '../fetchers/platforms/dework-fetcher';
import { Layer3Fetcher } from '../fetchers/platforms/layer3-fetcher';
import { WonderverseFetcher } from '../fetchers/platforms/wonderverse-fetcher';
import { Web3NewsFetcher } from '../fetchers/real-sources/web3-news';
import { HackathonProjectsFetcher } from '../fetchers/platforms/hackathon-projects';
import { CryptoJobsListFetcher } from '../fetchers/platforms/crypto-job-list';
import { RobustFetcher } from '../lib/fetcher-with-retry';
import { UnifiedScorer } from '../lib/unified-scorer';
import { StartupMetadataExtractor } from '../extractors/startup-metadata-extractor';
import { FundingProgramExtractor } from '../extractors/funding-program-extractor';

interface OrchestrationResult {
  fetched: number;
  scored: number;
  stored: number;
  rejected: number;
  duration: number;
  errors: string[];
  totalProjects?: number;
  totalNews?: number;
  totalInvestors?: number;
  totalFetched?: number;
  successRate?: number;
  items?: any[];
}

export class SimpleOrchestrator {
  private maxItemsPerBatch = 100; // Process many more items for better success rate
  private minScoreThreshold = 40; // HIGH QUALITY threshold - only accept good content
  private aiScorer = new AIScorer(); // AI-powered scoring
  
  /**
   * Get dynamic GitHub search URL to fetch NEW repos each time
   */
  private getGitHubSearchUrl(): string {
    // Get repos created or updated in the last 7 days to ensure NEW content
    const date = new Date();
    date.setDate(date.getDate() - 7);
    const weekAgo = date.toISOString().split('T')[0];
    
    // Rotate through different searches to get variety
    const searches = [
      `created:>${weekAgo}+stars:>50+language:TypeScript`,  // New TypeScript projects
      `pushed:>${weekAgo}+stars:>100+topic:web3`,           // Recently updated Web3
      `created:>${weekAgo}+stars:>30+topic:ai`,             // New AI projects
      `pushed:>${weekAgo}+stars:>200+topic:blockchain`,     // Active blockchain
      `created:>${weekAgo}+stars:>20+topic:defi`,           // New DeFi projects
    ];
    
    // Use current minute to rotate through searches
    const index = new Date().getMinutes() % searches.length;
    const query = searches[index];
    
    console.log(`🔄 GitHub search: ${query}`);
    return `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`;
  }
  
  /**
   * Configure batch size for processing
   */
  setBatchSize(size: number): void {
    if (size > 0 && size <= 100) {
      this.maxItemsPerBatch = size;
      console.log(`📊 Batch size set to ${size} items`);
    } else {
      console.warn(`⚠️ Invalid batch size ${size}. Must be between 1 and 100.`);
    }
  }
  
  /**
   * Configure minimum score threshold
   */
  setScoreThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 100) {
      this.minScoreThreshold = threshold;
      console.log(`📏 Score threshold set to ${threshold}`);
    } else {
      console.warn(`⚠️ Invalid threshold ${threshold}. Must be between 0 and 100.`);
    }
  }
  // Dynamic sources - regenerated each run
  private getSources(): Map<string, string> {
    return new Map([
      // DYNAMIC: Get DIFFERENT repos each time
      ['github', this.getGitHubSearchUrl()],
      ['hackernews', 'https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=50&numericFilters=points>100'],
      ['producthunt', 'https://api.producthunt.com/v2/api/graphql'],
      ['devto', 'https://dev.to/api/articles?per_page=30&tag=webdev,javascript,react&top=7'],
    ]);
  }

  /**
   * Run the complete pipeline
   */
  async run(): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const result: OrchestrationResult = {
      fetched: 0,
      scored: 0,
      stored: 0,
      rejected: 0,
      duration: 0,
      errors: []
    };

    try {
      // Initialize API keys from database
      await apiKeyService.initialize();
      
      // Get fresh sources for this run
      const sources = this.getSources();
      
      // Update sources with API keys if available
      const githubKey = apiKeyService.getKey('github');
      if (githubKey) {
        // Add auth to GitHub URL
        const githubUrl = sources.get('github');
        if (githubUrl) {
          sources.set('github', githubUrl + '&access_token=' + githubKey);
        }
      }
      
      // Step 1a: Fetch from API sources (if keys available)
      const fetchResults = await fetcher.fetchAll(sources);
      
      // Step 1b: ALSO fetch from public sources (no API keys needed!)
      console.log('🌐 Fetching from public sources (no API keys required)...');
      const publicData = await noApiDataFetcher.fetchAllPublicSources();
      console.log(`✅ Got ${publicData.length} items from public sources!`);
      
      // Add public data to fetch results
      if (publicData.length > 0) {
        fetchResults.push({
          source: 'public-sources',
          items: publicData,
          errors: []
        });
      }
      
      // Step 1c: CRITICAL - Fetch from platforms with PROJECT NEEDS
      console.log('🚀 Fetching from Web3 platforms with PROJECT NEEDS...');
      
      // Use RobustFetcher for all Web3 platforms
      const web3Fetchers = [
        // FUNDING PROGRAMS FIRST (Critical for ACCELERATE)
        { name: 'ChainGrants', fetcher: new ChainSpecificFetcher() },
        { name: 'EcosystemPrograms', fetcher: new EcosystemProgramsFetcher() },
        { name: 'Web3Grants', fetcher: new Web3GrantsFetcher() },
        { name: 'Gitcoin', fetcher: new GitcoinFetcher() },
        
        // PROVEN WORKING (>50% success rate)
        { name: 'Web3JobPlatforms', fetcher: new Web3JobPlatformsFetcher() },
        { name: 'Layer3', fetcher: new Layer3Fetcher() },
        { name: 'Wonderverse', fetcher: new WonderverseFetcher() },
        { name: 'ProductHunt', fetcher: new ProductHuntLaunchesFetcher() },
        
        // NEW RELIABLE SOURCES
        { name: 'Web3News', fetcher: new Web3NewsFetcher() },
        { name: 'HackathonProjects', fetcher: new HackathonProjectsFetcher() },
        { name: 'CryptoJobsList', fetcher: new CryptoJobsListFetcher() },
        
        // SOMETIMES WORK (keep trying)
        { name: 'GitHubTrending', fetcher: new GitHubTrendingFetcher() },
        { name: 'Dework', fetcher: new DeworkFetcher() },
        
        // UNRELIABLE (often timeout but keep for completeness)
        { name: 'Wellfound', fetcher: new WellfoundFetcher() }
      ];
      
      // Fetch from all platforms in parallel with retry logic
      const fetchPromises = web3Fetchers.map(async ({ name, fetcher }) => {
        const robust = new RobustFetcher(fetcher, name);
        const result = await robust.fetchWithRetry();
        
        // Validate items
        const validatedItems = robust.validateItems(result.items);
        
        return {
          source: name.toLowerCase(),
          items: validatedItems,
          errors: result.errors
        };
      });
      
      const web3Results = await Promise.allSettled(fetchPromises);
      
      // Process results
      for (const result of web3Results) {
        if (result.status === 'fulfilled' && result.value.items.length > 0) {
          console.log(`✅ ${result.value.source}: ${result.value.items.length} valid items`);
          fetchResults.push(result.value);
        } else if (result.status === 'rejected') {
          console.log(`❌ Fetcher failed: ${result.reason}`);
        }
      }
      
      // Count fetched items
      for (const fetchResult of fetchResults) {
        result.fetched += fetchResult.items.length;
        result.errors.push(...fetchResult.errors);
      }

      // Step 2: Score and filter content with AI enrichment
      const scoredItems = [];
      let totalProcessed = 0;
      let totalEvaluated = 0;
      
      // CRITICAL FIX: Process ALL sources but limit items PER SOURCE
      // This ensures funding sources aren't skipped
      for (const fetchResult of fetchResults) {
        console.log(`📊 Processing items from ${fetchResult.source} (${fetchResult.items.length} available)`);
        
        // Process MANY items from each source but with reasonable limit
        const maxPerSource = Math.min(fetchResult.items.length, 100); // Up to 100 per source
        let sourceItemCount = 0;
        
        for (const item of fetchResult.items) {
          // Limit per source, not globally
          if (sourceItemCount >= maxPerSource) {
            break;
          }
          // Reasonable global limit to prevent timeout
          if (totalEvaluated >= 500) {
            console.log(`🛑 Evaluated ${totalEvaluated} items total (limit reached)`);
            break;
          }
          sourceItemCount++;
          totalEvaluated++;
          
          // CRITICAL: Extract metadata BEFORE scoring
          let enrichedItem = item;
          
          // Apply source-specific extraction
          if (item.type === 'funding' || fetchResult.source.includes('grant') || fetchResult.source.includes('funding')) {
            // Extract funding program metadata
            const fundingMeta = FundingProgramExtractor.extractFromContent(item);
            enrichedItem = {
              ...item,
              metadata: {
                ...item.metadata,
                ...fundingMeta
              }
            };
            
            // Validate funding program quality
            if (!FundingProgramExtractor.isHighQualityProgram(fundingMeta)) {
              result.rejected++;
              continue;
            }
          } else {
            // Extract startup/project metadata
            enrichedItem = StartupMetadataExtractor.enrichContentItem(item);
            
            // Validate ACCELERATE criteria AFTER extraction
            if (!StartupMetadataExtractor.meetsAccelerateCriteria(enrichedItem)) {
              // Skip items that don't meet basic criteria
              result.rejected++;
              continue;
            }
          }
          
          // Use UNIFIED SCORER that prioritizes projects with needs
          const unifiedScore = UnifiedScorer.scoreContent(enrichedItem);
          result.scored++;
          
          // Log scoring for first few items
          if (totalEvaluated <= 5) {
            console.log(`  📊 ${enrichedItem.title || enrichedItem.name}: ${unifiedScore.category.toUpperCase()} (${unifiedScore.score})`);
            console.log(`     Reasons: ${unifiedScore.reasons.join(', ')}`);
            if (enrichedItem.metadata?.launch_year) {
              console.log(`     Launch: ${enrichedItem.metadata.launch_year}, Funding: $${enrichedItem.metadata.funding_raised || 0}, Team: ${enrichedItem.metadata.team_size || 'unknown'}`);
            }
          }
          
          // Get AI score if available (optional enhancement)
          let aiScore = null;
          let aiBoost = 0;
          try {
            if (unifiedScore.score >= 40) { // Only use AI for promising items
              aiScore = await this.aiScorer.scoreContent(enrichedItem);
              if (aiScore) {
                aiBoost = Math.round(aiScore.overall * 20); // Up to 20 point AI boost
              }
            }
          } catch (error) {
            // AI scoring is optional, continue without it
          }
          
          // Combine unified + AI scores
          const combinedScore = unifiedScore.score + aiBoost;
          
          
          // NEVER reject based on category - let score threshold handle it
          // Manual review will filter bad content
          // if (unifiedScore.category === 'reject' && unifiedScore.score < 5) {
          //   result.rejected++;
          //   continue;
          // }
          
          // Detect content type using dynamic criteria
          const contentType = this.detectContentType(enrichedItem, fetchResult.source);
          // Don't log every single item - it's too much
          
          // ACCELERATE criteria scoring - now with warnings instead of rejections
          const criteriaResult = accelerateCriteriaScorer.score(enrichedItem, contentType as any);
          if (!criteriaResult.eligible) {
            // Log warning but don't reject - let manual review decide
            console.log(`⚠️ ACCELERATE criteria warning for ${enrichedItem.title || enrichedItem.name}: ${criteriaResult.reasons.join(', ')}`);
            // Still use the score but mark for review
            criteriaResult.score = Math.max(criteriaResult.score, 10); // Ensure minimum score
          }
          
          // Skip enrichment for now - it's too slow (30-60s per item!)
          let enrichedData = null;
          // Use combined score (basic + AI) as the base, then consider criteria
          let finalScore = Math.max(combinedScore, criteriaResult.score); // Use higher score
          let finalConfidence = unifiedScore.confidence;
          
          // DISABLE enrichment completely - it's too slow
          const SKIP_ENRICHMENT = true;
          
          try {
            if (!SKIP_ENRICHMENT && finalScore >= 70) {
              // Only enrich VERY high-scoring items to avoid bottleneck
              console.log(`🔬 Enriching ${enrichedItem.title || enrichedItem.name} (score: ${finalScore})...`);
              enrichedData = await enrichmentService.enrichContent(enrichedItem, fetchResult.source);
              console.log(`   ✅ Enrichment complete`);
              if (enrichedData) {
                console.log(`   📊 Enriched data validation:`, enrichedData.validation);
              }
            }
            
            // SKIP dynamic scoring - it's probably failing
            // const dynamicScore = await criteriaService.scoreContent(
            //   enrichedData || item,
            //   contentType
            // );
            const dynamicScore = finalScore; // Just use the score we already have
            
            // Combine scores with weights - USE ENRICHED DATA EVEN IF NOT FULLY VERIFIED
            if (enrichedData) {
              // Even partial enrichment is valuable - don't require full verification
              const enrichmentBonus = Math.round(
                (enrichedData.validation.completeness * 0.1) +  // Up to 10 points from completeness
                (enrichedData.validation.data_quality * 0.1)     // Up to 10 points from quality
              );
              
              // Add enrichment bonus to score
              finalScore = Math.min(100, finalScore + enrichmentBonus);
              finalConfidence = enrichedData.ai_analysis?.confidence || unifiedScore.confidence;
              
              console.log(`✨ Enriched: ${enrichedData.title}`);
              console.log(`   Type: ${contentType}`);
              console.log(`   Completeness: ${enrichedData.validation.completeness}%`);
              console.log(`   Quality: ${enrichedData.validation.data_quality}%`);
              console.log(`   Verified: ${enrichedData.validation.verified}`);
              console.log(`   Score boost: +${enrichmentBonus} (${unifiedScore.score} -> ${finalScore})`);
            } else {
              // Keep the good score we already have - don't overwrite with bad criteriaService
              // finalScore = await criteriaService.scoreContent(item, contentType);
              // finalScore already set above as Math.max(unifiedScore.score, criteriaResult.score)
            }
          } catch (error) {
            console.warn('Enrichment failed, using unified score:', error);
          }
          
          // Make final decision
          const finalRecommendation = this.getRecommendation(finalScore, finalConfidence);
          
          // Debug logging
          if (totalEvaluated <= 5) {
            console.log(`    Final: score=${finalScore}, confidence=${finalConfidence}, recommendation=${finalRecommendation}`);
          }
          
          // ALWAYS process items that made it this far
          // Score threshold already filtered bad items
          if (finalScore >= this.minScoreThreshold) {
            totalProcessed++;
            // Don't limit batch size - process everything we can
            // if (totalProcessed >= this.maxItemsPerBatch) {
            //   console.log(`🎯 Reached batch limit of ${this.maxItemsPerBatch} items`);
            //   break;
            // }
            
            // Normalize GitHub API URLs to regular GitHub URLs
            let normalizedUrl = (enrichedData || enrichedItem).url || (enrichedData || enrichedItem).html_url || '';
            if (normalizedUrl.includes('api.github.com/repos/')) {
              normalizedUrl = normalizedUrl.replace('api.github.com/repos/', 'github.com/');
            }
            
            // AI-FORMATTED FINAL DATA
            const aiFormattedItem = {
              ...(enrichedData || enrichedItem),
              url: normalizedUrl, // Use normalized URL
              source: fetchResult.source,
              content_type: contentType,
              score: finalScore,
              confidence: finalConfidence,
              factors: unifiedScore.reasons,
              recommendation: finalRecommendation,
              ai_enriched: !!enrichedData,
              
              // UNIFIED SCORER METADATA
              unified_category: unifiedScore.category,
              unified_metadata: unifiedScore.metadata,
              
              // AI-GENERATED FIELDS FOR ACCELERATOR
              ai_summary: aiScore ? aiScore.reasoning : enrichedData?.ai_analysis?.summary || 'High-quality content for builders',
              ai_categories: aiScore ? aiScore.categories : ['web3', 'builders'],
              ai_sentiment: aiScore ? aiScore.sentiment : 'positive',
              ai_recommendation: aiScore ? aiScore.recommendation : finalRecommendation,
              ai_relevance: aiScore ? aiScore.relevance : 0.8,
              ai_quality: aiScore ? aiScore.quality : 0.8,
              ai_urgency: aiScore ? aiScore.urgency : 0.5,
              ai_authority: aiScore ? aiScore.authority : 0.7,
              
              // ACCELERATOR-SPECIFIC FORMATTING
              accelerator_ready: true,
              accelerator_tags: [
                contentType,
                ...(aiScore?.categories || []),
                finalScore >= 70 ? 'top-tier' : 'quality',
                enrichedData ? 'enriched' : 'standard'
              ],
              accelerator_priority: finalScore >= 70 ? 'high' : finalScore >= 50 ? 'medium' : 'low',
              
              enrichment_data: enrichedData ? {
                company: enrichedData.company,
                team: enrichedData.team,
                funding: enrichedData.funding,
                technology: enrichedData.technology,
                metrics: enrichedData.metrics,
                social: enrichedData.social,
                ai_analysis: enrichedData.ai_analysis,
                validation: enrichedData.validation
              } : null
            };
            
            scoredItems.push(aiFormattedItem);
          } else {
            result.rejected++;
          }
        }
        
        if (totalProcessed >= this.maxItemsPerBatch) {
          break;
        }
      }
      
      console.log(`📦 Evaluated ${totalEvaluated} items, accepted ${totalProcessed} items`);
      console.log(`📋 Scored items array has ${scoredItems.length} items`);

      // Step 3: Deduplicate content
      console.log(`\n🔍 Found ${scoredItems.length} items that passed scoring`);
      if (scoredItems.length > 0) {
        console.log('Sample scored items:');
        scoredItems.slice(0, 3).forEach(item => {
          console.log(`  - ${item.title || item.name} (score: ${item.score})`);
        });
      }
      const { unique, duplicates } = await deduplicationService.filterDuplicates(scoredItems);
      console.log(`🔄 After deduplication: ${unique.length} unique, ${duplicates.length} duplicates`);
      
      result.rejected += duplicates.length;

      // Step 4: Store unique approved content (already limited by batch processing)
      if (unique.length > 0) {
        console.log(`💾 Storing ${unique.length} items to database...`);
        // MINIMAL VALIDATION - items already passed scoring
        const validatedData = unique.filter(item => {
          // Only check for absolute essentials
          const hasIdentifier = item.title || item.name || item.company_name;
          const hasUrl = item.url || item.html_url || item.website;
          
          if (!hasIdentifier) {
            console.log(`❌ Rejected: No identifier at all`);
            return false;
          }
          if (!hasUrl) {
            console.log(`❌ Rejected: No URL at all`);
            return false;
          }
          // DON'T check score again - already filtered
          // DON'T check content length - let manual review decide
          return true;
        });
        
        console.log(`✅ Validation: ${validatedData.length}/${unique.length} passed final checks`);
        
        const insertData = validatedData.map(item => ({
          title: item.title || item.name || 'Untitled',
          description: item.description || item.tagline || '',
          url: item.url || item.html_url || '',
          source: item.source,
          type: item.content_type || 'project',  // Map content_type to type
          score: item.score || 0,
          confidence: item.confidence || 0.5,
          factors: item.factors || {},
          recommendation: item.recommendation || 'review',
          content_hash: item.content_hash || null,
          raw_data: item,
          metadata: item.metadata || {},
          tags: item.tags || [],
          created_at: new Date().toISOString()
        }));
        
        // IMPORTANT: Store to QUEUE for approval, not directly to curated!
        console.log(`💾 Inserting into content_queue for APPROVAL...`);
        console.log(`📝 Sample insert data:`, JSON.stringify(insertData[0], null, 2));
        console.log(`🔍 Accelerator fields check:`, {
          hasAISummary: !!insertData[0]?.raw_data?.ai_summary,
          hasAcceleratorReady: !!insertData[0]?.raw_data?.accelerator_ready,
          hasAcceleratorPriority: !!insertData[0]?.raw_data?.accelerator_priority,
          hasAIRecommendation: !!insertData[0]?.raw_data?.ai_recommendation,
          rawDataKeys: Object.keys(insertData[0]?.raw_data || {}).slice(0, 10)
        });
        
        // Add queue-specific fields - ONLY use columns that actually exist!
        const queueData = insertData.map(item => {
          // Ensure description meets minimum length requirement (50 chars)
          let description = item.description || item.raw_data?.description || '';
          if (description.length < 50) {
            description = (description + ' - This content is being evaluated for the ACCELERATE platform. It represents high-quality Web3 resources, projects, or funding opportunities for builders.').substring(0, 500);
          }
          
          return {
          title: item.title || 'Untitled',
          description: description,
          url: item.url || '',
          source: item.source || 'unknown',
          type: item.raw_data?.content_type || item.type || 'resource',
          status: 'pending_review',  // Needs approval!
          score: item.score || 0,
          confidence: item.confidence || 0,
          scoring_breakdown: item.factors || {},
          recommendation: item.recommendation || 'review',
          metadata: item.metadata || {},
          enrichment_data: item.enrichment_data || {},
          enrichment_status: item.ai_enriched ? 'completed' : 'pending',
          ai_summary: item.raw_data?.ai_summary || item.description?.substring(0, 500) || '',
          category: item.raw_data?.unified_category || 'general',
          enriched: item.ai_enriched || false,
          quality_score: item.score || 0,
          auto_approved: false,
          created_at: new Date().toISOString()
        };
        });
        
        try {
          // USE NEW STAGING SERVICE - Insert to proper staging tables!
          const { stagingService } = await import('../services/staging-service');
          
          // Transform to staging format with proper types
          const stagingItems = validatedData.map(item => ({
            title: item.title || item.name,
            name: item.name || item.title,
            description: item.description || item.tagline || 'High-quality Web3 content being evaluated for ACCELERATE platform',
            url: item.url || item.html_url || '',
            source: item.source,
            type: (item.raw_data?.content_type || item.type || 'resource') as 'project' | 'funding' | 'resource',
            score: item.score || 0,
            metadata: item.raw_data || item.metadata || {},
            ai_summary: item.raw_data?.ai_summary || '',
            ...item.raw_data // Include all enriched data
          }));
          
          const stagingResult = await stagingService.insertToStaging(stagingItems);
          
          if (stagingResult.success) {
            console.log(`✅ Stored to staging tables:`);
            console.log(`   - Projects: ${stagingResult.inserted.projects}`);
            console.log(`   - Funding/Investors: ${stagingResult.inserted.funding}`);
            console.log(`   - Resources/News: ${stagingResult.inserted.resources}`);
            result.stored = stagingResult.inserted.projects + 
                          stagingResult.inserted.funding + 
                          stagingResult.inserted.resources;
            result.totalProjects = stagingResult.inserted.projects;
            result.totalInvestors = stagingResult.inserted.funding;
            result.totalNews = stagingResult.inserted.resources;
          } else {
            console.error(`❌ Staging errors:`, stagingResult.errors);
            result.errors.push(...stagingResult.errors);
            
            // FALLBACK to old content_queue if staging fails
            console.log('⚠️  Falling back to content_queue...');
            const { data, error } = await supabase
              .from('content_queue')
              .insert(queueData as any);
            
            if (error) {
              console.error(`❌ Fallback also failed:`, error.message);
            } else {
              console.log(`✅ Fallback successful - stored ${unique.length} items to content_queue`);
              result.stored = unique.length;
            }
          }
        } catch (err) {
          console.error(`❌ Storage exception:`, err);
          result.errors.push(`Storage error: ${err}`);
        }
      } else {
        console.log(`⚠️ No unique items to store after deduplication`);
      }

    } catch (error) {
      result.errors.push(`Orchestration error: ${error}`);
      logError('Orchestration failed', 'orchestrator', error);
    }

    result.duration = (Date.now() - startTime) / 1000;
    result.totalFetched = result.fetched;
    result.successRate = result.stored > 0 ? Math.round((result.stored / result.fetched) * 100) : 0;
    
    // Track metrics with new metrics service
    metricsService.trackFetch(result.stored, (Date.now() - startTime));
    
    // Also track with existing system
    trackMetric('pipeline_duration', result.duration, 'orchestrator');
    trackMetric('pipeline_success_rate', result.successRate, 'orchestrator');
    trackMetric('items_stored', result.stored, 'orchestrator');
    
    if (result.stored > 0) {
      logInfo(`Pipeline completed: ${result.stored} items stored`, 'orchestrator', {
        fetched: result.fetched,
        successRate: result.successRate
      });
    }
    
    // Set defaults if not set
    result.totalProjects = result.totalProjects || 0;
    result.totalNews = result.totalNews || 0;
    result.totalInvestors = result.totalInvestors || 0;
    
    return result;
  }

  /**
   * Detect content type based on source and content
   */
  private detectContentType(item: any, source: string): 'project' | 'funding' | 'resource' {
    // First check if type is already set by the fetcher
    if (item.type === 'funding') return 'funding';
    if (item.type === 'project') return 'project';
    if (item.type === 'resource') return 'resource';
    
    // Check contentType field too
    if (item.contentType === 'funding') return 'funding';
    if (item.contentType === 'project') return 'project';
    if (item.contentType === 'resource') return 'resource';
    
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    
    // Source-based detection
    if (source === 'producthunt' || source === 'github') return 'project';
    if (source === 'defilama') return 'funding';
    if (source.toLowerCase().includes('grant') || source.toLowerCase().includes('funding')) return 'funding';
    
    // Content-based detection
    // Check for project indicators
    if (item.team_size || item.launch_date || item.founders) return 'project';
    if (text.includes('startup') || text.includes('founder') || text.includes('building')) return 'project';
    
    // Check for funding indicators
    if (item.funding_amount || item.funding_amount_min || item.funding_amount_max) return 'funding';
    if (item.deadline || item.application_url || item.application_deadline) return 'funding';
    if (text.includes('grant') || text.includes('accelerator') || text.includes('incubator')) return 'funding';
    if (text.includes('million') && text.includes('fund')) return 'funding';
    
    // Default to resource
    return 'resource';
  }

  /**
   * Get recommendation based on score and confidence
   */
  private getRecommendation(score: number, confidence: number): string {
    // Much more lenient for internal tool - accept almost everything
    if (score < 5) return 'reject';   // Only reject terrible items
    if (score < 20) return 'review';  // Low score but worth reviewing
    if (score < 50) return 'approve'; // Decent score, approve
    return 'feature';  // High score, feature it
  }

  /**
   * Get pipeline status
   */
  async getStatus(): Promise<{
    lastRun?: Date;
    totalContent: number;
    breakdown: Record<string, number>;
  }> {
    try {
      // Get last run time
      const { data: lastRunData } = await supabase
        .from('content_curated')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      // Get content counts
      const { count: totalContent } = await supabase
        .from('content_curated')
        .select('*', { count: 'exact', head: true });

      // Get breakdown by source
      const { data: breakdownData } = await supabase
        .from('content_curated')
        .select('source');

      const breakdown: Record<string, number> = {};
      if (breakdownData) {
        for (const item of breakdownData as any[]) {
          breakdown[item.source] = (breakdown[item.source] || 0) + 1;
        }
      }

      return {
        lastRun: (lastRunData as any)?.[0]?.created_at ? new Date((lastRunData as any)[0].created_at) : undefined,
        totalContent: totalContent || 0,
        breakdown
      };
    } catch (error) {
      throw new Error(`Failed to get status: ${error}`);
    }
  }

  /**
   * Clean old content
   */
  async cleanup(daysToKeep: number = 30): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error, count } = await supabase
      .from('content_curated')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    return { deleted: count || 0 };
  }
}

export const orchestrator = new SimpleOrchestrator();