#!/usr/bin/env node

/**
 * System Verification Script
 * Checks that all components are properly configured and working
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Accelerate Content Automation - System Verification\n');

// Check environment variables
function checkEnvVars() {
  console.log('📋 Checking environment variables...');
  
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'CRON_SECRET'
  ];
  
  const optional = [
    'OPENAI_API_KEY',
    'RESEND_API_KEY',
    'SLACK_WEBHOOK_URL',
    'DISCORD_WEBHOOK_URL',
    'ADMIN_EMAIL'
  ];
  
  let allGood = true;
  
  // Load .env.local if exists
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    console.log('✅ Loaded .env.local');
  } else {
    console.log('⚠️  No .env.local found, using process environment');
  }
  
  // Check required vars
  for (const varName of required) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`❌ ${varName}: Missing (REQUIRED)`);
      allGood = false;
    }
  }
  
  // Check optional vars
  console.log('\n📋 Optional services:');
  for (const varName of optional) {
    if (process.env[varName]) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`⚠️  ${varName}: Not configured`);
    }
  }
  
  return allGood;
}

// Check build artifacts
function checkBuild() {
  console.log('\n🏗️  Checking build artifacts...');
  
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log(`✅ Build directory exists with ${files.length} items`);
    return true;
  } else {
    console.log('❌ Build directory not found - run "npm run build"');
    return false;
  }
}

// Check database schema
function checkDatabase() {
  console.log('\n🗄️  Checking database schema...');
  
  const schemaPath = path.join(__dirname, 'database', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    const tables = schema.match(/CREATE TABLE/gi) || [];
    console.log(`✅ Schema file found with ${tables.length} tables`);
    return true;
  } else {
    console.log('❌ Database schema not found');
    return false;
  }
}

// Check API endpoints
function checkAPIEndpoints() {
  console.log('\n🌐 Checking API endpoints...');
  
  const apiPath = path.join(__dirname, 'api');
  const endpoints = [];
  
  function scanDir(dir, prefix = '') {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanDir(fullPath, `${prefix}/${item}`);
      } else if (item.endsWith('.ts') || item.endsWith('.js')) {
        endpoints.push(`${prefix}/${item.replace(/\.(ts|js)$/, '')}`);
      }
    }
  }
  
  scanDir(apiPath);
  
  console.log(`✅ Found ${endpoints.length} API endpoints:`);
  endpoints.slice(0, 10).forEach(ep => console.log(`   ${ep}`));
  if (endpoints.length > 10) {
    console.log(`   ... and ${endpoints.length - 10} more`);
  }
  
  return endpoints.length > 0;
}

// Check fetchers
function checkFetchers() {
  console.log('\n🔄 Checking content fetchers...');
  
  const fetchersPath = path.join(__dirname, 'src', 'fetchers');
  if (fs.existsSync(fetchersPath)) {
    const fetchers = fs.readdirSync(fetchersPath)
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('.ts', ''));
    
    console.log(`✅ Found ${fetchers.length} fetchers:`);
    fetchers.forEach(f => console.log(`   - ${f}`));
    return true;
  } else {
    console.log('❌ Fetchers directory not found');
    return false;
  }
}

// Main verification
async function verify() {
  console.log('Starting system verification...\n');
  
  const checks = {
    'Environment Variables': checkEnvVars(),
    'Build Artifacts': checkBuild(),
    'Database Schema': checkDatabase(),
    'API Endpoints': checkAPIEndpoints(),
    'Content Fetchers': checkFetchers()
  };
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(50));
  
  let allPassed = true;
  for (const [check, passed] of Object.entries(checks)) {
    console.log(`${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASSED' : 'FAILED'}`);
    if (!passed) allPassed = false;
  }
  
  console.log('='.repeat(50));
  
  if (allPassed) {
    console.log('\n🎉 All checks passed! System is ready for deployment.');
    console.log('\nNext steps:');
    console.log('1. Deploy to Vercel: vercel --prod');
    console.log('2. Run database migrations on production');
    console.log('3. Configure cron jobs in Vercel dashboard');
    console.log('4. Test webhook endpoints');
  } else {
    console.log('\n⚠️  Some checks failed. Please fix the issues above.');
    console.log('\nFor help, see:');
    console.log('- README.md for setup instructions');
    console.log('- DEPLOYMENT.md for deployment guide');
    console.log('- .env.example for required environment variables');
    process.exit(1);
  }
}

// Run verification
verify().catch(error => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});