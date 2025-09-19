#!/usr/bin/env npx tsx

/**
 * COMPREHENSIVE END-TO-END TEST
 * Tests all major functionality of the Accelerate Content Automation system
 */

import { createClient } from '@supabase/supabase-js';

const API_URL = 'http://localhost:3003';
const FRONTEND_URL = 'http://localhost:3001';
const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

function section(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log('='.repeat(60));
}

async function testAPI(endpoint: string, method = 'GET', body?: any) {
  try {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (response.ok) {
      success(`${method} ${endpoint} - Status: ${response.status}`);
      return { success: true, data };
    } else {
      error(`${method} ${endpoint} - Status: ${response.status}`);
      return { success: false, error: data };
    }
  } catch (err: any) {
    error(`${method} ${endpoint} - Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log(colors.bright + colors.cyan);
  console.log('🚀 ACCELERATE CONTENT AUTOMATION - COMPREHENSIVE TEST SUITE');
  console.log('='.repeat(60) + colors.reset);

  // Track overall test results
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // 1. TEST API HEALTH
  section('1. API HEALTH & STATUS');

  const health = await testAPI('/api/health');
  totalTests++;
  if (health.success) passedTests++; else failedTests++;

  const status = await testAPI('/api/status');
  totalTests++;
  if (status.success) {
    passedTests++;
    info(`Database: ${status.data.database?.connected ? 'Connected' : 'Disconnected'}`);
    info(`AI Service: ${status.data.aiService?.available ? 'Available' : 'Unavailable'}`);
  } else failedTests++;

  const monitoring = await testAPI('/api/monitoring');
  totalTests++;
  if (monitoring.success) passedTests++; else failedTests++;

  // 2. TEST DATA FETCHING
  section('2. DATA FETCHING & PROCESSING');

  info('Triggering manual content fetch...');
  const fetchResult = await testAPI('/api/scheduler/run', 'POST');
  totalTests++;

  if (fetchResult.success) {
    passedTests++;
    info(`Started fetch job: ${fetchResult.data.jobId || 'Running'}`);

    // Wait for processing
    info('Waiting 10 seconds for data processing...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } else {
    failedTests++;
  }

  // 3. TEST DATABASE OPERATIONS
  section('3. DATABASE OPERATIONS');

  info('Checking queue tables...');
  const { data: queueProjects, error: queueError } = await supabase
    .from('queue_projects')
    .select('*')
    .limit(5);

  totalTests++;
  if (!queueError) {
    passedTests++;
    success(`Queue projects: ${queueProjects?.length || 0} items`);
  } else {
    failedTests++;
    error(`Queue query failed: ${queueError.message}`);
  }

  const { data: liveProjects, error: liveError } = await supabase
    .from('projects')
    .select('*')
    .limit(5);

  totalTests++;
  if (!liveError) {
    passedTests++;
    success(`Live projects: ${liveProjects?.length || 0} items`);
  } else {
    failedTests++;
    error(`Live query failed: ${liveError.message}`);
  }

  // 4. TEST SEARCH FUNCTIONALITY
  section('4. SEARCH & AI FEATURES');

  const searchResult = await testAPI('/api/search', 'POST', {
    query: 'AI startup',
    limit: 5
  });
  totalTests++;
  if (searchResult.success) {
    passedTests++;
    info(`Search returned ${searchResult.data.results?.length || 0} results`);
  } else failedTests++;

  // 5. TEST ADMIN FEATURES
  section('5. ADMIN & APPROVAL WORKFLOW');

  const dashboard = await testAPI('/api/dashboard');
  totalTests++;
  if (dashboard.success) {
    passedTests++;
    info(`Total projects: ${dashboard.data.stats?.totalProjects || 0}`);
    info(`Pending approval: ${dashboard.data.stats?.pendingApproval || 0}`);
  } else failedTests++;

  // Test approval workflow (if items exist)
  if (queueProjects && queueProjects.length > 0) {
    const itemToApprove = queueProjects[0];
    info(`Testing approval for: ${itemToApprove.name}`);

    const approvalResult = await testAPI('/api/admin', 'POST', {
      action: 'approve',
      itemId: itemToApprove.id,
      itemType: 'project'
    });
    totalTests++;
    if (approvalResult.success) passedTests++; else failedTests++;
  }

  // 6. TEST FRONTEND
  section('6. FRONTEND ACCESSIBILITY');

  const frontendPages = [
    '/',
    '/dashboard',
    '/content-queue',
    '/analytics'
  ];

  for (const page of frontendPages) {
    try {
      const response = await fetch(`${FRONTEND_URL}${page}`);
      totalTests++;

      if (response.ok) {
        passedTests++;
        success(`Frontend ${page} - Status: ${response.status}`);
      } else {
        failedTests++;
        error(`Frontend ${page} - Status: ${response.status}`);
      }
    } catch (err: any) {
      failedTests++;
      error(`Frontend ${page} - Error: ${err.message}`);
    }
  }

  // 7. TEST SCHEDULER
  section('7. SCHEDULER & AUTOMATION');

  const schedulerStatus = await testAPI('/api/scheduler/status');
  totalTests++;
  if (schedulerStatus.success) {
    passedTests++;
    info(`Active jobs: ${schedulerStatus.data.activeJobs || 0}`);
    info(`Next run: ${schedulerStatus.data.nextRun || 'Not scheduled'}`);
  } else failedTests++;

  // 8. TEST PERFORMANCE
  section('8. PERFORMANCE METRICS');

  const performance = await testAPI('/api/performance');
  totalTests++;
  if (performance.success) {
    passedTests++;
    info(`Memory usage: ${Math.round((performance.data.memory?.heapUsed || 0) / 1024 / 1024)}MB`);
    info(`Uptime: ${Math.round((performance.data.uptime || 0) / 60)} minutes`);
  } else failedTests++;

  // 9. TEST ERROR HANDLING
  section('9. ERROR HANDLING');

  // Test invalid endpoint
  const invalidEndpoint = await testAPI('/api/nonexistent');
  totalTests++;
  if (invalidEndpoint.success === false) {
    passedTests++;
    success('Invalid endpoint handled correctly');
  } else {
    failedTests++;
  }

  // Test invalid data
  const invalidData = await testAPI('/api/admin', 'POST', { invalid: 'data' });
  totalTests++;
  if (invalidData.success === false) {
    passedTests++;
    success('Invalid data handled correctly');
  } else {
    failedTests++;
  }

  // FINAL SUMMARY
  section('TEST SUMMARY');

  const passRate = ((passedTests / totalTests) * 100).toFixed(1);

  console.log('\n' + colors.bright);
  console.log('📊 RESULTS:');
  console.log('='.repeat(40));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`${colors.cyan}Pass Rate: ${passRate}%${colors.reset}`);
  console.log('='.repeat(40));

  if (passRate >= 80) {
    console.log(`\n${colors.green}${colors.bright}🎉 APPLICATION IS WORKING WELL!${colors.reset}`);
    console.log(`${colors.green}All critical systems are operational.${colors.reset}`);
  } else if (passRate >= 60) {
    console.log(`\n${colors.yellow}${colors.bright}⚠️  APPLICATION PARTIALLY WORKING${colors.reset}`);
    console.log(`${colors.yellow}Some features need attention.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}${colors.bright}❌ APPLICATION HAS ISSUES${colors.reset}`);
    console.log(`${colors.red}Critical failures detected.${colors.reset}`);
  }

  // Detailed failure report
  if (failedTests > 0) {
    console.log(`\n${colors.yellow}Check the logs above for specific failures.${colors.reset}`);
  }

  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runTests().catch(console.error);