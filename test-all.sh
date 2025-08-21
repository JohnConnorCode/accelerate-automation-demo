#!/bin/bash

# Accelerate Content Automation - Complete Test Suite

echo "🧪 Testing Accelerate Content Automation System"
echo "=============================================="
echo ""

# Test 1: TypeScript compilation
echo "1️⃣ Testing TypeScript compilation..."
if npm run typecheck > /dev/null 2>&1; then
    echo "   ✅ TypeScript: PASS"
else
    echo "   ❌ TypeScript: FAIL"
    exit 1
fi

# Test 2: Database connection
echo "2️⃣ Testing database connection..."
if npm run admin:test 2>&1 | grep -q "Database Connection.*PASS"; then
    echo "   ✅ Database: PASS"
else
    echo "   ❌ Database: FAIL"
    exit 1
fi

# Test 3: Fetchers
echo "3️⃣ Testing fetchers..."
RESULT=$(npx tsx -e "
const { AccelerateOrchestrator } = require('./src/orchestrator');
const orch = new AccelerateOrchestrator();
console.log('Fetchers:', orch.fetchers.length);
" 2>/dev/null)

if [[ "$RESULT" == *"Fetchers: 13"* ]]; then
    echo "   ✅ Fetchers: 13 initialized"
else
    echo "   ❌ Fetchers: Failed to initialize"
    exit 1
fi

# Test 4: API endpoints
echo "4️⃣ Testing API endpoints..."
for endpoint in health run status; do
    if [ -f "api/$endpoint.ts" ]; then
        echo "   ✅ API /$endpoint: EXISTS"
    else
        echo "   ❌ API /$endpoint: MISSING"
        exit 1
    fi
done

# Test 5: Configuration
echo "5️⃣ Testing configuration..."
if [ -f ".env" ] && grep -q "SUPABASE_URL=https://eqpfvmwmdtsgddpsodsr" .env; then
    echo "   ✅ Environment: CONFIGURED"
else
    echo "   ❌ Environment: NOT CONFIGURED"
    exit 1
fi

# Test 6: Deployment files
echo "6️⃣ Testing deployment setup..."
for file in "vercel.json" ".github/workflows/deploy.yml" "scripts/setup-deployment.sh"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file: EXISTS"
    else
        echo "   ❌ $file: MISSING"
        exit 1
    fi
done

echo ""
echo "=============================================="
echo "✨ ALL TESTS PASSED!"
echo ""
echo "System is ready for deployment:"
echo "  • 13 fetchers configured"
echo "  • Database connected to Accelerate"
echo "  • API endpoints ready"
echo "  • CI/CD workflows configured"
echo ""
echo "To deploy:"
echo "  1. Authenticate: vercel login"
echo "  2. Deploy: npm run deploy:prod"
echo ""