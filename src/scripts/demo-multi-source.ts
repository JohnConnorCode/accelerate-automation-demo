#!/usr/bin/env node
/**
 * DEMO: Multi-Source Data Enrichment
 * Shows how we combine data from multiple sources
 */

import { multiSourceAggregator, UnifiedProfile } from '../services/multi-source-aggregator';
import { ContentItem } from '../lib/base-fetcher';

// Simulate data from different sources about the same companies
const SAMPLE_DATA: ContentItem[] = [
  // Company 1: Greptile (from multiple sources)
  {
    title: 'Greptile',
    description: 'AI-powered code search and understanding for developers',
    url: 'https://greptile.com',
    source: 'YCombinator',
    type: 'project',
    published: '2024-01-15',
    tags: ['ai', 'developer-tools', 'yc'],
    metadata: {
      yc_batch: 'W24',
      location: 'San Francisco',
      team_size: 3,
      funding_raised: 500000,
      launch_year: 2024
    }
  },
  {
    title: 'Greptile - AI code search',
    description: 'Greptile helps developers search and understand codebases using AI. Founded by Daksh Gupta.',
    url: 'https://techcrunch.com/2024/01/greptile-raises-seed',
    source: 'RSS: TechCrunch',
    type: 'funding',
    published: '2024-01-20',
    tags: ['funding', 'seed'],
    metadata: {
      funding_amount: 4200000,
      funding_round: 'seed',
      investors: ['Initialized Capital', 'Y Combinator']
    }
  },
  {
    title: 'greptile-ai',
    description: 'Repository search and code understanding API',
    url: 'https://github.com/greptile-ai',
    source: 'GitHub',
    type: 'project',
    published: '2024-01-10',
    metadata: {
      github_stars: 1250,
      github_url: 'https://github.com/greptile-ai',
      twitter_url: 'https://twitter.com/greptileai'
    }
  },
  
  // Company 2: Onyx (single source)
  {
    title: 'Onyx',
    description: 'Private cloud platform for enterprises',
    url: 'https://onyx.com',
    source: 'YCombinator',
    type: 'project',
    published: '2024-01-15',
    tags: ['infrastructure', 'enterprise', 'yc'],
    metadata: {
      yc_batch: 'W24',
      location: 'New York',
      team_size: 5
    }
  },
  
  // Company 3: GovernGPT (from multiple sources)
  {
    title: 'GovernGPT',
    description: 'AI for investment due diligence questionnaires',
    url: 'https://governgpt.com',
    source: 'YCombinator',
    type: 'project',
    published: '2024-01-15',
    tags: ['ai', 'fintech', 'yc'],
    metadata: {
      yc_batch: 'W24',
      location: 'Montreal',
      team_size: 4
    }
  },
  {
    title: 'GovernGPT helps hedge funds with DD',
    description: 'Montreal startup GovernGPT using LLMs to automate due diligence for Bridgewater and Coatue',
    url: 'https://reddit.com/r/startups/governgpt-launch',
    source: 'Reddit',
    type: 'project',
    published: '2024-02-01',
    metadata: {
      upvotes: 245,
      comments: 67
    }
  }
];

async function demonstrateMultiSource() {
  console.log('🚀 MULTI-SOURCE DATA ENRICHMENT DEMONSTRATION\n');
  console.log('=' .repeat(70));
  console.log('\nThis demo shows how we combine data from multiple sources');
  console.log('to create rich, unified profiles of startups.\n');
  
  // Show raw data
  console.log('📥 RAW DATA FROM DIFFERENT SOURCES:');
  console.log('=' .repeat(70));
  
  const companyCounts = new Map<string, number>();
  SAMPLE_DATA.forEach(item => {
    const name = item.title.split(' ')[0];
    companyCounts.set(name, (companyCounts.get(name) || 0) + 1);
    console.log(`\n  [${item.source}] ${item.title}`);
    if (item.metadata?.funding_amount) {
      console.log(`    💰 Funding: $${item.metadata.funding_amount.toLocaleString()}`);
    }
    if (item.metadata?.yc_batch) {
      console.log(`    🎓 YC Batch: ${item.metadata.yc_batch}`);
    }
    if (item.metadata?.github_stars) {
      console.log(`    ⭐ GitHub Stars: ${item.metadata.github_stars}`);
    }
  });
  
  console.log('\n📊 Data distribution:');
  for (const [company, count] of companyCounts.entries()) {
    console.log(`  - ${company}: ${count} source${count > 1 ? 's' : ''}`);
  }
  
  // Aggregate data
  console.log('\n\n🔄 AGGREGATING DATA...');
  console.log('=' .repeat(70));
  
  const profiles = await multiSourceAggregator.aggregate(SAMPLE_DATA);
  
  console.log(`✅ Created ${profiles.length} unified profiles from ${SAMPLE_DATA.length} raw items\n`);
  
  // Show unified profiles
  console.log('💎 UNIFIED PROFILES:');
  console.log('=' .repeat(70));
  
  profiles.forEach((profile, index) => {
    console.log(`\n${index + 1}. ${profile.canonical_name}`);
    console.log('   ' + '-'.repeat(50));
    
    // Basic info
    console.log('   📝 Description:', profile.description.substring(0, 100) + '...');
    console.log('   🌐 Sources:', profile.metadata.sources.join(', '));
    
    // Enriched data
    if (profile.company.stage) {
      console.log('   📈 Stage:', profile.company.stage);
    }
    
    if (profile.team.size) {
      console.log('   👥 Team Size:', `${profile.team.size} (${profile.team.size_range})`);
    }
    
    if (profile.funding.total_raised) {
      console.log('   💰 Total Funding:', `$${profile.funding.total_raised.toLocaleString()}`);
      if (profile.funding.investors.length > 0) {
        console.log('   💼 Investors:', profile.funding.investors.join(', '));
      }
    }
    
    if (profile.metrics.github_stars) {
      console.log('   ⭐ GitHub Stars:', profile.metrics.github_stars);
    }
    
    // Data quality
    console.log('   📊 Data Quality:');
    console.log(`      - Completeness: ${profile.metadata.data_quality.completeness}%`);
    console.log(`      - Confidence: ${profile.metadata.data_quality.confidence}%`);
    console.log(`      - Verification: ${profile.metadata.data_quality.verification_level}`);
    
    // ACCELERATE score
    console.log('   🚀 ACCELERATE:');
    console.log(`      - Score: ${profile.accelerate.score}/100`);
    console.log(`      - Eligible: ${profile.accelerate.eligible ? '✅ Yes' : '❌ No'}`);
    console.log(`      - Recommendation: ${profile.accelerate.recommendation.toUpperCase()}`);
  });
  
  // Show enrichment value
  console.log('\n\n✨ ENRICHMENT VALUE:');
  console.log('=' .repeat(70));
  
  // Compare Greptile before and after
  const greptileProfile = profiles.find(p => p.canonical_name === 'Greptile');
  if (greptileProfile) {
    console.log('\nExample: Greptile');
    console.log('\nBEFORE (single source):');
    console.log('  - YC Batch: W24');
    console.log('  - Team Size: 3');
    console.log('  - Funding: $500k (YC)');
    
    console.log('\nAFTER (multi-source aggregation):');
    console.log('  - YC Batch: W24');
    console.log('  - Team Size: 3');
    console.log('  - Total Funding: $4.2M (Seed round)');
    console.log('  - Investors: Initialized Capital, Y Combinator');
    console.log('  - GitHub Stars: 1,250');
    console.log('  - Twitter: @greptileai');
    console.log('  - Sources: YCombinator, TechCrunch, GitHub');
    console.log('  - Data Completeness: ' + greptileProfile.metadata.data_quality.completeness + '%');
  }
  
  // Summary statistics
  console.log('\n\n📈 AGGREGATION STATISTICS:');
  console.log('=' .repeat(70));
  
  const multiSourceProfiles = profiles.filter(p => p.metadata.sources.length > 1);
  const avgCompleteness = profiles.reduce((sum, p) => 
    sum + p.metadata.data_quality.completeness, 0
  ) / profiles.length;
  
  console.log(`\n  Input: ${SAMPLE_DATA.length} items from ${new Set(SAMPLE_DATA.map(i => i.source)).size} sources`);
  console.log(`  Output: ${profiles.length} unified profiles`);
  console.log(`  Multi-source profiles: ${multiSourceProfiles.length}/${profiles.length} (${Math.round(multiSourceProfiles.length/profiles.length*100)}%)`);
  console.log(`  Average data completeness: ${avgCompleteness.toFixed(1)}%`);
  console.log(`  ACCELERATE eligible: ${profiles.filter(p => p.accelerate.eligible).length}/${profiles.length}`);
  
  // Benefits summary
  console.log('\n\n🎯 KEY BENEFITS:');
  console.log('=' .repeat(70));
  console.log('\n  1. RICHER DATA: Combined multiple sources to get complete picture');
  console.log('  2. VERIFICATION: Cross-referenced data across sources for accuracy');
  console.log('  3. DISCOVERY: Found funding info from news that wasn\'t in YC data');
  console.log('  4. METRICS: Gathered GitHub stars, social handles, etc.');
  console.log('  5. SCORING: Better ACCELERATE scoring with more complete data');
}

// Run demo
demonstrateMultiSource().then(() => {
  console.log('\n\n✅ Demo completed successfully\n');
}).catch(err => {
  console.error('\n❌ Demo failed:', err);
  process.exit(1);
});