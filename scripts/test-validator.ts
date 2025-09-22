#!/usr/bin/env tsx

/**
 * Test the ACCELERATE validator with sample data
 */

import { AccelerateValidator } from '../src/validators/accelerate-validator';
import { ContentItem } from '../src/types';

// Test cases
const testCases: ContentItem[] = [
  // Should PASS - Strong Web3 project
  {
    id: '1',
    type: 'project',
    title: 'DeFi Protocol for Ethereum',
    description: 'Building a decentralized finance protocol on blockchain with smart contracts for crypto lending',
    url: 'https://example.com',
    source: 'GitHub',
    created_at: new Date().toISOString(),
    metadata: {
      launch_date: '2024-01-01',
      funding_raised: 100000,
      team_size: 3
    }
  },
  // Should FAIL - Not Web3
  {
    id: '2',
    type: 'project',
    title: 'AI Photo Editor',
    description: 'Machine learning powered photo editing app for iOS and Android',
    url: 'https://example.com',
    source: 'ProductHunt',
    created_at: new Date().toISOString(),
    metadata: {
      launch_date: '2024-01-01',
      funding_raised: 50000,
      team_size: 2
    }
  },
  // Should FAIL - Only one Web3 keyword
  {
    id: '3',
    type: 'project',
    title: 'Crypto Trading App',
    description: 'Mobile app for trading stocks and commodities',
    url: 'https://example.com',
    source: 'HackerNews',
    created_at: new Date().toISOString(),
    metadata: {
      launch_date: '2024-01-01',
      funding_raised: 0,
      team_size: 1
    }
  },
  // Should PASS - Multiple Web3 keywords
  {
    id: '4',
    type: 'project',
    title: 'Solana NFT Marketplace',
    description: 'A decentralized marketplace for NFTs built on Solana blockchain with Web3 integration',
    url: 'https://example.com',
    source: 'Reddit',
    created_at: new Date().toISOString(),
    metadata: {
      launch_date: '2024-06-01',
      funding_raised: 0,
      team_size: 4
    }
  },
  // Should PASS - Web3 funding
  {
    id: '5',
    type: 'funding',
    name: 'Ethereum Grant Program',
    description: 'Grants for blockchain developers building DeFi applications on Ethereum',
    url: 'https://example.com',
    source: 'Manual',
    created_at: new Date().toISOString(),
    metadata: {
      max_amount: 50000,
      is_active: true
    }
  },
  // Should FAIL - Non-Web3 funding
  {
    id: '6',
    type: 'funding',
    name: 'YC Startup School',
    description: 'Accelerator program for early-stage startups',
    url: 'https://example.com',
    source: 'YCombinator',
    created_at: new Date().toISOString(),
    metadata: {
      max_amount: 500000,
      is_active: true
    }
  }
];

console.log('🧪 Testing ACCELERATE Validator\n');
console.log('=' .repeat(60));

for (const testCase of testCases) {
  const result = AccelerateValidator.validate(testCase);
  const status = result.isValid ? '✅ PASS' : '❌ FAIL';

  console.log(`\n${status}: ${testCase.title || testCase.name}`);
  console.log(`   Type: ${testCase.type}`);
  console.log(`   Score: ${result.score}`);
  console.log(`   Category: ${result.category}`);
  if (result.reasons.length > 0) {
    console.log(`   Reasons: ${result.reasons.join(', ')}`);
  }

  // Show keyword analysis for debugging
  const text = `${testCase.title || testCase.name || ''} ${testCase.description || ''}`.toLowerCase();
  const primaryKeywords = ['blockchain', 'cryptocurrency', 'bitcoin', 'ethereum', 'solana',
                           'defi', 'decentralized finance', 'smart contract', 'web3', 'crypto'];
  const matches = primaryKeywords.filter(kw => text.includes(kw));
  console.log(`   Web3 Keywords: ${matches.join(', ') || 'none'}`);
}

console.log('\n' + '=' .repeat(60));
console.log('✅ Validator test complete!');