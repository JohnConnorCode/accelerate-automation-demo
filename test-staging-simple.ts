#!/usr/bin/env npx tsx

import { stagingService } from './src/services/staging-service';

async function testStaging() {
  console.log('🧪 Testing staging service directly...\n');
  
  const testItems = [
    {
      title: 'Test Web3 Project',
      description: 'An innovative blockchain project focusing on DeFi solutions for the Web3 ecosystem with advanced smart contracts',
      url: 'https://test-project-' + Date.now() + '.com',
      source: 'test',
      type: 'project' as const,
      score: 75,
      metadata: {
        team_size: 3,
        funding_raised: 50000
      }
    },
    {
      title: 'Test Grant Program',
      description: 'A comprehensive grant program supporting Web3 builders with non-dilutive funding and mentorship opportunities',
      url: 'https://test-grant-' + Date.now() + '.com',
      source: 'test',
      type: 'funding' as const,
      score: 85,
      metadata: {
        min_amount: 10000,
        max_amount: 100000
      }
    },
    {
      title: 'Test Developer Tool',
      description: 'Essential developer tool for Web3 builders providing infrastructure and documentation for blockchain development',
      url: 'https://test-tool-' + Date.now() + '.com',
      source: 'test',
      type: 'resource' as const,
      score: 65,
      metadata: {
        price_type: 'free'
      }
    }
  ];
  
  console.log('Inserting 3 test items...\n');
  
  const result = await stagingService.insertToStaging(testItems);
  
  console.log('Result:', result);
  console.log('\n✅ Test complete!');
  
  // Check stats
  const stats = await stagingService.getQueueStats();
  console.log('\n📊 Queue Stats:');
  console.log(`Projects - Pending: ${stats.projects.pending}`);
  console.log(`Funding - Pending: ${stats.funding.pending}`);
  console.log(`Resources - Pending: ${stats.resources.pending}`);
}

testStaging().catch(console.error);