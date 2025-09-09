#!/usr/bin/env npx tsx

/**
 * Test retry mechanism
 */

import { retryFetcher } from './src/lib/retry-fetcher';

async function testRetry() {
  console.log('🔄 TESTING RETRY MECHANISM\n');
  
  // Test 1: Successful fetch
  console.log('1️⃣ Testing successful fetch...');
  try {
    const response = await retryFetcher.fetchWithRetry(
      'https://api.github.com/repos/nodejs/node',
      {},
      { maxRetries: 2 }
    );
    console.log('   ✅ Success:', response.status);
  } catch (error) {
    console.log('   ❌ Failed:', error);
  }
  
  // Test 2: Failed fetch with retries (non-existent URL)
  console.log('\n2️⃣ Testing failed fetch with retries...');
  let retryCount = 0;
  try {
    await retryFetcher.fetchWithRetry(
      'https://non-existent-domain-12345.com/api',
      {},
      {
        maxRetries: 2,
        initialDelay: 500,
        onRetry: (attempt) => {
          retryCount = attempt;
          console.log(`   🔄 Retry attempt ${attempt}`);
        }
      }
    );
  } catch (error) {
    console.log(`   ✅ Expected failure after ${retryCount} retries`);
  }
  
  // Test 3: Circuit breaker
  console.log('\n3️⃣ Testing circuit breaker...');
  const failedDomain = 'https://test-fail-domain.com';
  
  // Trigger multiple failures to open circuit
  for (let i = 0; i < 6; i++) {
    try {
      await retryFetcher.fetchWithRetry(
        `${failedDomain}/endpoint${i}`,
        {},
        { maxRetries: 0 }
      );
    } catch {
      // Expected to fail
    }
  }
  
  const status = retryFetcher.getCircuitBreakerStatus();
  const circuitState = status.get('test-fail-domain.com');
  if (circuitState?.state === 'open') {
    console.log('   ✅ Circuit breaker opened after failures');
  } else {
    console.log('   ❌ Circuit breaker not opened');
  }
  
  // Test 4: Batch fetch
  console.log('\n4️⃣ Testing batch fetch with retry...');
  const urls = [
    'https://api.github.com/repos/nodejs/node',
    'https://fail-domain.com/api',
    'https://api.github.com/repos/microsoft/typescript'
  ];
  
  const results = await retryFetcher.fetchBatchWithRetry(urls, {}, {
    maxRetries: 1,
    initialDelay: 500
  });
  
  const successful = results.filter(r => r.response).length;
  const failed = results.filter(r => r.error).length;
  console.log(`   ✅ Batch results: ${successful} successful, ${failed} failed`);
  
  console.log('\n✅ Retry mechanism test complete');
}

testRetry().catch(console.error);