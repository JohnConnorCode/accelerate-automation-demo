import { AccelerateDBPipeline } from './src/lib/accelerate-db-pipeline';
import { ContentItem } from './src/lib/base-fetcher';

async function testPipeline() {
  console.log('Testing pipeline with sample data...\n');
  
  // Create test items
  const testItems: ContentItem[] = [
    {
      type: 'resource',
      title: 'Zero-Knowledge Development Guide',
      description: 'A comprehensive guide to building privacy-preserving applications with zero-knowledge proofs',
      url: 'https://example.com/zk-guide',
      source: 'Dev.to',
      author: 'ZK Developer',
      tags: ['zk', 'privacy', 'blockchain'],
      metadata: {
        accelerate_score: 75,
        category: 'Development Tools',
        price_type: 'free',
        difficulty_level: 'intermediate',
        provider_name: 'ZK Community'
      }
    },
    {
      type: 'project',
      title: 'PrivateVault',
      description: 'A privacy-first storage solution using ZK proofs',
      url: 'https://privatevault.example.com',
      source: 'HackerNews',
      tags: ['privacy', 'storage', 'zk'],
      metadata: {
        accelerate_score: 85,
        launch_date: '2024-03-01',
        funding_raised: 250000,
        team_size: 4,
        yc_batch: 'W24',
        is_yc_backed: true
      }
    }
  ];
  
  try {
    const results = await AccelerateDBPipeline.processContent(testItems);
    console.log('\nPipeline Results:');
    console.log('================');
    console.log(`Processed: ${results.processed}`);
    console.log(`Inserted: ${results.inserted}`);
    console.log(`Updated: ${results.updated}`);
    console.log(`Rejected: ${results.rejected}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => console.log(`- ${err}`));
    }
    
    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('Pipeline test failed:', error);
  }
}

testPipeline();
