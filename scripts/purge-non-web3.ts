#!/usr/bin/env tsx

/**
 * AGGRESSIVE Web3 content filter - removes ALL non-blockchain content
 */

import { supabase } from '../src/lib/supabase-client';

// STRICT Web3 keywords - at least ONE must be present
const REQUIRED_WEB3_KEYWORDS = [
  // Core blockchain terms
  'blockchain', 'crypto', 'cryptocurrency', 'web3', 'defi', 'decentralized',

  // Major chains
  'ethereum', 'bitcoin', 'solana', 'polygon', 'avalanche', 'arbitrum',
  'optimism', 'bnb', 'binance', 'cardano', 'polkadot', 'cosmos', 'near',

  // DeFi/Tech terms
  'smart contract', 'dapp', 'nft', 'dao', 'tokenization', 'staking',
  'liquidity', 'amm', 'dex', 'cex', 'cefi', 'gamefi', 'metaverse',
  'layer2', 'l2', 'zk', 'rollup', 'sidechain',

  // Wallets/Tools
  'metamask', 'wallet', 'ledger', 'trezor', 'etherscan',

  // Protocols/Projects
  'uniswap', 'aave', 'compound', 'maker', 'curve', 'sushi',
  'chainlink', 'opensea', 'alchemy', 'infura',

  // Consensus/Tech
  'proof of stake', 'proof of work', 'consensus', 'validator',
  'mining', 'minting', 'gas', 'gwei', 'wei'
];

async function purgeNonWeb3() {
  console.log('🚨 AGGRESSIVE WEB3 FILTER - Removing ALL non-blockchain content\n');

  try {
    // Fetch ALL items from content_queue
    const { data: items, error } = await supabase
      .from('content_queue')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching items:', error);
      return;
    }

    if (!items || items.length === 0) {
      console.log('No items found in content_queue');
      return;
    }

    console.log(`📊 Found ${items.length} total items\n`);
    console.log('Analyzing each item for Web3 content...\n');

    const toDelete: any[] = [];
    const toKeep: any[] = [];

    // Check each item STRICTLY - DO NOT include URL in search (might have web3 in path)
    for (const item of items) {
      // Only check actual content, not URLs
      const searchText = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();

      // Must have at least ONE Web3 keyword
      const matchedKeywords = REQUIRED_WEB3_KEYWORDS.filter(keyword =>
        searchText.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length === 0) {
        toDelete.push(item);
        console.log(`❌ REMOVING: "${item.title || item.url || 'Untitled'}"`);
        console.log(`   Reason: NO Web3/blockchain keywords found\n`);
      } else {
        toKeep.push(item);
        console.log(`✅ KEEPING: "${item.title || item.url || 'Untitled'}"`);
        console.log(`   Web3 Keywords: ${matchedKeywords.slice(0, 3).join(', ')}\n`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY:');
    console.log(`   ✅ Web3 Content to KEEP: ${toKeep.length}`);
    console.log(`   ❌ Non-Web3 to DELETE: ${toDelete.length}`);
    console.log('='.repeat(60) + '\n');

    if (toDelete.length > 0) {
      console.log(`🗑️  DELETING ${toDelete.length} non-Web3 items...`);

      // Delete ALL non-Web3 content
      const deleteIds = toDelete.map(item => item.id);

      // Delete in batches of 50
      const batchSize = 50;
      for (let i = 0; i < deleteIds.length; i += batchSize) {
        const batch = deleteIds.slice(i, i + batchSize);

        const { error: deleteError } = await supabase
          .from('content_queue')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error(`Error deleting batch ${i / batchSize + 1}:`, deleteError);
        } else {
          console.log(`   ✓ Deleted batch ${i / batchSize + 1} (${batch.length} items)`);
        }
      }

      console.log('\n✅ PURGE COMPLETE! Only Web3/blockchain content remains.');
    } else {
      console.log('✅ ALL content is already Web3-focused! No cleanup needed.');
    }

    // Show what remains
    console.log('\n📋 REMAINING CONTENT SAMPLE:');
    for (const item of toKeep.slice(0, 5)) {
      console.log(`   • ${item.title || item.url}`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the aggressive purge
console.log('Starting aggressive Web3 content filter...\n');
purgeNonWeb3();