// REAL test - no fakes, no mocks
require('dotenv').config();
const OpenAI = require('openai');

async function testOpenAI() {
  console.log('🔍 CRITICAL TEST - Is OpenAI Really Working?');
  console.log('=====================================');
  
  // Check environment
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log('❌ FAIL: No OpenAI API key in environment');
    return false;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 20) + '...');
  
  // Try to create client
  let client;
  try {
    client = new OpenAI.OpenAI({ apiKey });
    console.log('✅ Client created successfully');
  } catch (error) {
    console.log('❌ FAIL: Could not create OpenAI client:', error.message);
    return false;
  }
  
  // Make a REAL API call
  console.log('\n📞 Making REAL API call to OpenAI...');
  try {
    const startTime = Date.now();
    const response = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Reply with exactly: "REAL API WORKING"'
        }
      ],
      max_tokens: 10
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`⏱️ Response time: ${elapsed}ms`);
    
    const content = response.choices[0].message.content;
    console.log('📬 Response:', content);
    
    if (content.includes('REAL API WORKING')) {
      console.log('\n✅✅✅ SUCCESS: OpenAI API is REALLY working!');
      return true;
    } else {
      console.log('❌ FAIL: Unexpected response');
      return false;
    }
  } catch (error) {
    console.log('❌ FAIL: API call failed:', error.message);
    if (error.message.includes('401')) {
      console.log('   → API key is invalid or expired');
    } else if (error.message.includes('429')) {
      console.log('   → Rate limit exceeded');
    } else if (error.message.includes('network')) {
      console.log('   → Network error');
    }
    return false;
  }
}

testOpenAI().then(result => {
  console.log('\n=====================================');
  console.log(result ? '✅ TEST PASSED' : '❌ TEST FAILED');
  process.exit(result ? 0 : 1);
});