#!/usr/bin/env node

const https = require('https');

console.log('🚀 Verifying Production Deployment...\n');

const tests = [];

// Test 1: Check if site is accessible
function testSiteAccessible() {
  return new Promise((resolve) => {
    https.get('https://accelerate-content-automation.vercel.app', (res) => {
      const success = res.statusCode === 200;
      tests.push({
        name: 'Site Accessibility',
        success,
        details: `Status Code: ${res.statusCode}`
      });
      resolve(success);
    }).on('error', (err) => {
      tests.push({
        name: 'Site Accessibility',
        success: false,
        details: `Error: ${err.message}`
      });
      resolve(false);
    });
  });
}

// Test 2: Check if HTML contains critical elements
function testHTMLContent() {
  return new Promise((resolve) => {
    https.get('https://accelerate-content-automation.vercel.app', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const hasRoot = data.includes('id="root"');
        const hasPolyfills = data.includes('window.Deferred');
        const hasPathPolyfill = data.includes('window.path');
        const hasScripts = data.includes('index-');
        
        const success = hasRoot && hasPolyfills && hasPathPolyfill && hasScripts;
        
        tests.push({
          name: 'HTML Content Check',
          success,
          details: `Root: ${hasRoot}, Polyfills: ${hasPolyfills}, Path: ${hasPathPolyfill}, Scripts: ${hasScripts}`
        });
        resolve(success);
      });
    }).on('error', (err) => {
      tests.push({
        name: 'HTML Content Check',
        success: false,
        details: `Error: ${err.message}`
      });
      resolve(false);
    });
  });
}

// Test 3: Check if JavaScript bundles are accessible
function testJavaScriptBundles() {
  return new Promise((resolve) => {
    https.get('https://accelerate-content-automation.vercel.app', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const match = data.match(/\/assets\/index-[A-Za-z0-9]+\.js/);
        if (match) {
          const jsUrl = `https://accelerate-content-automation.vercel.app${match[0]}`;
          https.get(jsUrl, (jsRes) => {
            const success = jsRes.statusCode === 200;
            tests.push({
              name: 'JavaScript Bundle',
              success,
              details: `Bundle accessible at ${match[0]} (Status: ${jsRes.statusCode})`
            });
            resolve(success);
          }).on('error', (err) => {
            tests.push({
              name: 'JavaScript Bundle',
              success: false,
              details: `Error accessing bundle: ${err.message}`
            });
            resolve(false);
          });
        } else {
          tests.push({
            name: 'JavaScript Bundle',
            success: false,
            details: 'No JavaScript bundle found in HTML'
          });
          resolve(false);
        }
      });
    });
  });
}

// Run all tests
async function runTests() {
  console.log('Running tests...\n');
  
  await testSiteAccessible();
  await testHTMLContent();
  await testJavaScriptBundles();
  
  // Print results
  console.log('='.repeat(50));
  console.log('TEST RESULTS');
  console.log('='.repeat(50));
  
  tests.forEach(test => {
    const icon = test.success ? '✅' : '❌';
    console.log(`${icon} ${test.name}: ${test.success ? 'PASSED' : 'FAILED'}`);
    console.log(`   ${test.details}`);
  });
  
  const passed = tests.filter(t => t.success).length;
  const total = tests.length;
  const allPassed = passed === total;
  
  console.log('='.repeat(50));
  console.log(`SUMMARY: ${passed}/${total} tests passed`);
  console.log('='.repeat(50));
  
  if (allPassed) {
    console.log('\n✅ All tests passed! The deployment is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Please check the details above.');
  }
  
  process.exit(allPassed ? 0 : 1);
}

runTests();