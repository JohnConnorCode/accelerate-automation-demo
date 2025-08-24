const puppeteer = require('puppeteer');
const path = require('path');

async function test() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Capture console
    page.on('console', msg => console.log('Console:', msg.type(), '-', msg.text()));
    page.on('pageerror', err => console.log('Page Error:', err.message));
    
    // Load the test page
    const filePath = 'file://' + path.resolve('test-local.html');
    console.log('Loading:', filePath);
    
    await page.goto(filePath, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));
    
    const errors = await page.$eval('#errors', el => el.innerText);
    console.log('Errors div content:', errors);
    
    const rootContent = await page.$eval('#root', el => el.innerHTML);
    console.log('Root content length:', rootContent.length);
    
    await browser.close();
}

test().catch(console.error);
