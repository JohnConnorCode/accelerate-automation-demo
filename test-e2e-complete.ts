/**
 * End-to-End Test: Complete approval workflow with crash prevention
 */
import { config } from 'dotenv';
config();

const API_URL = 'http://localhost:3000/api';

async function runE2ETest() {
  console.log('🎯 END-TO-END TEST: APPROVAL WORKFLOW');
  console.log('=====================================\n');
  
  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // TEST 1: Malformed requests don't crash server
  console.log('1️⃣ Testing crash prevention...');
  const crashTests = [
    { payload: null, name: 'NULL payload' },
    { payload: 'not an object', name: 'String payload' },
    { payload: [1, 2, 3], name: 'Array payload' },
    { payload: { id: "'; DROP TABLE--", type: 'projects', action: 'approve' }, name: 'SQL injection' }
  ];
  
  for (const test of crashTests) {
    try {
      const response = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: test.payload === null ? null : JSON.stringify(test.payload)
      });
      
      if (response.status === 400) {
        console.log(`   ✅ ${test.name}: Properly rejected`);
        testResults.passed++;
      } else {
        console.log(`   ❌ ${test.name}: Unexpected status ${response.status}`);
        testResults.failed++;
      }
    } catch (error) {
      console.log(`   ❌ ${test.name}: Server crashed`);
      testResults.failed++;
      testResults.errors.push(error);
    }
  }
  
  // TEST 2: Server health check
  console.log('\n2️⃣ Testing server health...');
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    
    if (healthData.status === 'healthy') {
      console.log('   ✅ Server is healthy');
      testResults.passed++;
    } else {
      console.log('   ❌ Server is unhealthy');
      testResults.failed++;
    }
  } catch (error) {
    console.log('   ❌ Health check failed');
    testResults.failed++;
  }
  
  // TEST 3: Validation errors return proper messages
  console.log('\n3️⃣ Testing validation messages...');
  const validationTests = [
    {
      payload: { id: 1, type: 'invalid_type', action: 'approve' },
      expectedError: 'Invalid type'
    },
    {
      payload: { id: 1, type: 'projects', action: 'invalid_action' },
      expectedError: 'Invalid action'
    },
    {
      payload: { type: 'projects', action: 'approve' },
      expectedError: 'Missing required fields'
    }
  ];
  
  for (const test of validationTests) {
    try {
      const response = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });
      
      const data = await response.json();
      
      if (!data.success && data.message.includes(test.expectedError)) {
        console.log(`   ✅ ${test.expectedError}: Correct error message`);
        testResults.passed++;
      } else {
        console.log(`   ❌ ${test.expectedError}: Wrong error message`);
        testResults.failed++;
      }
    } catch (error) {
      console.log(`   ❌ ${test.expectedError}: Failed to validate`);
      testResults.failed++;
    }
  }
  
  // TEST 4: Check queue endpoint
  console.log('\n4️⃣ Testing queue endpoints...');
  try {
    const queueResponse = await fetch(`${API_URL}/queue/projects`);
    const queueData = await queueResponse.json();
    
    if (Array.isArray(queueData)) {
      console.log(`   ✅ Queue endpoint returns array (${queueData.length} items)`);
      testResults.passed++;
    } else {
      console.log('   ❌ Queue endpoint returns invalid data');
      testResults.failed++;
    }
  } catch (error) {
    console.log('   ❌ Queue endpoint failed');
    testResults.failed++;
  }
  
  // TEST 5: Check data sources
  console.log('\n5️⃣ Testing data sources...');
  try {
    const sourcesResponse = await fetch(`${API_URL}/sources`);
    const sourcesData = await sourcesResponse.json();
    
    if (sourcesData.sources && Array.isArray(sourcesData.sources)) {
      console.log(`   ✅ Sources endpoint works (${sourcesData.sources.length} sources)`);
      testResults.passed++;
    } else {
      console.log('   ❌ Sources endpoint returns invalid data');
      testResults.failed++;
    }
  } catch (error) {
    console.log('   ❌ Sources endpoint failed');
    testResults.failed++;
  }
  
  // Final Results
  console.log('\n=====================================');
  console.log('📊 TEST RESULTS:');
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  
  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✨ The approval service is crash-resistant and fully functional.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors.');
    if (testResults.errors.length > 0) {
      console.log('\nErrors:', testResults.errors);
    }
  }
  
  return testResults.failed === 0;
}

// Run the test
runE2ETest()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });