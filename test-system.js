#!/usr/bin/env node

// Load environment variables
require('dotenv').config({ path: '.env.local' });

console.log('🚀 Testing Accelerate Content Automation System\n');
console.log('Environment check:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configured' : '❌ Missing');
console.log('  SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Configured' : '❌ Missing');
console.log('  CRON_SECRET:', process.env.CRON_SECRET ? '✅ Configured' : '❌ Missing');
console.log('');

// Test health endpoint
console.log('Testing health endpoint...');
const healthHandler = require('./dist/api/health').default;

healthHandler({}, {
  status: (code) => ({
    json: (data) => {
      console.log(`  Status: ${code}`);
      console.log(`  Response:`, data);
      
      if (data.status === 'healthy') {
        console.log('  ✅ Health check passed!\n');
        testQueueEndpoint();
      } else {
        console.log('  ❌ Health check failed\n');
      }
    }
  })
}).catch(err => {
  console.error('  ❌ Error:', err.message);
});

function testQueueEndpoint() {
  console.log('Testing queue endpoint...');
  const queueHandler = require('./dist/api/admin/queue').default;
  
  queueHandler(
    { 
      method: 'GET',
      query: { status: 'pending' }
    },
    {
      setHeader: () => {},
      status: (code) => ({
        json: (data) => {
          console.log(`  Status: ${code}`);
          console.log(`  Pending items: ${data.data ? data.data.length : 0}`);
          
          if (data.success) {
            console.log('  ✅ Queue endpoint working!\n');
            console.log('✨ All tests passed! System is ready.\n');
            console.log('Next steps:');
            console.log('  1. Deploy to Vercel: npm run deploy');
            console.log('  2. View admin dashboard: open public/admin.html');
            console.log('  3. Trigger manual fetch: Use admin dashboard');
          } else {
            console.log('  ❌ Queue endpoint failed');
          }
        }
      })
    }
  ).catch(err => {
    console.error('  ❌ Error:', err.message);
  });
}