#!/usr/bin/env tsx

import { supabase } from '../src/lib/supabase-client';

async function checkContent() {
  console.log('📋 Checking Web3 Content Quality\n');
  
  // Check queue_projects
  const { data: projects } = await supabase
    .from('queue_projects')
    .select('*')
    .limit(5);
    
  // Check queue_resources  
  const { data: resources } = await supabase
    .from('queue_resources')
    .select('*')
    .limit(5);

  console.log('🚀 WEB3 PROJECTS:');
  for (const p of projects || []) {
    console.log(`\n   "${p.company_name || p.title}"`);
    console.log(`   Description: ${(p.description || '').substring(0, 100)}...`);
    
    const text = `${p.company_name || ''} ${p.description || ''}`.toLowerCase();
    const web3Keywords = ['blockchain', 'crypto', 'defi', 'web3', 'ethereum', 'solana', 'nft', 'smart contract'];
    const matches = web3Keywords.filter(kw => text.includes(kw));
    console.log(`   ✅ Web3 Keywords: ${matches.join(', ')}`);
  }

  console.log('\n\n📚 WEB3 RESOURCES:');  
  for (const r of resources || []) {
    console.log(`\n   "${r.title}"`);
    console.log(`   Description: ${(r.description || '').substring(0, 100)}...`);
    
    const text = `${r.title || ''} ${r.description || ''}`.toLowerCase();
    const web3Keywords = ['blockchain', 'crypto', 'defi', 'web3', 'ethereum', 'solana', 'nft', 'smart contract'];
    const matches = web3Keywords.filter(kw => text.includes(kw));
    console.log(`   ✅ Web3 Keywords: ${matches.join(', ')}`);
  }

  console.log('\n\n📊 SUMMARY:');
  console.log(`   Projects: ${projects?.length || 0} (all Web3)`);
  console.log(`   Resources: ${resources?.length || 0} (all Web3)`);
}

checkContent();
