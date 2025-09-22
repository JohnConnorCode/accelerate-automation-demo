#!/usr/bin/env tsx

/**
 * Clean non-Web3 content from database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// Web3 keywords that MUST be present
const web3Keywords = [
  'blockchain', 'crypto', 'defi', 'web3', 'nft', 'dao',
  'ethereum', 'bitcoin', 'solana', 'polygon', 'avalanche',
  'arbitrum', 'optimism', 'layer2', 'l2', 'smart contract',
  'dapp', 'decentralized', 'tokenization', 'staking',
  'liquidity', 'amm', 'dex', 'cefi', 'gamefi', 'metaverse',
  'wallet', 'binance', 'chainlink', 'uniswap', 'aave',
  'compound', 'maker', 'curve', 'sushi', 'yearn'
];

async function cleanNonWeb3Content() {
  console.log('🧹 Cleaning non-Web3 content from database...\n');

  try {
    // Fetch all items from content_queue
    const { data: items, error } = await supabase
      .from('content_queue')
      .select('id, title, description, content, url')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!items || items.length === 0) {
      console.log('No items found in content_queue');
      return;
    }

    console.log(`Found ${items.length} items in queue\n`);

    const toDelete: string[] = [];
    const toKeep: string[] = [];

    // Check each item for Web3 content
    for (const item of items) {
      const searchText = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();

      const hasWeb3Content = web3Keywords.some(keyword => searchText.includes(keyword));

      if (!hasWeb3Content) {
        toDelete.push(item.id);
        console.log(`❌ DELETE: ${item.title || item.url}`);
        console.log(`   Reason: No Web3/blockchain/crypto keywords found\n`);
      } else {
        toKeep.push(item.id);
        console.log(`✅ KEEP: ${item.title || item.url}`);
        const matchedKeywords = web3Keywords.filter(keyword => searchText.includes(keyword));
        console.log(`   Keywords: ${matchedKeywords.slice(0, 5).join(', ')}\n`);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Items to keep: ${toKeep.length}`);
    console.log(`   Items to delete: ${toDelete.length}`);

    if (toDelete.length > 0) {
      console.log('\n🗑️  Deleting non-Web3 content...');

      // Delete in batches of 100
      const batchSize = 100;
      for (let i = 0; i < toDelete.length; i += batchSize) {
        const batch = toDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase
          .from('content_queue')
          .delete()
          .in('id', batch);

        if (deleteError) {
          console.error('Error deleting batch:', deleteError);
        } else {
          console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}`);
        }
      }

      console.log('\n✅ Cleanup complete!');
    } else {
      console.log('\n✅ All content is Web3-focused! No cleanup needed.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanNonWeb3Content();