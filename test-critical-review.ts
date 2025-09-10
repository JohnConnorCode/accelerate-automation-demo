/**
 * CRITICAL END-TO-END TEST
 * Tests EVERYTHING to ensure the system actually works
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config();

const API_URL = 'http://localhost:3000/api';
const FRONTEND_URL = 'http://localhost:3001';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

const results: TestResult[] = [];

function record(name: string, status: 'PASS' | 'FAIL' | 'WARN', details?: string) {
  results.push({ name, status, details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
}

async function criticalTests() {
  console.log('🔍 CRITICAL SYSTEM REVIEW');
  console.log('=' .repeat(60));
  console.log('Testing EVERYTHING to ensure it actually works...\n');

  // 1. INFRASTRUCTURE TESTS
  console.log('\n📦 INFRASTRUCTURE');
  console.log('-'.repeat(40));
  
  // Test API server
  try {
    const health = await fetch(`${API_URL}/health`);
    const data = await health.json();
    record('API Server', data.status === 'healthy' ? 'PASS' : 'FAIL');
  } catch (e) {
    record('API Server', 'FAIL', 'Server not responding');
  }

  // Test Frontend
  try {
    const response = await fetch(FRONTEND_URL);
    record('Frontend Server', response.ok ? 'PASS' : 'FAIL');
  } catch (e) {
    record('Frontend Server', 'FAIL', 'Frontend not responding');
  }

  // Test Supabase connection
  try {
    const { count, error } = await supabase
      .from('queue_projects')
      .select('*', { count: 'exact', head: true });
    record('Supabase Connection', !error ? 'PASS' : 'FAIL', error?.message);
  } catch (e) {
    record('Supabase Connection', 'FAIL', 'Cannot connect to database');
  }

  // 2. DATA FLOW TESTS
  console.log('\n🔄 DATA FLOW');
  console.log('-'.repeat(40));

  // Test fetch
  try {
    const response = await fetch(`${API_URL}/scheduler/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'content-fetch' })
    });
    const data = await response.json();
    if (data.success) {
      record('Data Fetching', 'PASS', `Fetched ${data.result.fetched} items`);
      record('Deduplication', data.result.unique > 0 ? 'PASS' : 'WARN', 
        `${data.result.unique} unique of ${data.result.fetched}`);
      record('Queue Insertion', data.result.inserted > 0 ? 'PASS' : 'WARN',
        `${data.result.inserted} items queued`);
    } else {
      record('Data Fetching', 'FAIL', data.error);
    }
  } catch (e) {
    record('Data Fetching', 'FAIL', 'Fetch endpoint broken');
  }

  // 3. QUEUE & APPROVAL TESTS
  console.log('\n📋 QUEUE & APPROVAL');
  console.log('-'.repeat(40));

  // Check queue has items
  try {
    const response = await fetch(`${API_URL}/pending`);
    const data = await response.json();
    const totalItems = (data.projects?.length || 0) + 
                      (data.investors?.length || 0) + 
                      (data.news?.length || 0);
    record('Queue Has Items', totalItems > 0 ? 'PASS' : 'WARN', 
      `${totalItems} items pending`);
    
    // Test approval if we have items
    if (data.projects?.length > 0) {
      const testItem = data.projects[0];
      const approveResponse = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testItem.id,
          type: 'projects',
          action: 'approve',
          reviewerNotes: 'Test approval'
        })
      });
      const approveData = await approveResponse.json();
      record('Approval Process', approveData.success ? 'PASS' : 'FAIL', 
        approveData.message);
    }
  } catch (e) {
    record('Queue System', 'FAIL', 'Cannot access queue');
  }

  // 4. PRODUCTION DATA CHECK
  console.log('\n📊 PRODUCTION DATA');
  console.log('-'.repeat(40));

  try {
    const { data: startups, error: startupsError } = await supabase
      .from('accelerate_startups')
      .select('*')
      .limit(5);
    
    record('Production Table (startups)', !startupsError ? 'PASS' : 'FAIL',
      `${startups?.length || 0} items in production`);

    const { data: investors, error: investorsError } = await supabase
      .from('accelerate_investors')
      .select('*')
      .limit(5);
    
    record('Production Table (investors)', !investorsError ? 'PASS' : 'FAIL',
      `${investors?.length || 0} items in production`);
  } catch (e) {
    record('Production Tables', 'FAIL', 'Cannot access production data');
  }

  // 5. ACCELERATE CRITERIA
  console.log('\n🎯 ACCELERATE CRITERIA');
  console.log('-'.repeat(40));

  try {
    const { data: queueItems } = await supabase
      .from('queue_projects')
      .select('accelerate_fit, accelerate_score, accelerate_reason')
      .limit(10);
    
    if (queueItems && queueItems.length > 0) {
      const withScores = queueItems.filter(i => i.accelerate_score !== null);
      const fitItems = queueItems.filter(i => i.accelerate_fit === true);
      
      record('ACCELERATE Scoring', withScores.length > 0 ? 'PASS' : 'WARN',
        `${withScores.length}/${queueItems.length} items scored`);
      record('ACCELERATE Fit Detection', fitItems.length > 0 ? 'PASS' : 'WARN',
        `${fitItems.length}/${queueItems.length} items fit criteria`);
    } else {
      record('ACCELERATE Criteria', 'WARN', 'No items to test');
    }
  } catch (e) {
    record('ACCELERATE Criteria', 'FAIL', 'Cannot test criteria');
  }

  // 6. API ENDPOINTS
  console.log('\n🔌 API ENDPOINTS');
  console.log('-'.repeat(40));

  const endpoints = [
    { path: '/health', method: 'GET', name: 'Health Check' },
    { path: '/status', method: 'GET', name: 'Status' },
    { path: '/dashboard', method: 'GET', name: 'Dashboard' },
    { path: '/pending', method: 'GET', name: 'Pending Queue' },
    { path: '/analytics', method: 'GET', name: 'Analytics' },
    { path: '/scheduler/status', method: 'GET', name: 'Scheduler Status' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_URL}${endpoint.path}`, {
        method: endpoint.method
      });
      record(endpoint.name, response.ok ? 'PASS' : 'FAIL', 
        `Status: ${response.status}`);
    } catch (e) {
      record(endpoint.name, 'FAIL', 'Endpoint unreachable');
    }
  }

  // 7. ERROR HANDLING
  console.log('\n🛡️ ERROR HANDLING');
  console.log('-'.repeat(40));

  // Test crash prevention
  const crashTests = [
    { payload: null, name: 'NULL payload' },
    { payload: { id: "'; DROP TABLE--", type: 'projects', action: 'approve' }, name: 'SQL Injection' },
    { payload: { id: 999999, type: 'invalid', action: 'invalid' }, name: 'Invalid values' }
  ];

  let crashResistant = true;
  for (const test of crashTests) {
    try {
      const response = await fetch(`${API_URL}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: test.payload === null ? null : JSON.stringify(test.payload)
      });
      if (response.status !== 400 && response.status !== 500) {
        crashResistant = false;
      }
    } catch (e) {
      crashResistant = false;
    }
  }
  record('Crash Prevention', crashResistant ? 'PASS' : 'FAIL');

  // Check if server is still healthy after crash tests
  try {
    const health = await fetch(`${API_URL}/health`);
    const data = await health.json();
    record('Post-Test Health', data.status === 'healthy' ? 'PASS' : 'FAIL');
  } catch (e) {
    record('Post-Test Health', 'FAIL', 'Server crashed');
  }

  // 8. DATA SOURCES
  console.log('\n📡 DATA SOURCES');
  console.log('-'.repeat(40));

  // Check what sources are actually working
  try {
    const { data: recentItems } = await supabase
      .from('queue_projects')
      .select('source')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (recentItems) {
      const sources = [...new Set(recentItems.map(i => i.source).filter(Boolean))];
      record('Active Sources', sources.length > 0 ? 'PASS' : 'WARN',
        sources.join(', ') || 'None');
    }
  } catch (e) {
    record('Data Sources', 'FAIL', 'Cannot check sources');
  }

  // FINAL SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log('📈 FINAL RESULTS');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`✅ PASSED: ${passed}`);
  console.log(`⚠️  WARNINGS: ${warned}`);
  console.log(`❌ FAILED: ${failed}`);
  
  console.log('\n🔴 CRITICAL ISSUES:');
  const criticalFails = results.filter(r => r.status === 'FAIL');
  if (criticalFails.length === 0) {
    console.log('   None! System is operational.');
  } else {
    criticalFails.forEach(f => {
      console.log(`   • ${f.name}: ${f.details || 'Failed'}`);
    });
  }

  console.log('\n⚠️  WARNINGS TO ADDRESS:');
  const warnings = results.filter(r => r.status === 'WARN');
  if (warnings.length === 0) {
    console.log('   None');
  } else {
    warnings.forEach(w => {
      console.log(`   • ${w.name}: ${w.details || 'Warning'}`);
    });
  }

  // Overall health assessment
  console.log('\n' + '='.repeat(60));
  if (failed === 0 && warned <= 3) {
    console.log('✅ SYSTEM STATUS: FULLY OPERATIONAL');
    console.log('The pipeline is working end-to-end!');
  } else if (failed === 0) {
    console.log('⚠️  SYSTEM STATUS: OPERATIONAL WITH WARNINGS');
    console.log('Core functionality works but needs attention.');
  } else if (failed <= 3) {
    console.log('⚠️  SYSTEM STATUS: PARTIALLY OPERATIONAL');
    console.log('Most features work but critical issues exist.');
  } else {
    console.log('❌ SYSTEM STATUS: CRITICAL FAILURES');
    console.log('Major components are broken. Immediate fixes needed.');
  }
}

// Run the critical review
criticalTests().catch(console.error);