#!/usr/bin/env tsx

import 'dotenv/config';
import { scoreContent } from '../lib/openai';

async function testScoring() {

  const testContent = {
    title: 'Web3 Social Protocol',
    description: 'A decentralized social media protocol built on Ethereum, enabling users to own their data and monetize their content through NFTs.',
    url: 'https://example.com/web3-social',
    team_size: 5,
    funding_raised: 2000000
  };

  try {
    const result = await scoreContent(testContent, 'project');
    
    if (result) {

      if (result.team_score) {console.log(`  Team: ${result.team_score}/10`);}
      if (result.traction_score) {console.log(`  Traction: ${result.traction_score}/10`);}

    } else {

    }
  } catch (error) {

  }

}

testScoring().catch(console.error);