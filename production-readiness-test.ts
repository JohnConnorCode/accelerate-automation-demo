#!/usr/bin/env npx tsx

/**
 * PRODUCTION READINESS TEST SUITE
 * External Consultant Assessment for Launch to Thousands of Users
 */

import { createClient } from '@supabase/supabase-js';
import { SimpleOrchestrator } from './src/core/simple-orchestrator';

const supabase = createClient(
  'https://eqpfvmwmdtsgddpsodsr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI'
);

interface TestResult {
  category: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'CRITICAL';
  details: string;
  recommendation?: string;
}

const results: TestResult[] = [];

function log(category: string, test: string, status: 'PASS' | 'FAIL' | 'CRITICAL', details: string, recommendation?: string) {
  results.push({ category, test, status, details, recommendation });
  const icon = status === 'PASS' ? '✅' : status === 'CRITICAL' ? '🔴' : '⚠️';
  console.log(`${icon} [${category}] ${test}: ${details}`);
  if (recommendation) console.log(`   → ${recommendation}`);
}

async function testDatabaseSchema() {
  console.log('\n🔍 DATABASE SCHEMA VALIDATION\n');
  
  // Check all required tables exist
  const requiredTables = [
    'queue_projects', 'queue_news', 'queue_investors',
    'accelerate_startups', 'accelerate_news', 'accelerate_investors'
  ];
  
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      log('Database', `Table ${table}`, 'CRITICAL', `Table missing or inaccessible: ${error.message}`);
    } else {
      log('Database', `Table ${table}`, 'PASS', 'Table exists and accessible');
    }
  }
  
  // Check RLS policies
  const { data: policies } = await supabase.rpc('get_policies', { schema_name: 'public' }).single();
  if (!policies || policies.length === 0) {
    log('Database', 'RLS Policies', 'CRITICAL', 'No Row Level Security policies found', 'Add RLS policies before production');
  }
}

async function testAuthentication() {
  console.log('\n🔍 AUTHENTICATION & AUTHORIZATION\n');
  
  // Check if auth is configured
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.message.includes('not authenticated')) {
    log('Auth', 'Anonymous Access', 'PASS', 'Anonymous access working as expected');
  } else {
    log('Auth', 'Authentication', 'FAIL', 'Authentication state unclear');
  }
  
  // Check for user tables
  const { error: userTableError } = await supabase.from('users').select('id').limit(1);
  if (userTableError) {
    log('Auth', 'User Management', 'CRITICAL', 'No user table found', 'Create user management system');
  }
}

async function testDataPipeline() {
  console.log('\n🔍 DATA PIPELINE INTEGRITY\n');
  
  // Test orchestrator
  const orchestrator = new SimpleOrchestrator();
  
  try {
    // Check if we can fetch data
    const result = await orchestrator.run();
    
    if (result.fetched > 0) {
      log('Pipeline', 'Data Fetching', 'PASS', `Fetched ${result.fetched} items`);
    } else {
      log('Pipeline', 'Data Fetching', 'FAIL', 'No data fetched', 'Check data sources');
    }
    
    if (result.errors.length > 0) {
      log('Pipeline', 'Pipeline Errors', 'FAIL', `${result.errors.length} errors occurred`, result.errors[0]);
    }
    
    // Check success rate
    if (result.successRate && result.successRate < 10) {
      log('Pipeline', 'Success Rate', 'CRITICAL', `Only ${result.successRate}% success rate`, 'Investigate data quality issues');
    }
    
  } catch (error) {
    log('Pipeline', 'Orchestrator', 'CRITICAL', `Pipeline failed: ${error}`, 'Fix orchestrator before launch');
  }
}

async function testAPIEndpoints() {
  console.log('\n🔍 API ENDPOINTS\n');
  
  // Test critical endpoints
  const endpoints = [
    '/api/scheduler/run',
    '/api/approve',
    '/api/reject',
    '/api/content-queue',
    '/api/analytics'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint}`, {
        method: endpoint.includes('approve') ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok || response.status === 404) {
        log('API', endpoint, response.ok ? 'PASS' : 'FAIL', 
            response.ok ? 'Endpoint responsive' : 'Endpoint not found',
            response.ok ? undefined : 'Implement missing endpoint');
      }
    } catch (error) {
      log('API', endpoint, 'FAIL', 'Cannot reach endpoint', 'Ensure server is running');
    }
  }
}

async function testDataQuality() {
  console.log('\n🔍 DATA QUALITY & INTEGRITY\n');
  
  // Check for duplicates
  const { data: duplicates } = await supabase.rpc('check_duplicates');
  if (duplicates && duplicates.length > 0) {
    log('Data Quality', 'Duplicates', 'FAIL', `Found ${duplicates.length} duplicates`, 'Clean duplicate data');
  }
  
  // Check for required fields
  const { data: incomplete } = await supabase
    .from('queue_projects')
    .select('id')
    .or('company_name.is.null,description.is.null,source.is.null');
  
  if (incomplete && incomplete.length > 0) {
    log('Data Quality', 'Required Fields', 'FAIL', `${incomplete.length} records missing required fields`);
  }
  
  // Check ACCELERATE scoring
  const { data: unscored } = await supabase
    .from('queue_projects')
    .select('id')
    .is('accelerate_score', null);
  
  if (unscored && unscored.length > 0) {
    log('Data Quality', 'ACCELERATE Scoring', 'FAIL', `${unscored.length} items not scored`, 'Run scoring on all items');
  }
}

async function testPerformance() {
  console.log('\n🔍 PERFORMANCE & SCALABILITY\n');
  
  // Test query performance
  const start = Date.now();
  const { data } = await supabase
    .from('queue_news')
    .select('*')
    .limit(100);
  const queryTime = Date.now() - start;
  
  if (queryTime > 1000) {
    log('Performance', 'Query Speed', 'FAIL', `Query took ${queryTime}ms`, 'Add indexes for common queries');
  } else {
    log('Performance', 'Query Speed', 'PASS', `Query completed in ${queryTime}ms`);
  }
  
  // Check table sizes
  const { count: newsCount } = await supabase
    .from('queue_news')
    .select('*', { count: 'exact', head: true });
  
  if (newsCount && newsCount > 10000) {
    log('Performance', 'Table Size', 'FAIL', `${newsCount} records in queue`, 'Implement archival strategy');
  }
}

async function testErrorHandling() {
  console.log('\n🔍 ERROR HANDLING & RECOVERY\n');
  
  // Test with invalid data
  const { error: insertError } = await supabase
    .from('queue_projects')
    .insert({ 
      company_name: null,  // Required field
      source: 'test'
    });
  
  if (insertError) {
    log('Error Handling', 'Database Constraints', 'PASS', 'Constraints properly enforced');
  } else {
    log('Error Handling', 'Database Constraints', 'CRITICAL', 'No constraints on required fields!');
  }
  
  // Check for error logging
  const { data: logs } = await supabase
    .from('error_logs')
    .select('*')
    .limit(1);
  
  if (!logs) {
    log('Error Handling', 'Error Logging', 'CRITICAL', 'No error logging table', 'Implement error logging immediately');
  }
}

async function testMonitoring() {
  console.log('\n🔍 MONITORING & OBSERVABILITY\n');
  
  // Check for metrics tables
  const { error: metricsError } = await supabase
    .from('system_metrics')
    .select('*')
    .limit(1);
  
  if (metricsError) {
    log('Monitoring', 'Metrics Collection', 'CRITICAL', 'No metrics collection', 'Add monitoring before launch');
  }
  
  // Check for health checks
  try {
    const response = await fetch('http://localhost:3000/api/health');
    if (!response.ok) {
      log('Monitoring', 'Health Check', 'CRITICAL', 'No health check endpoint', 'Add health monitoring');
    }
  } catch {
    log('Monitoring', 'Health Check', 'CRITICAL', 'Health check failed');
  }
}

async function testEmailSystem() {
  console.log('\n🔍 EMAIL & NOTIFICATIONS\n');
  
  // Check for email configuration
  const hasEmailConfig = process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY;
  
  if (!hasEmailConfig) {
    log('Email', 'Email Configuration', 'CRITICAL', 'No email service configured', 'Configure email service NOW');
  }
  
  // Check for email templates
  const { error: templateError } = await supabase
    .from('email_templates')
    .select('*')
    .limit(1);
  
  if (templateError) {
    log('Email', 'Email Templates', 'CRITICAL', 'No email templates table', 'Create email template system');
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 PRODUCTION READINESS REPORT');
  console.log('='.repeat(60) + '\n');
  
  const critical = results.filter(r => r.status === 'CRITICAL');
  const failures = results.filter(r => r.status === 'FAIL');
  const passes = results.filter(r => r.status === 'PASS');
  
  console.log(`CRITICAL ISSUES: ${critical.length}`);
  console.log(`FAILURES: ${failures.length}`);
  console.log(`PASSES: ${passes.length}`);
  
  const score = Math.round((passes.length / results.length) * 100);
  console.log(`\nREADINESS SCORE: ${score}%`);
  
  if (critical.length > 0) {
    console.log('\n🔴 CRITICAL ISSUES (MUST FIX BEFORE LAUNCH):');
    critical.forEach(r => {
      console.log(`\n- ${r.category}: ${r.test}`);
      console.log(`  ${r.details}`);
      if (r.recommendation) console.log(`  Action: ${r.recommendation}`);
    });
  }
  
  if (failures.length > 0) {
    console.log('\n⚠️ FAILURES (SHOULD FIX):');
    failures.forEach(r => {
      console.log(`- ${r.category}: ${r.test} - ${r.details}`);
    });
  }
  
  console.log('\n📋 LAUNCH CHECKLIST:');
  const checklist = [
    { item: 'User Authentication', required: true },
    { item: 'Email Notifications', required: true },
    { item: 'Error Logging', required: true },
    { item: 'Health Monitoring', required: true },
    { item: 'RLS Policies', required: true },
    { item: 'API Rate Limiting', required: true },
    { item: 'Backup Strategy', required: true },
    { item: 'Load Testing', required: true }
  ];
  
  checklist.forEach(check => {
    const found = results.find(r => r.test.toLowerCase().includes(check.item.toLowerCase()));
    const status = found && found.status === 'PASS' ? '✅' : '❌';
    console.log(`${status} ${check.item} ${check.required ? '(REQUIRED)' : ''}`);
  });
  
  console.log('\n🚦 LAUNCH RECOMMENDATION:');
  if (critical.length > 0) {
    console.log('❌ NOT READY FOR LAUNCH - Critical issues must be resolved');
  } else if (score < 70) {
    console.log('⚠️ HIGH RISK LAUNCH - Major improvements needed');
  } else if (score < 90) {
    console.log('🟡 CONDITIONAL LAUNCH - Address failures first');
  } else {
    console.log('✅ READY FOR LAUNCH - Minor improvements recommended');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 STARTING PRODUCTION READINESS ASSESSMENT');
  console.log('Target: Launch to thousands of users');
  console.log('Date:', new Date().toISOString());
  console.log('=' .repeat(60));
  
  await testDatabaseSchema();
  await testAuthentication();
  await testDataPipeline();
  // await testAPIEndpoints(); // Skip if server not running
  await testDataQuality();
  await testPerformance();
  await testErrorHandling();
  await testMonitoring();
  await testEmailSystem();
  
  await generateReport();
}

runAllTests().catch(console.error);