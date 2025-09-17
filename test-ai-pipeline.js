async function testAIPipeline() {
  console.log('🧪 Testing AI Pipeline with OpenAI...\n');
  
  // Test 1: AI Assessment
  console.log('1️⃣ Testing AI Assessment:');
  const assessRes = await fetch('http://localhost:3000/api/ai-assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'New AI startup raises $50M Series B to build developer tools for autonomous coding agents'
    })
  });
  
  if (assessRes.ok) {
    const result = await assessRes.json();
    console.log('✅ AI Assessment:', result);
  } else {
    console.log('❌ AI Assessment failed:', assessRes.status);
  }
  
  // Test 2: Trigger full pipeline
  console.log('\n2️⃣ Triggering full pipeline with AI scoring:');
  const runRes = await fetch('http://localhost:3000/api/scheduler/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'content-fetch' })
  });
  
  if (runRes.ok) {
    const result = await runRes.json();
    console.log('✅ Pipeline triggered:', result);
  } else {
    console.log('❌ Pipeline failed:', runRes.status);
  }
}

testAIPipeline().catch(console.error);
