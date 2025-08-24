const https = require('https');

// Test if the JavaScript bundle executes without process errors
async function testProduction() {
    console.log('🔍 Testing production site: https://accelerate-content-automation.vercel.app\n');
    
    // Step 1: Fetch the main page
    const getPage = () => new Promise((resolve, reject) => {
        https.get('https://accelerate-content-automation.vercel.app/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
    
    try {
        const html = await getPage();
        console.log('✅ Page fetched successfully');
        
        // Check if it's just the shell or if React rendered
        const hasRootDiv = html.includes('<div id="root"></div>');
        const hasJsFile = html.match(/index-[a-zA-Z0-9]+\.js/);
        
        console.log(`✅ Root div present: ${hasRootDiv}`);
        console.log(`✅ JavaScript file found: ${hasJsFile ? hasJsFile[0] : 'None'}`);
        
        if (!hasJsFile) {
            console.log('❌ No JavaScript file found - site will be blank');
            return;
        }
        
        // Step 2: Fetch and analyze the JS bundle
        const jsUrl = `https://accelerate-content-automation.vercel.app/assets/${hasJsFile[0]}`;
        console.log(`\n📦 Fetching JS bundle: ${jsUrl}`);
        
        const getJs = () => new Promise((resolve, reject) => {
            https.get(jsUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        
        const jsContent = await getJs();
        console.log(`✅ JS bundle size: ${(jsContent.length / 1024).toFixed(2)} KB`);
        
        // Check for problematic process references
        const processEnvCount = (jsContent.match(/process\.env/g) || []).length;
        const typeofProcessCount = (jsContent.match(/typeof process/g) || []).length;
        const processCwdCount = (jsContent.match(/process\.cwd/g) || []).length;
        
        console.log(`\n⚠️  Process references found:`);
        console.log(`   - process.env: ${processEnvCount}`);
        console.log(`   - typeof process: ${typeofProcessCount}`);
        console.log(`   - process.cwd: ${processCwdCount}`);
        
        // Check if error handling exists
        const hasErrorBoundary = jsContent.includes('ErrorBoundary');
        const hasReactApp = jsContent.includes('React') && jsContent.includes('ReactDOM');
        
        console.log(`\n🔧 App structure:`);
        console.log(`   - React app present: ${hasReactApp}`);
        console.log(`   - Error boundary present: ${hasErrorBoundary}`);
        
        // Look for our app-specific code
        const hasLogin = jsContent.includes('Login') || jsContent.includes('login');
        const hasDashboard = jsContent.includes('Dashboard') || jsContent.includes('dashboard');
        const hasSupabase = jsContent.includes('supabase');
        
        console.log(`\n📱 App components:`);
        console.log(`   - Login component: ${hasLogin}`);
        console.log(`   - Dashboard component: ${hasDashboard}`);
        console.log(`   - Supabase integration: ${hasSupabase}`);
        
        // Final verdict
        console.log('\n' + '='.repeat(50));
        if (processEnvCount > 0 || typeofProcessCount > 0) {
            console.log('❌ FAIL: Process references found in production bundle');
            console.log('   This WILL cause "process is not defined" errors');
            console.log('   The page will show a WHITE SCREEN');
        } else if (!hasReactApp) {
            console.log('❌ FAIL: React not found in bundle');
            console.log('   The page will show a WHITE SCREEN');
        } else {
            console.log('✅ PASS: Site should work without errors');
            console.log('   No critical process references found');
            console.log('   React app is present and should render');
        }
        
    } catch (error) {
        console.error('❌ Error testing site:', error.message);
    }
}

testProduction();