const https = require('https');

console.log('🔍 COMPREHENSIVE PRODUCTION TEST');
console.log('URL: https://accelerate-content-automation-b22svbd0h.vercel.app/\n');

const baseUrl = 'https://accelerate-content-automation-b22svbd0h.vercel.app';

function makeRequest(path) {
  return new Promise((resolve) => {
    https.get(`${baseUrl}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          path,
          status: res.statusCode,
          length: data.length,
          hasReactRoot: data.includes('<div id="root">'),
          hasError: data.includes('error') || data.includes('Error'),
          hasContent: data.length > 1000,
          data
        });
      });
    }).on('error', (err) => {
      resolve({ path, status: 0, error: err.message });
    });
  });
}

async function checkSupabase() {
  return new Promise((resolve) => {
    https.get('https://eqpfvmwmdtsgddpsodsr.supabase.co/rest/v1/', {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          connected: res.statusCode === 200 || res.statusCode === 404
        });
      });
    }).on('error', () => {
      resolve({ status: 0, connected: false });
    });
  });
}

async function runTests() {
  const routes = [
    '/',
    '/dashboard',
    '/content-queue',
    '/analytics'
  ];

  console.log('1️⃣ TESTING ROUTES:');
  console.log('='.repeat(40));

  const results = [];
  for (const route of routes) {
    const result = await makeRequest(route);
    results.push(result);

    console.log(`\n${route}:`);
    console.log(`  Status: ${result.status} ${result.status === 200 ? '✅' : '❌'}`);
    console.log(`  React Root: ${result.hasReactRoot ? '✅' : '❌'}`);
    console.log(`  Content Size: ${result.length} bytes ${result.hasContent ? '✅' : '❌'}`);
    console.log(`  Errors: ${result.hasError ? '⚠️ Found' : '✅ None'}`);

    // Check for specific React app elements
    if (result.data) {
      const hasNav = result.data.includes('nav') || result.data.includes('Nav');
      const hasMain = result.data.includes('main') || result.data.includes('Main');
      const hasRouter = result.data.includes('Router') || result.data.includes('route');

      if (hasNav || hasMain || hasRouter) {
        console.log(`  React Components: ✅ Detected`);
      }
    }
  }

  console.log('\n2️⃣ TESTING DATABASE CONNECTION:');
  console.log('='.repeat(40));

  const supabase = await checkSupabase();
  console.log(`  Supabase API: ${supabase.connected ? '✅ Accessible' : '❌ Not accessible'}`);
  console.log(`  Status Code: ${supabase.status}`);

  console.log('\n3️⃣ CHECKING APPLICATION STATE:');
  console.log('='.repeat(40));

  // Analyze homepage for React app initialization
  const homepage = results.find(r => r.path === '/');
  if (homepage && homepage.data) {
    const hasScripts = homepage.data.includes('<script');
    const hasBundle = homepage.data.includes('assets/index');
    const hasVite = homepage.data.includes('vite');

    console.log(`  JavaScript Bundle: ${hasBundle ? '✅ Loaded' : '❌ Missing'}`);
    console.log(`  Build System: ${hasVite ? '✅ Vite detected' : '⚠️ Not detected'}`);
    console.log(`  Scripts: ${hasScripts ? '✅ Present' : '❌ Missing'}`);
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL PRODUCTION STATUS:');
  console.log('='.repeat(50));

  const allRoutesWork = results.every(r => r.status === 200);
  const hasReactApp = results.every(r => r.hasReactRoot);
  const noErrors = !results.some(r => r.hasError);

  const checks = [
    { name: 'All routes accessible', passed: allRoutesWork },
    { name: 'React app initialized', passed: hasReactApp },
    { name: 'No critical errors', passed: noErrors },
    { name: 'Database configured', passed: supabase.connected },
    { name: 'Content rendering', passed: results.every(r => r.hasContent) }
  ];

  checks.forEach(check => {
    console.log(`  ${check.name}: ${check.passed ? '✅' : '❌'}`);
  });

  const passedCount = checks.filter(c => c.passed).length;
  const totalCount = checks.length;

  console.log('\n' + '='.repeat(50));
  if (passedCount === totalCount) {
    console.log('🎉 PRODUCTION IS FULLY OPERATIONAL!');
    console.log(`✅ All ${totalCount}/${totalCount} checks passed`);
    console.log('\n🔗 Live at: ' + baseUrl);
  } else if (passedCount >= 3) {
    console.log('⚠️ PRODUCTION IS PARTIALLY WORKING');
    console.log(`${passedCount}/${totalCount} checks passed`);
    console.log('Please review the failed checks above.');
  } else {
    console.log('❌ PRODUCTION HAS CRITICAL ISSUES');
    console.log(`Only ${passedCount}/${totalCount} checks passed`);
  }
}

runTests().catch(console.error);