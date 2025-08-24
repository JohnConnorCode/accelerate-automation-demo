const puppeteer = require('puppeteer');

async function getErrorDetails() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  const errors = [];
  
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        type: 'console-error',
        text: msg.text(),
        location: msg.location()
      });
    }
  });
  
  await page.goto('https://accelerate-content-automation.vercel.app', {
    waitUntil: 'networkidle2'
  });
  
  // Try to get more info by evaluating in page context
  const pageErrors = await page.evaluate(() => {
    const errorInfo = [];
    
    // Check if Promise exists and has expected properties
    if (typeof Promise !== 'undefined') {
      errorInfo.push(`Promise exists: true`);
      errorInfo.push(`Promise.resolve exists: ${typeof Promise.resolve}`);
    }
    
    // Check for any global error handlers
    if (window.onerror) {
      errorInfo.push('Window has onerror handler');
    }
    
    // Try to find what 'd' is
    try {
      // Search for minified variable 'd' in global scope
      for (let key in window) {
        if (key === 'd') {
          errorInfo.push(`Found global 'd': ${typeof window[key]}`);
        }
      }
    } catch (e) {
      errorInfo.push(`Error checking globals: ${e.message}`);
    }
    
    return {
      info: errorInfo,
      rootContent: document.getElementById('root')?.innerHTML || 'Root is empty',
      scripts: Array.from(document.scripts).map(s => s.src || 'inline'),
      hasReact: typeof React !== 'undefined',
      hasReactDOM: typeof ReactDOM !== 'undefined'
    };
  });
  
  console.log('Page Errors:', errors);
  console.log('Page Info:', pageErrors);
  
  await browser.close();
}

getErrorDetails().catch(console.error);