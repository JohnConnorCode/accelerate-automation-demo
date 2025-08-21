#!/bin/bash

echo "🚀 Accelerate Content Automation - Setup Script"
echo "================================================"
echo ""

# Check for required tools
echo "Checking requirements..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ Node.js and npm found"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

echo ""
echo "Building TypeScript..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env.local and add your credentials:"
echo "   cp .env.example .env.local"
echo ""
echo "2. Get your Supabase service key from:"
echo "   https://app.supabase.com/project/eqpfvmwmdtsgddpsodsr/settings/api"
echo ""
echo "3. Test locally:"
echo "   node test-system.js"
echo ""
echo "4. Deploy to Vercel:"
echo "   npx vercel"
echo ""
echo "5. View admin dashboard:"
echo "   open public/admin.html"