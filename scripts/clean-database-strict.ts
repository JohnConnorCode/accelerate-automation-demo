#!/usr/bin/env tsx

/**
 * STRICT DATABASE CLEANER - Remove ALL non-Web3 content
 * Zero tolerance for non-blockchain content
 */

import { supabase } from '../src/lib/supabase-client';

// MUST have at least 2 of these keywords to be considered Web3
const PRIMARY_WEB3_KEYWORDS = [
  'blockchain', 'cryptocurrency', 'bitcoin', 'ethereum', 'solana',
  'defi', 'decentralized finance', 'smart contract', 'web3', 'crypto'
];

// OR have 1 primary + 1 secondary
const SECONDARY_WEB3_KEYWORDS = [
  'nft', 'dao', 'dapp', 'metamask', 'wallet', 'token', 'mint',
  'staking', 'liquidity', 'yield', 'airdrop', 'gas', 'layer2',
  'polygon', 'avalanche', 'binance', 'coinbase', 'uniswap',
  'opensea', 'chainlink', 'proof of stake', 'proof of work'
];

// Definitely NOT Web3 (override any matches)
const EXCLUSION_KEYWORDS = [
  'apple watch', 'iphone', 'android', 'windows', 'mac',
  'netflix', 'spotify', 'facebook', 'instagram', 'tiktok'
];

async function strictClean() {
  console.log('🚨 STRICT WEB3 DATABASE CLEANER\n');
  console.log('Rules:');
  console.log('  - Must have 2+ primary Web3 keywords OR');
  console.log('  - 1 primary + 1 secondary Web3 keyword');
  console.log('  - NO general tech content\n');

  try {
    // Get ALL items
    const { data: items, error } = await supabase
      .from('content_queue')
      .select('*');

    if (error) throw error;
    if (!items || items.length === 0) {
      console.log('No items in database');
      return;
    }

    console.log(`Found ${items.length} items to analyze\n`);

    const toDelete: string[] = [];
    const toKeep: string[] = [];
    let sampleDeleted: string[] = [];
    let sampleKept: string[] = [];

    for (const item of items) {
      const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();

      // Check for exclusions first
      const hasExclusion = EXCLUSION_KEYWORDS.some(keyword => text.includes(keyword));
      if (hasExclusion) {
        toDelete.push(item.id);
        if (sampleDeleted.length < 3) {
          sampleDeleted.push(item.title || item.url || 'Untitled');
        }
        continue;
      }

      // Count Web3 keywords
      const primaryMatches = PRIMARY_WEB3_KEYWORDS.filter(kw => text.includes(kw));
      const secondaryMatches = SECONDARY_WEB3_KEYWORDS.filter(kw => text.includes(kw));

      const isWeb3 = primaryMatches.length >= 2 ||
                     (primaryMatches.length >= 1 && secondaryMatches.length >= 1);

      if (!isWeb3) {
        toDelete.push(item.id);
        if (sampleDeleted.length < 3) {
          sampleDeleted.push(item.title || item.url || 'Untitled');
        }
      } else {
        toKeep.push(item.id);
        if (sampleKept.length < 3) {
          sampleKept.push(item.title || item.url || 'Untitled');
        }
      }
    }

    console.log('📊 ANALYSIS COMPLETE:\n');
    console.log(`✅ Web3 content to KEEP: ${toKeep.length}`);
    if (sampleKept.length > 0) {
      console.log('   Examples:');
      sampleKept.forEach(title => console.log(`   • ${title}`));
    }

    console.log(`\n❌ Non-Web3 to DELETE: ${toDelete.length}`);
    if (sampleDeleted.length > 0) {
      console.log('   Examples:');
      sampleDeleted.forEach(title => console.log(`   • ${title}`));
    }

    if (toDelete.length > 0) {
      console.log(`\n🗑️  DELETING ${toDelete.length} non-Web3 items...`);

      // Delete in batches
      const batchSize = 50;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('content_queue')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error('Delete error:', deleteError);
        } else {
          console.log(`   Deleted batch ${Math.floor(i/batchSize) + 1}`);
        }
      }

      console.log('\n✅ Database cleaned! Only strict Web3 content remains.');
    } else {
      console.log('\n✅ All content is already Web3-focused!');
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

strictClean();