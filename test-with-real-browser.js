const puppeteer = require('puppeteer');

async function testProductionSite() {
    console.log('🚀 Launching real browser with Puppeteer...\n');
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // Capture console messages
        const consoleLogs = [];
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            consoleLogs.push({ type, text });
            
            if (type === 'error') {
                console.log(`❌ Console Error: ${text}`);
            } else if (type === 'warning') {
                console.log(`⚠️  Console Warning: ${text}`);
            }
        });
        
        // Capture page errors
        page.on('pageerror', error => {
            console.log(`❌ Page Error: ${error.message}`);
        });
        
        // Navigate to the site
        console.log('📍 Navigating to: https://accelerate-content-automation.vercel.app');
        const response = await page.goto('https://accelerate-content-automation.vercel.app', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        console.log(`✅ Page loaded with status: ${response.status()}\n`);
        
        // Wait a bit for React to render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take a screenshot
        await page.screenshot({ 
            path: 'production-screenshot.png',
            fullPage: true 
        });
        console.log('📸 Screenshot saved as production-screenshot.png\n');
        
        // Check page title
        const title = await page.title();
        console.log(`📝 Page Title: "${title}"`);
        
        // Check if React root has content
        const rootContent = await page.evaluate(() => {
            const root = document.getElementById('root');
            if (!root) return 'NO ROOT ELEMENT';
            if (root.children.length === 0) return 'EMPTY';
            return 'HAS CONTENT';
        });
        console.log(`🎯 React Root Status: ${rootContent}`);
        
        // Check for specific elements
        console.log('\n🔍 Checking for UI elements:');
        
        const checks = [
            { selector: '#root', name: 'Root div' },
            { selector: 'input[type="email"]', name: 'Email input' },
            { selector: 'input[type="password"]', name: 'Password input' },
            { selector: 'button', name: 'Button' },
            { selector: 'form', name: 'Form' },
            { selector: 'h1, h2, h3', name: 'Heading' }
        ];
        
        for (const check of checks) {
            const exists = await page.$(check.selector) !== null;
            console.log(`   ${exists ? '✅' : '❌'} ${check.name}: ${exists ? 'Found' : 'Not found'}`);
        }
        
        // Get all visible text
        const visibleText = await page.evaluate(() => {
            const body = document.body;
            const text = body.innerText || body.textContent || '';
            return text.trim().substring(0, 500); // First 500 chars
        });
        
        console.log('\n📄 Visible text on page:');
        console.log('   ' + (visibleText || '(No visible text - might be a white screen!)'));
        
        // Check for any JavaScript errors
        console.log('\n🔧 JavaScript Console Summary:');
        const errorCount = consoleLogs.filter(log => log.type === 'error').length;
        const warningCount = consoleLogs.filter(log => log.type === 'warning').length;
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Warnings: ${warningCount}`);
        
        // Check page HTML structure
        const html = await page.content();
        const hasReactInDOM = html.includes('data-reactroot') || html.includes('_reactRootContainer');
        console.log(`\n⚛️  React Rendered: ${hasReactInDOM ? 'Yes' : 'No/Unclear'}`);
        
        // Final verdict
        console.log('\n' + '='.repeat(60));
        if (rootContent === 'HAS CONTENT' && errorCount === 0) {
            console.log('✅ SUCCESS: Site is working properly!');
            console.log('   - Page loads without errors');
            console.log('   - React app is rendered');
            console.log('   - Content is visible');
        } else if (rootContent === 'EMPTY') {
            console.log('❌ FAIL: React root is empty - WHITE SCREEN!');
        } else if (errorCount > 0) {
            console.log('❌ FAIL: JavaScript errors detected');
            console.log('   The page may not render correctly');
        } else {
            console.log('⚠️  WARNING: Unclear if page is fully functional');
        }
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
        console.log('\n🏁 Browser closed');
    }
}

testProductionSite().catch(console.error);