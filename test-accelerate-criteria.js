// Test that we're ACTUALLY meeting ACCELERATE criteria
const CRITERIA = {
  projects: {
    MUST: {
      launch_date: '2024+',
      funding: '< $500k',
      team_size: '1-10 people',
      independence: 'NOT corporate-backed'
    },
    EXCLUDE: {
      old: 'before 2024',
      overfunded: '>$500k',
      large_team: '>10 people',
      corporate: 'backed by large companies',
      abandoned: 'no activity >30 days'
    }
  },
  funding_programs: {
    MUST: {
      active: 'Currently accepting applications',
      recent: '2025 activity proven',
      accessible: 'Open application process'
    }
  },
  resources: {
    MUST: {
      valuable: 'Clear value to founders',
      actionable: 'Not just theory',
      current: 'Updated in last 6 months'
    }
  }
};

async function testFetchers() {
  console.log('🎯 TESTING AGAINST ACCELERATE CRITERIA');
  console.log('=====================================\n');
  
  // Test HackerNews YC Jobs
  console.log('1️⃣ Testing HackerNews YC Jobs Fetcher:');
  const { HackerNewsYCJobsFetcher } = require('./dist/fetchers/real-sources/hackernews-yc-jobs');
  const hnFetcher = new HackerNewsYCJobsFetcher();
  const hnData = await hnFetcher.fetch();
  const hnItems = hnFetcher.transform(hnData);
  
  console.log(`   Total jobs fetched: ${hnData[0]?.length || 0}`);
  console.log(`   YC companies found: ${hnItems.length}`);
  
  // Check criteria
  const hn2024Plus = hnItems.filter(i => i.metadata?.yc_year >= 2024);
  console.log(`   ✅ 2024+ companies: ${hn2024Plus.length}`);
  console.log(`   ❌ Pre-2024 companies: ${hnItems.length - hn2024Plus.length}`);
  
  if (hn2024Plus.length > 0) {
    console.log('\n   Sample 2024+ YC company:');
    const sample = hn2024Plus[0];
    console.log(`   • ${sample.title} (YC ${sample.metadata.yc_batch})`);
    console.log(`   • Launch: ${sample.metadata.launch_year}`);
    console.log(`   • Funding: $${sample.metadata.funding_raised}`);
    console.log(`   • Score: ${sample.metadata.accelerate_score}`);
  }
  
  // Test IndieHackers
  console.log('\n2️⃣ Testing IndieHackers Projects Fetcher:');
  const { IndieHackersProjectsFetcher } = require('./dist/fetchers/real-sources/indiehackers-projects');
  const ihFetcher = new IndieHackersProjectsFetcher();
  const ihData = await ihFetcher.fetch();
  const ihItems = ihFetcher.transform(ihData);
  
  console.log(`   Projects found: ${ihItems.length}`);
  
  const ihEarlyStage = ihItems.filter(i => i.metadata?.is_early_stage);
  console.log(`   ✅ Early-stage (<$500k): ${ihEarlyStage.length}`);
  console.log(`   ✅ Bootstrapped: ${ihItems.filter(i => i.metadata?.is_bootstrapped).length}`);
  
  // Summary
  console.log('\n📊 ACCELERATE CRITERIA COMPLIANCE:');
  console.log('====================================');
  console.log(`Total qualifying projects: ${hn2024Plus.length + ihEarlyStage.length}`);
  console.log(`- YC 2024+ companies: ${hn2024Plus.length}`);
  console.log(`- Indie early-stage: ${ihEarlyStage.length}`);
  
  const avgScore = [...hn2024Plus, ...ihEarlyStage]
    .reduce((sum, i) => sum + (i.metadata?.accelerate_score || 0), 0) / 
    (hn2024Plus.length + ihEarlyStage.length);
  
  console.log(`\nAverage ACCELERATE score: ${Math.round(avgScore)}`);
  console.log(`Meeting 80%+ quality target: ${avgScore >= 80 ? '✅ YES' : '❌ NO'}`);
}

testFetchers().catch(console.error);