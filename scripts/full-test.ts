#!/usr/bin/env tsx

/**
 * Full end-to-end test of the Web3 content pipeline
 */

import { supabase } from '../src/lib/supabase-client';
import { UnifiedOrchestrator } from '../src/core/unified-orchestrator';
import { AccelerateValidator } from '../src/validators/accelerate-validator';

async function fullTest() {
  console.log('🧪 FULL END-TO-END TEST OF WEB3 CONTENT PIPELINE\n');
  console.log('=' .repeat(60));

  try {
    // 1. Clear existing content
    console.log('\n1️⃣ Clearing existing content...');
    const { error: clearError } = await supabase
      .from('content_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

    if (clearError && clearError.code !== 'PGRST116') {
      throw clearError;
    }
    console.log('   ✅ Database cleared');

    // 2. Run the orchestrator to fetch fresh content
    console.log('\n2️⃣ Fetching fresh Web3 content...');
    const orchestrator = new UnifiedOrchestrator();
    const result = await orchestrator.run();

    console.log(`   📊 Fetch Results:`);
    console.log(`      Total fetched: ${result.fetched}`);
    console.log(`      Passed Web3 validation: ${result.validated}`);
    console.log(`      Unique items: ${result.unique}`);
    console.log(`      Inserted to queue: ${result.inserted}`);
    console.log(`      Success rate: ${((result.validated/result.fetched)*100).toFixed(1)}%`);

    // 3. Analyze what was inserted
    console.log('\n3️⃣ Analyzing inserted content...');
    const { data: queueItems, error: fetchError } = await supabase
      .from('content_queue')
      .select('*')
      .order('accelerate_score', { ascending: false });

    if (fetchError) throw fetchError;

    console.log(`   📋 Queue contains ${queueItems?.length || 0} items`);

    // Group by type
    const byType = {
      projects: queueItems?.filter(i => i.type === 'project') || [],
      funding: queueItems?.filter(i => i.type === 'funding') || [],
      resources: queueItems?.filter(i => i.type === 'resource') || []
    };

    console.log(`      Projects: ${byType.projects.length}`);
    console.log(`      Funding: ${byType.funding.length}`);
    console.log(`      Resources: ${byType.resources.length}`);

    // 4. Show top Web3 content
    console.log('\n4️⃣ Top Web3 Content (by score):');
    const topItems = queueItems?.slice(0, 5) || [];

    for (const item of topItems) {
      console.log(`\n   📌 ${item.title || item.name || 'Untitled'}`);
      console.log(`      Type: ${item.type}`);
      console.log(`      Score: ${item.accelerate_score || 'N/A'}`);
      console.log(`      Source: ${item.source}`);

      // Verify it's actually Web3
      const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
      const web3Keywords = ['blockchain', 'crypto', 'defi', 'web3', 'ethereum',
                           'solana', 'nft', 'smart contract', 'decentralized'];
      const matches = web3Keywords.filter(kw => text.includes(kw));
      console.log(`      Web3 Keywords: ${matches.join(', ') || 'NONE (ERROR!)'}`);

      if (matches.length < 2) {
        console.log(`      ⚠️ WARNING: Less than 2 Web3 keywords!`);
      }
    }

    // 5. Test validation directly
    console.log('\n5️⃣ Testing Validator Strictness:');
    const testItems = [
      { title: 'AI Startup', description: 'Machine learning platform' },
      { title: 'Crypto Wallet', description: 'Store your digital assets' },
      { title: 'DeFi Protocol', description: 'Decentralized finance on Ethereum blockchain' },
      { title: 'NFT Marketplace', description: 'Trade NFTs on Solana with smart contracts' }
    ];

    for (const test of testItems) {
      const result = AccelerateValidator.validate({
        ...test,
        id: 'test',
        type: 'project',
        url: 'https://test.com',
        source: 'test',
        created_at: new Date().toISOString()
      });
      const status = result.isValid ? '✅' : '❌';
      console.log(`   ${status} "${test.title}": ${result.isValid ? 'PASS' : 'FAIL'}`);
    }

    // 6. Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY:');
    console.log(`   ✅ Pipeline functional: ${result.success ? 'YES' : 'NO'}`);
    console.log(`   ✅ Web3 filter working: ${result.validated < result.fetched ? 'YES (strict)' : 'NO (too loose)'}`);
    console.log(`   ✅ Content quality: ${queueItems && queueItems.length > 0 ? 'Has content' : 'No content'}`);

    const hasRealWeb3 = topItems.every(item => {
      const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
      const web3Keywords = ['blockchain', 'crypto', 'defi', 'web3', 'ethereum',
                           'solana', 'nft', 'smart contract', 'decentralized'];
      return web3Keywords.filter(kw => text.includes(kw)).length >= 2;
    });

    console.log(`   ✅ All content is Web3: ${hasRealWeb3 ? 'YES' : 'NO (PROBLEM!)'}`);
    console.log('\n✅ Test complete!');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

fullTest();
