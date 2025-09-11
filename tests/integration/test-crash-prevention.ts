/**
 * Comprehensive crash prevention test
 * Tests all validation scenarios to ensure server doesn't crash
 */
import { config } from 'dotenv';
config();

const API_URL = 'http://localhost:3000/api';

interface TestCase {
  name: string;
  endpoint: string;
  method: string;
  payload: any;
  expectSuccess: boolean;
}

const testCases: TestCase[] = [
  // NULL/UNDEFINED TESTS
  {
    name: 'NULL payload',
    endpoint: '/approve',
    method: 'POST',
    payload: null,
    expectSuccess: false
  },
  {
    name: 'Empty object',
    endpoint: '/approve',
    method: 'POST',
    payload: {},
    expectSuccess: false
  },
  {
    name: 'Missing required fields',
    endpoint: '/approve',
    method: 'POST',
    payload: { action: 'approve' },
    expectSuccess: false
  },
  
  // INVALID TYPE TESTS
  {
    name: 'Invalid type field',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1, type: 'invalid', action: 'approve' },
    expectSuccess: false
  },
  {
    name: 'Type as number',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1, type: 123, action: 'approve' },
    expectSuccess: false
  },
  
  // INVALID ACTION TESTS
  {
    name: 'Invalid action field',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1, type: 'projects', action: 'delete' },
    expectSuccess: false
  },
  {
    name: 'Action as number',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1, type: 'projects', action: 123 },
    expectSuccess: false
  },
  
  // MALFORMED DATA TESTS
  {
    name: 'String instead of object',
    endpoint: '/approve',
    method: 'POST',
    payload: 'not an object',
    expectSuccess: false
  },
  {
    name: 'Array instead of object',
    endpoint: '/approve',
    method: 'POST',
    payload: [1, 2, 3],
    expectSuccess: false
  },
  
  // SQL INJECTION ATTEMPTS
  {
    name: 'SQL injection in ID',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: "1; DROP TABLE users;", type: 'projects', action: 'approve' },
    expectSuccess: false
  },
  {
    name: 'SQL injection in type',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1, type: "projects'; DROP TABLE--", action: 'approve' },
    expectSuccess: false
  },
  
  // VALID BUT NON-EXISTENT
  {
    name: 'Valid format but non-existent ID',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 999999, type: 'projects', action: 'approve' },
    expectSuccess: false
  },
  
  // EDGE CASES
  {
    name: 'Negative ID',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: -1, type: 'projects', action: 'approve' },
    expectSuccess: false
  },
  {
    name: 'Float ID',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: 1.5, type: 'projects', action: 'approve' },
    expectSuccess: false
  },
  {
    name: 'Very large ID',
    endpoint: '/approve',
    method: 'POST',
    payload: { id: Number.MAX_SAFE_INTEGER, type: 'projects', action: 'approve' },
    expectSuccess: false
  }
];

async function runTest(test: TestCase): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}${test.endpoint}`, {
      method: test.method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: test.payload === null ? null : JSON.stringify(test.payload)
    });
    
    const data = await response.json();
    
    // Server should respond with proper error, not crash
    if (!test.expectSuccess && !data.success) {
      return true; // Expected failure
    }
    
    if (test.expectSuccess && data.success) {
      return true; // Expected success
    }
    
    console.error(`❌ ${test.name}: Unexpected result`, data);
    return false;
  } catch (error) {
    console.error(`❌ ${test.name}: Server crashed or returned invalid JSON`, error);
    return false;
  }
}

async function runAllTests() {
  console.log('🛡️ CRASH PREVENTION TEST SUITE');
  console.log('================================\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    process.stdout.write(`Testing: ${test.name}... `);
    const result = await runTest(test);
    
    if (result) {
      console.log('✅ PASSED');
      passed++;
    } else {
      console.log('❌ FAILED');
      failed++;
    }
  }
  
  console.log('\n================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Server is crash-resistant.');
  } else {
    console.log('⚠️  Some tests failed. Check server logs for details.');
  }
  
  // Test server is still responsive
  console.log('\n🔍 Checking server health...');
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Server is still responsive');
    } else {
      console.log('⚠️  Server returned non-OK status');
    }
  } catch (error) {
    console.log('❌ Server appears to be down');
  }
}

// Run tests
runAllTests().catch(console.error);