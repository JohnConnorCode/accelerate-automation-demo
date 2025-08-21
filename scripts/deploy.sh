#!/bin/bash

# Accelerate Content Automation - Production Deployment Script
# This script handles the complete deployment process to Vercel

set -e  # Exit on error

echo "🚀 Accelerate Content Automation - Deployment Script"
echo "===================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    # Check Vercel CLI
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
        npm i -g vercel
    fi
    
    # Check environment file
    if [ ! -f ".env.local" ]; then
        echo -e "${RED}❌ .env.local not found${NC}"
        echo "Please create .env.local with your configuration"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
    echo ""
}

# Build the project
build_project() {
    echo "🔨 Building project..."
    
    # Clean previous build
    rm -rf dist
    
    # Install dependencies
    npm install
    
    # Build TypeScript
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Build successful${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    echo ""
}

# Run tests
run_tests() {
    echo "🧪 Running tests..."
    
    # Run TypeScript check
    npx tsc --noEmit
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ TypeScript errors found${NC}"
        exit 1
    fi
    
    # Run fetcher tests
    node test-fetchers.js > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Tests passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Some tests failed (non-blocking)${NC}"
    fi
    echo ""
}

# Database setup check
check_database() {
    echo "🗄️  Checking database..."
    
    # Test database connection
    node -e "
    require('dotenv').config({ path: '.env.local' });
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );
    
    supabase.from('content_queue')
        .select('count', { count: 'exact', head: true })
        .then(({ error }) => {
            if (error) {
                console.error('Database not configured:', error.message);
                process.exit(1);
            } else {
                console.log('Database connection successful');
            }
        });
    " 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database connected${NC}"
    else
        echo -e "${YELLOW}⚠️  Database tables may not be created${NC}"
        echo "   Run database/schema.sql in Supabase"
    fi
    echo ""
}

# Deploy to Vercel
deploy_to_vercel() {
    echo "☁️  Deploying to Vercel..."
    echo ""
    
    # Check if already linked
    if [ ! -f ".vercel/project.json" ]; then
        echo "First time deployment - linking to Vercel project"
        vercel link
    fi
    
    # Deploy based on environment
    read -p "Deploy to production? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Deploying to production..."
        vercel --prod
    else
        echo "Deploying to preview..."
        vercel
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Deployment successful${NC}"
    else
        echo -e "${RED}❌ Deployment failed${NC}"
        exit 1
    fi
    echo ""
}

# Set environment variables
set_env_vars() {
    echo "🔐 Setting environment variables..."
    
    read -p "Configure environment variables in Vercel? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Read from .env.local and set in Vercel
        while IFS='=' read -r key value; do
            # Skip comments and empty lines
            if [[ ! "$key" =~ ^# ]] && [[ -n "$key" ]]; then
                echo "Setting $key..."
                vercel env add "$key" production < <(echo "$value")
            fi
        done < .env.local
        
        echo -e "${GREEN}✅ Environment variables configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Remember to set environment variables in Vercel dashboard${NC}"
    fi
    echo ""
}

# Verify deployment
verify_deployment() {
    echo "✅ Verifying deployment..."
    
    # Get deployment URL
    DEPLOYMENT_URL=$(vercel ls --json | jq -r '.[0].url' 2>/dev/null)
    
    if [ -n "$DEPLOYMENT_URL" ]; then
        echo "Deployment URL: https://$DEPLOYMENT_URL"
        
        # Test health endpoint
        HEALTH_STATUS=$(curl -s "https://$DEPLOYMENT_URL/api/health" | jq -r '.status' 2>/dev/null)
        
        if [ "$HEALTH_STATUS" = "healthy" ]; then
            echo -e "${GREEN}✅ Health check passed${NC}"
        else
            echo -e "${YELLOW}⚠️  Health check failed or pending${NC}"
        fi
    fi
    echo ""
}

# Post-deployment tasks
post_deployment() {
    echo "📝 Post-deployment tasks..."
    echo ""
    echo "1. Verify cron jobs are registered:"
    echo "   vercel crons ls"
    echo ""
    echo "2. Test manual fetch:"
    echo "   curl -X POST https://your-app.vercel.app/api/cron/fetch-content \\"
    echo "     -H 'Authorization: Bearer YOUR_CRON_SECRET'"
    echo ""
    echo "3. View admin dashboard:"
    echo "   https://your-app.vercel.app/admin.html"
    echo ""
    echo "4. Monitor logs:"
    echo "   vercel logs --follow"
    echo ""
}

# Main deployment flow
main() {
    check_prerequisites
    build_project
    run_tests
    check_database
    deploy_to_vercel
    set_env_vars
    verify_deployment
    post_deployment
    
    echo -e "${GREEN}🎉 Deployment complete!${NC}"
    echo ""
    echo "Your content automation system is now live!"
    echo "It will automatically fetch content according to the cron schedule."
}

# Run main function
main