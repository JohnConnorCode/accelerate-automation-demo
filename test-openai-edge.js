const { contentScorer } = require('./dist/lib/content-scorer-openai.js');

async function test() {
  const testContent = {
    title: 'Build AI-Powered DeFi Protocol',
    description: 'Revolutionary Web3 platform for automated yield farming using machine learning'
  };

  console.log('Testing OpenAI scoring via Supabase Edge Function...');
  const result = await contentScorer.scoreContent(testContent);
  console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
