const https = require('https');

console.log('🔍 TESTING PRODUCTION DEPLOYMENT...\n');

function testEndpoint(url, name) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`${name}:`);
        console.log(`  Status: ${res.statusCode} ${res.statusCode === 200 ? '✅' : '❌'}`);
        console.log(`  Content Length: ${data.length} bytes`);

        // Check for React app
        if (data.includes('<div id="root">')) {
          console.log('  React App: ✅ Detected');
        }

        // Check for error messages
        if (data.includes('Error') || data.includes('error')) {
          const errorCount = (data.match(/error/gi) || []).length;
          console.log(`  Errors Found: ${errorCount} occurrences`);
        }

        resolve({ name, status: res.statusCode, length: data.length });
      });
    }).on('error', (err) => {
      console.log(`${name}: ❌ Failed - ${err.message}`);
      resolve({ name, status: 0, error: err.message });
    });
  });
}

async function runTests() {
  const baseUrl = 'https://accelerate-content-automation-o3ujupvag.vercel.app';

  // Test main routes
  const routes = [
    { url: `${baseUrl}/`, name: '1️⃣ Homepage' },
    { url: `${baseUrl}/dashboard`, name: '2️⃣ Dashboard' },
    { url: `${baseUrl}/content-queue`, name: '3️⃣ Content Queue' },
    { url: `${baseUrl}/analytics`, name: '4️⃣ Analytics' }
  ];

  const results = [];

  for (const route of routes) {
    const result = await testEndpoint(route.url, route.name);
    results.push(result);
    console.log('');
  }

  // Test data connection
  console.log('5️⃣ Testing Supabase Connection:');
  const supabaseUrl = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
  https.get(`${supabaseUrl}/rest/v1/`, (res) => {
    console.log(`  API Status: ${res.statusCode === 200 ? '✅ Accessible' : `⚠️ Status ${res.statusCode}`}`);
  }).on('error', () => {
    console.log('  API Status: ❌ Not accessible');
  });

  // Summary
  setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PRODUCTION TEST SUMMARY:');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.status === 200).length;
    const failed = results.filter(r => r.status !== 200).length;

    console.log(`✅ Successful: ${successful}/${results.length} routes`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}/${results.length} routes`);
    }

    if (successful === results.length) {
      console.log('\n🎉 PRODUCTION IS FULLY OPERATIONAL!');
      console.log('🔗 Live at: https://accelerate-content-automation-o3ujupvag.vercel.app');
    } else {
      console.log('\n⚠️ PRODUCTION HAS SOME ISSUES');
      console.log('Please check the failed routes above');
    }
  }, 2000);
}

runTests();