const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Testing local development server...\n');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    
    if (type === 'error') {
      console.log(`❌ Console Error: ${text}`);
    } else if (type === 'warning') {
      console.log(`⚠️  Console Warning: ${text}`);
    } else if (type === 'log') {
      console.log(`📝 Console Log: ${text}`);
    }
  });
  
  try {
    console.log('📍 Navigating to: http://localhost:8080');
    await page.goto('http://localhost:8080', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait a bit for React to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get page title
    const title = await page.title();
    console.log(`\n📄 Page Title: ${title}`);
    
    // Check if there's any content
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (bodyText) {
      console.log(`\n✅ Page loaded successfully with content`);
      console.log(`📜 Page content (first 200 chars): ${bodyText.substring(0, 200)}...`);
    } else {
      console.log('\n⚠️  Page loaded but no content visible');
    }
    
    // Check for specific elements that should be there
    const hasRoot = await page.evaluate(() => !!document.getElementById('root'));
    console.log(`\n🎯 Root element exists: ${hasRoot}`);
    
    const hasContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });
    console.log(`🎯 Root has content: ${hasContent}`);
    
  } catch (error) {
    console.log(`\n❌ Test failed: ${error.message}`);
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
    process.exit(0);
  }
})();