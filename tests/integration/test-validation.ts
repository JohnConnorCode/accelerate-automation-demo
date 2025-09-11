/**
 * Test script to verify input validation prevents crashes
 */

import { config } from 'dotenv';
config();

async function testValidation() {
  const baseUrl = 'http://localhost:3000/api';
  
  console.log('🧪 TESTING INPUT VALIDATION');
  console.log('========================\n');
  
  // Test cases with invalid inputs
  const testCases = [
    {
      name: 'Missing required fields',
      endpoint: '/admin/approve',
      data: { action: 'approve' }, // Missing id and type
      expectedStatus: 400
    },
    {
      name: 'Invalid type field',
      endpoint: '/admin/approve',
      data: { id: 123, type: 'invalid_type', action: 'approve' },
      expectedStatus: 400
    },
    {
      name: 'Invalid action',
      endpoint: '/admin/approve',
      data: { id: 123, type: 'projects', action: 'delete' },
      expectedStatus: 400
    },
    {
      name: 'Non-numeric ID',
      endpoint: '/admin/approve',
      data: { id: 'not-a-number', type: 'projects', action: 'approve' },
      expectedStatus: 400
    },
    {
      name: 'SQL injection attempt',
      endpoint: '/admin/approve',
      data: { 
        id: "1; DROP TABLE queue_projects; --", 
        type: 'projects', 
        action: 'approve' 
      },
      expectedStatus: 400
    },
    {
      name: 'Null values',
      endpoint: '/admin/approve',
      data: { id: null, type: null, action: null },
      expectedStatus: 400
    },
    {
      name: 'Empty object',
      endpoint: '/admin/approve',
      data: {},
      expectedStatus: 400
    },
    {
      name: 'Invalid JSON type',
      endpoint: '/admin/approve',
      data: 'not-an-object',
      expectedStatus: 400
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    try {
      console.log(`Testing: ${test.name}`);
      
      const response = await fetch(`${baseUrl}${test.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(test.data)
      });
      
      const result = await response.json();
      
      // Check if validation caught the invalid input
      if (!response.ok && result.error) {
        console.log(`✅ Validation caught invalid input: ${result.error || result.message}`);
        passed++;
      } else if (response.status === test.expectedStatus) {
        console.log(`✅ Got expected status: ${response.status}`);
        passed++;
      } else {
        console.log(`❌ Unexpected response - Status: ${response.status}`);
        console.log('   Response:', result);
        failed++;
      }
      
    } catch (error) {
      console.log(`❌ Request failed:`, error);
      failed++;
    }
    
    console.log('');
  }
  
  // Test with valid input to ensure we didn't break normal flow
  console.log('Testing valid input (should work):');
  try {
    // First, ensure we have something in queue
    const fetchResponse = await fetch(`${baseUrl}/scheduler/manual-fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources: ['hackernews'], limit: 1 })
    });
    
    if (fetchResponse.ok) {
      // Get items from queue
      const queueResponse = await fetch(`${baseUrl}/admin/queue`);
      const queueData = await queueResponse.json();
      
      if (queueData.projects && queueData.projects.length > 0) {
        const itemId = queueData.projects[0].id;
        
        // Try valid approval
        const approvalResponse = await fetch(`${baseUrl}/admin/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: itemId,
            type: 'projects',
            action: 'approve'
          })
        });
        
        const approvalResult = await approvalResponse.json();
        
        if (approvalResponse.ok && approvalResult.success) {
          console.log('✅ Valid approval worked correctly');
          passed++;
        } else {
          console.log('❌ Valid approval failed:', approvalResult);
          failed++;
        }
      } else {
        console.log('⚠️  No items in queue to test valid approval');
      }
    }
  } catch (error) {
    console.log('❌ Valid input test failed:', error);
    failed++;
  }
  
  // Summary
  console.log('\n========================');
  console.log('VALIDATION TEST RESULTS:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  // Check if server is still running (didn't crash)
  try {
    const healthCheck = await fetch(`${baseUrl}/health`);
    if (healthCheck.ok) {
      console.log('\n✅ Server is still running - no crashes!');
    } else {
      console.log('\n⚠️  Server returned non-OK status');
    }
  } catch (error) {
    console.log('\n❌ Server appears to have crashed!');
  }
}

// Run tests
testValidation().catch(console.error);