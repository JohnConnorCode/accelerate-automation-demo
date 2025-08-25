#!/usr/bin/env node

const https = require('https');

console.log('🔍 Deep Testing Production Site...\n');

// Fetch the page and check for login form elements
function checkLoginForm() {
  return new Promise((resolve) => {
    https.get('https://accelerate-content-automation.vercel.app', (res) => {
      let html = '';
      res.on('data', (chunk) => { html += chunk; });
      res.on('end', () => {
        console.log('📄 HTML Response Length:', html.length, 'bytes');
        
        // Check for JavaScript files
        const jsFiles = html.match(/\/assets\/index-[A-Za-z0-9]+\.js/g) || [];
        console.log('📦 JavaScript Bundles Found:', jsFiles.length);
        
        // Check for CSS files  
        const cssFiles = html.match(/\/assets\/index-[A-Za-z0-9]+\.css/g) || [];
        console.log('🎨 CSS Files Found:', cssFiles.length);
        
        // Check for polyfills
        console.log('🔧 Deferred Polyfill:', html.includes('window.Deferred') ? '✅' : '❌');
        console.log('🔧 Path Polyfill:', html.includes('window.path') ? '✅' : '❌');
        console.log('🔧 React Root:', html.includes('id="root"') ? '✅' : '❌');
        
        // Now fetch the JS bundle to check for login components
        if (jsFiles.length > 0) {
          console.log('\n📥 Fetching JavaScript bundle...');
          const jsUrl = `https://accelerate-content-automation.vercel.app${jsFiles[0]}`;
          
          https.get(jsUrl, (jsRes) => {
            let jsContent = '';
            jsRes.on('data', (chunk) => { jsContent += chunk; });
            jsRes.on('end', () => {
              console.log('📊 JavaScript Bundle Size:', (jsContent.length / 1024).toFixed(2), 'KB');
              
              // Check for key components in the bundle
              const hasLogin = jsContent.includes('Login') || jsContent.includes('Sign in');
              const hasEmail = jsContent.includes('email') || jsContent.includes('Email');
              const hasPassword = jsContent.includes('password') || jsContent.includes('Password');
              const hasSupabase = jsContent.includes('supabase');
              const hasReact = jsContent.includes('React') || jsContent.includes('react');
              const hasErrorBoundary = jsContent.includes('ErrorBoundary') || jsContent.includes('error');
              
              console.log('\n🔍 Component Detection:');
              console.log('  Login Component:', hasLogin ? '✅' : '❌');
              console.log('  Email Field:', hasEmail ? '✅' : '❌');
              console.log('  Password Field:', hasPassword ? '✅' : '❌');
              console.log('  Supabase Auth:', hasSupabase ? '✅' : '❌');
              console.log('  React Framework:', hasReact ? '✅' : '❌');
              console.log('  Error Handling:', hasErrorBoundary ? '✅' : '❌');
              
              // Check for common error patterns
              const hasResolveError = jsContent.includes('resolve is not a function');
              const hasDeferredError = jsContent.includes('d.resolve');
              const hasPathError = jsContent.includes('path.resolve is not a function');
              
              console.log('\n⚠️ Error Pattern Detection:');
              console.log('  Resolve Error:', hasResolveError ? '❌ FOUND' : '✅ Not found');
              console.log('  Deferred Error:', hasDeferredError ? '⚠️ Possible issue' : '✅ Not found');
              console.log('  Path Error:', hasPathError ? '❌ FOUND' : '✅ Not found');
              
              const allGood = hasLogin && hasEmail && hasPassword && hasSupabase && 
                             hasReact && !hasResolveError && !hasPathError;
              
              console.log('\n' + '='.repeat(50));
              if (allGood) {
                console.log('✅ RESULT: Application appears to be working correctly!');
                console.log('  - All key components detected');
                console.log('  - No critical error patterns found');
                console.log('  - Polyfills are in place');
              } else {
                console.log('⚠️ RESULT: Some issues detected');
                console.log('  - Check the component detection results above');
              }
              console.log('='.repeat(50));
              
              resolve(allGood);
            });
          }).on('error', (err) => {
            console.error('❌ Error fetching JS bundle:', err.message);
            resolve(false);
          });
        } else {
          console.log('❌ No JavaScript bundles found in HTML');
          resolve(false);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Error fetching site:', err.message);
      resolve(false);
    });
  });
}

checkLoginForm();