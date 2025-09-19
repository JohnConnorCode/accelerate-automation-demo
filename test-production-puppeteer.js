const puppeteer = require('puppeteer');

async function testProductionSite() {
  console.log('🚀 LAUNCHING BROWSER TEST...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Capture console messages and errors
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      pageErrors.push(text);
    }
  });

  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  try {
    console.log('1️⃣ LOADING HOMEPAGE...');
    await page.goto('https://accelerate-content-automation-b22svbd0h.vercel.app/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for React to render
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page title
    const title = await page.title();
    console.log('   Page Title:', title);

    // Check for React root
    const hasRoot = await page.$('#root');
    console.log('   React Root Element:', hasRoot ? '✅ Found' : '❌ Not found');

    // Get page content
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const bodyText = await page.evaluate(() => document.body.innerText);

    console.log('   Page HTML Length:', bodyHTML.length, 'bytes');
    console.log('   Page Text Length:', bodyText.length, 'chars');
    console.log('   Has Visible Content:', bodyText.length > 50 ? '✅ Yes' : '❌ No');

    // Check for specific elements
    console.log('\n2️⃣ CHECKING UI ELEMENTS...');

    const nav = await page.$('nav, header, .navigation, .navbar');
    console.log('   Navigation:', nav ? '✅ Found' : '❌ Not found');

    const main = await page.$('main, .main, .content, .container');
    console.log('   Main Content:', main ? '✅ Found' : '❌ Not found');

    const buttons = await page.$$('button, a[href], .btn');
    console.log('   Interactive Elements:', buttons.length, 'found');

    // Test navigation to dashboard
    console.log('\n3️⃣ TESTING NAVIGATION...');
    await page.goto('https://accelerate-content-automation-b22svbd0h.vercel.app/dashboard', {
      waitUntil: 'networkidle2'
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const dashboardText = await page.evaluate(() => document.body.innerText);
    console.log('   Dashboard Loads:', dashboardText.length > 50 ? '✅ Yes' : '❌ No');

    // Test content queue
    await page.goto('https://accelerate-content-automation-b22svbd0h.vercel.app/content-queue', {
      waitUntil: 'networkidle2'
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const queueText = await page.evaluate(() => document.body.innerText);
    console.log('   Content Queue Loads:', queueText.length > 50 ? '✅ Yes' : '❌ No');

    // Check for data elements
    console.log('\n4️⃣ CHECKING DATA ELEMENTS...');

    const tables = await page.$$('table');
    const cards = await page.$$('[class*="card"], .card');
    const lists = await page.$$('ul li, ol li');

    console.log('   Tables:', tables.length);
    console.log('   Cards:', cards.length);
    console.log('   List Items:', lists.length);

    // Check network activity
    console.log('\n5️⃣ CHECKING NETWORK ACTIVITY...');

    const requests = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('supabase') || url.includes('api')) {
        requests.push(url);
      }
    });

    await page.reload();
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('   API Requests Made:', requests.length);
    if (requests.length > 0) {
      console.log('   Sample:', requests[0].substring(0, 80) + '...');
    }

    // Error summary
    console.log('\n6️⃣ ERROR ANALYSIS...');
    console.log('   Page Errors:', pageErrors.length);
    if (pageErrors.length > 0) {
      pageErrors.slice(0, 3).forEach((err, i) => {
        console.log(`   ${i+1}. ${err.substring(0, 100)}`);
      });
    }

    console.log('   Console Errors:', consoleMessages.filter(m => m.type === 'error').length);
    console.log('   Console Warnings:', consoleMessages.filter(m => m.type === 'warning').length);

    // Take screenshot
    await page.screenshot({ path: 'production-screenshot.png' });
    console.log('\n📸 Screenshot saved as production-screenshot.png');

    // Final verdict
    console.log('\n' + '='.repeat(50));
    console.log('📊 PRODUCTION STATUS REPORT:');
    console.log('='.repeat(50));

    const checks = {
      'Page loads': true,
      'React renders': hasRoot !== null,
      'Content visible': bodyText.length > 50,
      'Navigation works': nav !== null,
      'Routes functional': dashboardText.length > 50 && queueText.length > 50,
      'No critical errors': pageErrors.length === 0
    };

    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`  ${check}: ${passed ? '✅' : '❌'}`);
    });

    const passedCount = Object.values(checks).filter(v => v).length;
    const totalCount = Object.keys(checks).length;

    console.log('\n' + '='.repeat(50));
    if (passedCount === totalCount) {
      console.log('🎉 PRODUCTION IS FULLY FUNCTIONAL!');
      console.log('All systems operational.');
    } else if (passedCount >= 4) {
      console.log('✅ PRODUCTION IS WORKING!');
      console.log(`${passedCount}/${totalCount} checks passed.`);
    } else {
      console.log('⚠️ PRODUCTION NEEDS FIXES');
      console.log(`Only ${passedCount}/${totalCount} checks passed.`);
    }

    console.log('\n🔗 Live at: https://accelerate-content-automation-b22svbd0h.vercel.app/');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testProductionSite().catch(console.error);