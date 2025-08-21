#!/usr/bin/env tsx

import 'dotenv/config';
import { scoreContent } from '../lib/openai';

async function testScoring() {
  console.log('🧠 Testing AI scoring...\n');
  
  const testContent = {
    title: 'Web3 Social Protocol',
    description: 'A decentralized social media protocol built on Ethereum, enabling users to own their data and monetize their content through NFTs.',
    url: 'https://example.com/web3-social',
    team_size: 5,
    funding_raised: 2000000
  };
  
  console.log('Testing with sample content:');
  console.log(`Title: ${testContent.title}`);
  console.log(`Description: ${testContent.description}`);
  console.log('');
  
  try {
    const result = await scoreContent(testContent, 'project');
    
    if (result) {
      console.log('✅ Scoring successful!');
      console.log('Scores:');
      console.log(`  Relevance: ${result.relevance_score}/10`);
      console.log(`  Quality: ${result.quality_score}/10`);
      console.log(`  Urgency: ${result.urgency_score}/10`);
      if (result.team_score) console.log(`  Team: ${result.team_score}/10`);
      if (result.traction_score) console.log(`  Traction: ${result.traction_score}/10`);
      console.log('');
      console.log('AI Summary:', result.ai_summary);
      console.log('AI Reasoning:', result.ai_reasoning);
      console.log('Confidence:', result.confidence);
    } else {
      console.log('⚠️ No scoring result (OpenAI may not be configured)');
    }
  } catch (error) {
    console.error('❌ Scoring failed:', error);
  }
  
  console.log('\n✨ Test complete!');
}

testScoring().catch(console.error);