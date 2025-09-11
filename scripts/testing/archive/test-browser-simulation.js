const https = require('https');

console.log('🌐 Simulating browser visit to https://accelerate-content-automation.vercel.app\n');

// Step 1: Get the HTML page
https.get('https://accelerate-content-automation.vercel.app/', (res) => {
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
        console.log('✅ HTML page loaded successfully');
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers['content-type']}`);
        
        // Extract JavaScript files
        const jsFiles = html.match(/\/assets\/[^"]+\.js/g) || [];
        console.log(`\n📦 JavaScript bundles found: ${jsFiles.length}`);
        jsFiles.forEach(file => console.log(`   - ${file}`));
        
        if (jsFiles.length === 0) {
            console.log('\n❌ No JavaScript files found - site will be blank!');
            return;
        }
        
        // Step 2: Load the main JS bundle
        const mainJs = jsFiles.find(f => f.includes('index')) || jsFiles[0];
        console.log(`\n📥 Loading main bundle: ${mainJs}`);
        
        https.get(`https://accelerate-content-automation.vercel.app${mainJs}`, (jsRes) => {
            let jsContent = '';
            jsRes.on('data', chunk => jsContent += chunk);
            jsRes.on('end', () => {
                const sizeKB = (jsContent.length / 1024).toFixed(2);
                console.log(`✅ JavaScript loaded: ${sizeKB} KB`);
                
                // Step 3: Check for critical errors
                console.log('\n🔍 Analyzing JavaScript for issues:');
                
                const checks = [
                    { pattern: /process\.env(?!\.)/g, name: 'process.env references' },
                    { pattern: /typeof process/g, name: 'typeof process checks' },
                    { pattern: /process\.cwd/g, name: 'process.cwd calls' },
                    { pattern: /process\.exit/g, name: 'process.exit calls' },
                    { pattern: /require\(/g, name: 'require() calls' },
                ];
                
                let hasErrors = false;
                checks.forEach(check => {
                    const matches = (jsContent.match(check.pattern) || []).length;
                    if (matches > 0) {
                        console.log(`   ❌ ${check.name}: ${matches} found`);
                        hasErrors = true;
                    } else {
                        console.log(`   ✅ ${check.name}: None`);
                    }
                });
                
                // Step 4: Check for app components
                console.log('\n🎯 Checking for app components:');
                const components = [
                    { name: 'React', found: jsContent.includes('React') },
                    { name: 'ReactDOM', found: jsContent.includes('ReactDOM') },
                    { name: 'Login', found: jsContent.includes('Login') || jsContent.includes('login') },
                    { name: 'Dashboard', found: jsContent.includes('Dashboard') || jsContent.includes('dashboard') },
                    { name: 'Supabase', found: jsContent.includes('supabase') },
                    { name: 'Router', found: jsContent.includes('Router') || jsContent.includes('router') },
                ];
                
                components.forEach(comp => {
                    console.log(`   ${comp.found ? '✅' : '❌'} ${comp.name}: ${comp.found ? 'Present' : 'Missing'}`);
                });
                
                // Step 5: Final verdict
                console.log('\n' + '='.repeat(60));
                if (hasErrors) {
                    console.log('⚠️  WARNING: Found potential issues that may cause errors');
                    console.log('   The site might show a white screen in some browsers');
                } else if (!components[0].found || !components[1].found) {
                    console.log('❌ FAIL: React not found - site will be blank!');
                } else if (!components[2].found) {
                    console.log('⚠️  WARNING: Login component not detected');
                    console.log('   But the app should still render');
                } else {
                    console.log('✅ SUCCESS: Site appears to be working correctly!');
                    console.log('   - No critical errors found');
                    console.log('   - React app will render');
                    console.log('   - Login functionality present');
                }
                console.log('='.repeat(60));
                
                // Step 6: Simulate what a user would see
                console.log('\n👤 What a user would see:');
                if (!hasErrors && components[0].found && components[1].found) {
                    console.log('   1. Page loads with "Accelerate Content Automation" title');
                    console.log('   2. React app renders in <div id="root">');
                    if (components[2].found) {
                        console.log('   3. Login form appears');
                        console.log('   4. User can enter credentials');
                    }
                    if (components[3].found) {
                        console.log('   5. After login, dashboard is available');
                    }
                } else {
                    console.log('   ❌ White/blank screen with possible console errors');
                }
            });
        }).on('error', err => {
            console.log(`❌ Failed to load JavaScript: ${err.message}`);
        });
    });
}).on('error', err => {
    console.log(`❌ Failed to load page: ${err.message}`);
});
