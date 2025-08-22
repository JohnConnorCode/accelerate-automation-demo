const { SimpleScorer } = require('./dist/core/simple-scorer.js');

const scorer = new SimpleScorer();

const testContent = {
  title: 'Build AI-Powered Web3 DeFi Protocol',
  description: 'A comprehensive platform leveraging artificial intelligence for automated yield farming on blockchain. Features smart contract generation, ML-based risk assessment, and decentralized governance. Built by experienced developers with $2M seed funding from top VCs.',
  url: 'https://example.com',
  created_at: new Date().toISOString(),
  team_size: 5,
  funding_raised: 2000000
};

const result = scorer.score(testContent);
console.log('Score Result:', JSON.stringify(result, null, 2));
