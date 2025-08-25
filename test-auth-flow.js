const puppeteer = require('puppeteer');

(async () => {
  console.log('🔐 TESTING AUTHENTICATION FLOW\n');
  console.log('=' .repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track network requests
  const apiCalls = [];
  page.on('request', request => {
    if (request.url().includes('supabase')) {
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers()
      });
    }
  });
  
  page.on('response', response => {
    if (response.url().includes('supabase')) {
      console.log(`   Supabase API Response: ${response.status()} - ${response.url().split('?')[0]}`);
    }
  });
  
  // Track console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`❌ Console Error: ${msg.text()}`);
    }
  });
  
  try {
    console.log('\n1️⃣ LOADING LOGIN PAGE...');
    await page.goto('https://accelerate-content-automation.vercel.app', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('\n2️⃣ TESTING WITH INVALID CREDENTIALS...');
    
    // Try to login with wrong credentials
    await page.type('input[type="email"]', 'invalid@test.com');
    await page.type('input[type="password"]', 'wrongpassword');
    
    // Click submit button
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check for error message
      const errorMessage = await page.evaluate(() => {
        // Look for any error text
        const possibleErrors = [
          ...document.querySelectorAll('.text-red-500'),
          ...document.querySelectorAll('.error'),
          ...document.querySelectorAll('[role="alert"]')
        ];
        return possibleErrors.map(el => el.textContent).filter(Boolean);
      });
      
      if (errorMessage.length > 0) {
        console.log(`   ✅ Error message displayed: "${errorMessage[0]}"`);
      } else {
        console.log(`   ⚠️  No error message shown for invalid login`);
      }
    }
    
    console.log('\n3️⃣ CHECKING SUPABASE CONFIGURATION...');
    
    // Check if Supabase is properly configured
    const supabaseConfig = await page.evaluate(() => {
      try {
        // Check for environment variables
        const scripts = document.querySelectorAll('script[type="module"]');
        let hasSupabaseUrl = false;
        let hasSupabaseKey = false;
        
        // Check if placeholders are still there
        const scriptContent = Array.from(scripts).map(s => s.textContent).join('');
        if (scriptContent.includes('placeholder.supabase.co')) {
          return { error: 'Supabase URL is still placeholder!' };
        }
        if (scriptContent.includes('placeholder-key')) {
          return { error: 'Supabase key is still placeholder!' };
        }
        
        return { configured: true };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    if (supabaseConfig.error) {
      console.log(`   ❌ ${supabaseConfig.error}`);
    } else if (supabaseConfig.configured) {
      console.log(`   ✅ Supabase appears to be configured`);
    }
    
    console.log('\n4️⃣ CHECKING ENVIRONMENT VARIABLES...');
    
    // Check what environment variables are available
    const envCheck = await page.evaluate(() => {
      const checks = {
        hasImportMeta: false,
        processEnv: typeof process !== 'undefined' && process.env ? Object.keys(process.env).length : 0,
        windowEnv: window.env ? Object.keys(window.env).length : 0
      };
      
      // Check for window.process (our polyfill)
      if (window.process && window.process.env) {
        checks.processEnv = Object.keys(window.process.env).length;
      }
      
      return checks;
    });
    
    console.log(`   Import.meta available: ${envCheck.hasImportMeta ? '✅' : '❌'}`);
    console.log(`   Process.env keys: ${envCheck.processEnv}`);
    if (envCheck.viteEnvKeys) {
      console.log(`   Vite env vars: ${envCheck.viteEnvKeys.join(', ') || 'none'}`);
    }
    
    console.log('\n5️⃣ API CALLS MADE...');
    
    if (apiCalls.length > 0) {
      console.log(`   Total Supabase API calls: ${apiCalls.length}`);
      apiCalls.forEach(call => {
        console.log(`   - ${call.method} ${call.url.split('?')[0]}`);
      });
    } else {
      console.log(`   ⚠️  No Supabase API calls detected`);
    }
    
    console.log('\n6️⃣ POTENTIAL ISSUES FOUND...\n');
    
    const issues = [];
    
    if (apiCalls.length === 0) {
      issues.push('⚠️  No Supabase API calls - may not be properly connected');
    }
    
    if (supabaseConfig.error) {
      issues.push(`❌ Supabase configuration issue: ${supabaseConfig.error}`);
    }
    
    if (!envCheck.viteEnvKeys || envCheck.viteEnvKeys.length === 0) {
      issues.push('⚠️  No Vite environment variables detected');
    }
    
    if (issues.length === 0) {
      console.log('✅ Authentication system appears functional');
    } else {
      console.log('Issues detected:');
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    
    console.log('\n' + '=' .repeat(60));
    
  } catch (error) {
    console.log(`\n🔥 CRITICAL ERROR: ${error.message}`);
  } finally {
    await browser.close();
    console.log('\n🏁 Test completed');
  }
})();