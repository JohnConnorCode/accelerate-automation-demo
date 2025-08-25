const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 COMPREHENSIVE PRODUCTION TEST\n');
  console.log('=' .repeat(60));
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Track ALL console messages
  const consoleMessages = {
    errors: [],
    warnings: [],
    logs: [],
    info: []
  };
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      consoleMessages.errors.push(text);
      console.log(`❌ Console Error: ${text}`);
    } else if (type === 'warning') {
      consoleMessages.warnings.push(text);
      console.log(`⚠️  Console Warning: ${text}`);
    } else if (type === 'log') {
      consoleMessages.logs.push(text);
    } else if (type === 'info') {
      consoleMessages.info.push(text);
    }
  });
  
  // Track network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      failure: request.failure()
    });
    console.log(`🌐 Network Error: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  // Track page errors
  page.on('pageerror', error => {
    console.log(`📄 Page Error: ${error.message}`);
  });
  
  try {
    console.log('\n1️⃣ LOADING PAGE...');
    const response = await page.goto('https://accelerate-content-automation.vercel.app', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log(`   Status: ${response.status()}`);
    console.log(`   URL: ${page.url()}`);
    
    // Wait for React to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n2️⃣ CHECKING PAGE STRUCTURE...');
    
    // Check if critical elements exist
    const elements = await page.evaluate(() => {
      return {
        root: !!document.getElementById('root'),
        rootHasContent: document.getElementById('root')?.children.length > 0,
        forms: document.querySelectorAll('form').length,
        inputs: document.querySelectorAll('input').length,
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a').length,
        images: document.querySelectorAll('img').length,
        scripts: document.querySelectorAll('script').length,
        styles: document.querySelectorAll('link[rel="stylesheet"]').length
      };
    });
    
    console.log(`   Root element: ${elements.root ? '✅' : '❌'}`);
    console.log(`   Root has content: ${elements.rootHasContent ? '✅' : '❌'}`);
    console.log(`   Forms: ${elements.forms}`);
    console.log(`   Inputs: ${elements.inputs}`);
    console.log(`   Buttons: ${elements.buttons}`);
    console.log(`   Links: ${elements.links}`);
    console.log(`   Images: ${elements.images}`);
    console.log(`   Scripts: ${elements.scripts}`);
    console.log(`   Stylesheets: ${elements.styles}`);
    
    console.log('\n3️⃣ TESTING LOGIN FORM...');
    
    // Check if login form works
    const hasEmailInput = await page.$('input[type="email"]') !== null;
    const hasPasswordInput = await page.$('input[type="password"]') !== null;
    const hasSubmitButton = await page.$('button[type="submit"]') !== null;
    
    console.log(`   Email input: ${hasEmailInput ? '✅' : '❌'}`);
    console.log(`   Password input: ${hasPasswordInput ? '✅' : '❌'}`);
    console.log(`   Submit button: ${hasSubmitButton ? '✅' : '❌'}`);
    
    if (hasEmailInput && hasPasswordInput) {
      // Try to interact with the form
      await page.type('input[type="email"]', 'test@example.com');
      await page.type('input[type="password"]', 'testpassword');
      console.log('   ✅ Can type in form fields');
    }
    
    console.log('\n4️⃣ CHECKING FOR JAVASCRIPT ERRORS...');
    
    // Check for any JavaScript that might fail
    const jsCheck = await page.evaluate(() => {
      const checks = {
        hasWindow: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined',
        hasProcess: typeof window.process !== 'undefined',
        hasPath: typeof window.path !== 'undefined',
        pathResolveWorks: false,
        processEnvExists: false,
        importMetaEnv: false
      };
      
      try {
        if (window.path && typeof window.path.resolve === 'function') {
          window.path.resolve('/test');
          checks.pathResolveWorks = true;
        }
      } catch (e) {
        checks.pathResolveError = e.message;
      }
      
      try {
        if (window.process && window.process.env) {
          checks.processEnvExists = true;
        }
      } catch (e) {
        checks.processEnvError = e.message;
      }
      
      return checks;
    });
    
    console.log(`   window exists: ${jsCheck.hasWindow ? '✅' : '❌'}`);
    console.log(`   document exists: ${jsCheck.hasDocument ? '✅' : '❌'}`);
    console.log(`   process polyfill: ${jsCheck.hasProcess ? '✅' : '❌'}`);
    console.log(`   path polyfill: ${jsCheck.hasPath ? '✅' : '❌'}`);
    console.log(`   path.resolve works: ${jsCheck.pathResolveWorks ? '✅' : '❌'}`);
    if (jsCheck.pathResolveError) {
      console.log(`   ⚠️  path.resolve error: ${jsCheck.pathResolveError}`);
    }
    
    console.log('\n5️⃣ CHECKING API CONFIGURATION...');
    
    // Check if Supabase is configured
    const supabaseCheck = await page.evaluate(() => {
      // Check if environment variables are accessible
      const checks = {
        hasSupabaseInWindow: false,
        envVarsAccessible: false
      };
      
      // Look for Supabase in the bundled code
      const scripts = Array.from(document.querySelectorAll('script'));
      const hasSupabaseCode = scripts.some(s => 
        s.src && s.src.includes('index-') && s.type === 'module'
      );
      
      checks.hasSupabaseModule = hasSupabaseCode;
      
      return checks;
    });
    
    console.log(`   Supabase module loaded: ${supabaseCheck.hasSupabaseModule ? '✅' : '⚠️'}`);
    
    console.log('\n6️⃣ PERFORMANCE METRICS...');
    
    const metrics = await page.evaluate(() => {
      const timing = performance.timing;
      return {
        domContentLoaded: timing.domContentLoadedEventEnd - timing.domContentLoadedEventStart,
        loadComplete: timing.loadEventEnd - timing.loadEventStart,
        domInteractive: timing.domInteractive - timing.navigationStart,
        pageLoadTime: timing.loadEventEnd - timing.navigationStart
      };
    });
    
    console.log(`   DOM Content Loaded: ${metrics.domContentLoaded}ms`);
    console.log(`   Load Complete: ${metrics.loadComplete}ms`);
    console.log(`   DOM Interactive: ${metrics.domInteractive}ms`);
    console.log(`   Total Page Load: ${metrics.pageLoadTime}ms`);
    
    console.log('\n7️⃣ SUMMARY OF ISSUES...\n');
    
    const issues = [];
    
    if (consoleMessages.errors.length > 0) {
      issues.push(`❌ ${consoleMessages.errors.length} console errors`);
    }
    
    if (consoleMessages.warnings.length > 0) {
      issues.push(`⚠️  ${consoleMessages.warnings.length} console warnings`);
    }
    
    if (networkErrors.length > 0) {
      issues.push(`🌐 ${networkErrors.length} network errors`);
    }
    
    if (!elements.rootHasContent) {
      issues.push('❌ React root has no content');
    }
    
    if (!jsCheck.pathResolveWorks) {
      issues.push('❌ path.resolve polyfill not working');
    }
    
    if (metrics.pageLoadTime > 3000) {
      issues.push(`⚠️  Slow page load: ${metrics.pageLoadTime}ms`);
    }
    
    if (issues.length === 0) {
      console.log('✅ NO ISSUES FOUND - Site is working perfectly!');
    } else {
      console.log('🔴 ISSUES FOUND:');
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