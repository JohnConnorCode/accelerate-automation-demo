#!/bin/bash

# Accelerate Content Automation - Automated Deployment Setup
# This script sets up GitHub repo and Vercel deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Accelerate Content Automation - Deployment Setup${NC}"
echo -e "${BLUE}=================================================${NC}\n"

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    echo "Or run: brew install gh"
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

# Check GitHub auth
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}🔐 Please authenticate with GitHub:${NC}"
    gh auth login
fi

# Check Vercel auth
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Please authenticate with Vercel:${NC}"
    vercel login
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}\n"

# Setup GitHub repository
echo -e "${YELLOW}📦 Setting up GitHub repository...${NC}"

# Get repository name
read -p "Enter repository name (default: accelerate-content-automation): " REPO_NAME
REPO_NAME=${REPO_NAME:-accelerate-content-automation}

# Check if repo already exists
if gh repo view "$REPO_NAME" &> /dev/null; then
    echo -e "${YELLOW}Repository already exists. Using existing repository.${NC}"
else
    # Create GitHub repository
    echo -e "${BLUE}Creating GitHub repository...${NC}"
    gh repo create "$REPO_NAME" \
        --private \
        --description "Automated content fetcher for Accelerate Platform" \
        --clone=false
    echo -e "${GREEN}✅ Repository created${NC}"
fi

# Get the repository URL
REPO_URL=$(gh repo view "$REPO_NAME" --json sshUrl -q .sshUrl)

# Add git remote if not exists
if ! git remote get-url origin &> /dev/null; then
    git remote add origin "$REPO_URL"
    echo -e "${GREEN}✅ Git remote added${NC}"
fi

# Initial commit
echo -e "${BLUE}Creating initial commit...${NC}"
git add .
git commit -m "Initial commit: Accelerate Content Automation v2.0" || true
git branch -M main
git push -u origin main || echo -e "${YELLOW}Push failed - you may need to pull first${NC}"

echo -e "${GREEN}✅ GitHub repository setup complete${NC}\n"

# Setup Vercel project
echo -e "${YELLOW}⚡ Setting up Vercel deployment...${NC}"

# Check if already linked
if [ -f ".vercel/project.json" ]; then
    echo -e "${YELLOW}Vercel project already linked${NC}"
else
    echo -e "${BLUE}Linking to Vercel...${NC}"
    vercel link
fi

# Get Vercel project details
VERCEL_ORG_ID=$(cat .vercel/project.json | grep -o '"orgId":"[^"]*' | cut -d'"' -f4)
VERCEL_PROJECT_ID=$(cat .vercel/project.json | grep -o '"projectId":"[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}✅ Vercel project linked${NC}"
echo "   Org ID: $VERCEL_ORG_ID"
echo "   Project ID: $VERCEL_PROJECT_ID"

# Setup environment variables in Vercel
echo -e "\n${YELLOW}🔐 Setting up Vercel environment variables...${NC}"

# Read from .env file
if [ -f ".env" ]; then
    echo -e "${BLUE}Reading from .env file...${NC}"
    
    # Core variables
    SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2)
    SUPABASE_ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2)
    CRON_SCHEDULE=$(grep CRON_SCHEDULE .env | cut -d '=' -f2)
    
    # Set in Vercel
    echo "Setting SUPABASE_URL..."
    echo "$SUPABASE_URL" | vercel env add SUPABASE_URL production
    
    echo "Setting SUPABASE_ANON_KEY..."
    echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY production
    
    echo "Setting CRON_SCHEDULE..."
    echo "${CRON_SCHEDULE:-0 0 * * *}" | vercel env add CRON_SCHEDULE production
    
    # Optional API keys
    if grep -q "GITHUB_TOKEN=" .env && [ "$(grep GITHUB_TOKEN= .env | cut -d '=' -f2)" != "" ]; then
        echo "Setting GITHUB_TOKEN..."
        grep GITHUB_TOKEN= .env | cut -d '=' -f2 | vercel env add GITHUB_TOKEN production
    fi
    
    if grep -q "TWITTER_BEARER_TOKEN=" .env && [ "$(grep TWITTER_BEARER_TOKEN= .env | cut -d '=' -f2)" != "" ]; then
        echo "Setting TWITTER_BEARER_TOKEN..."
        grep TWITTER_BEARER_TOKEN= .env | cut -d '=' -f2 | vercel env add TWITTER_BEARER_TOKEN production
    fi
    
    echo -e "${GREEN}✅ Environment variables set${NC}"
else
    echo -e "${RED}❌ No .env file found${NC}"
    exit 1
fi

# Get Vercel token for GitHub Actions
echo -e "\n${YELLOW}🔑 Setting up GitHub secrets for CI/CD...${NC}"

echo "Getting Vercel token..."
VERCEL_TOKEN=$(vercel tokens create accelerate-automation 2>/dev/null | tail -n 1)

# Set GitHub secrets
echo -e "${BLUE}Setting GitHub secrets...${NC}"
gh secret set VERCEL_TOKEN --body "$VERCEL_TOKEN"
gh secret set VERCEL_ORG_ID --body "$VERCEL_ORG_ID"
gh secret set VERCEL_PROJECT_ID --body "$VERCEL_PROJECT_ID"
gh secret set CRON_SCHEDULE --body "${CRON_SCHEDULE:-0 0 * * *}"

# Generate API secret for manual triggers
API_SECRET=$(openssl rand -hex 32)
gh secret set API_SECRET --body "$API_SECRET"
echo "$API_SECRET" | vercel env add API_SECRET production

# Get deployment URL
DEPLOYMENT_URL=$(vercel --prod --yes 2>/dev/null | grep "Production:" | awk '{print $2}')
if [ -z "$DEPLOYMENT_URL" ]; then
    DEPLOYMENT_URL="https://$REPO_NAME.vercel.app"
fi
gh secret set DEPLOYMENT_URL --body "$DEPLOYMENT_URL"

echo -e "${GREEN}✅ GitHub secrets configured${NC}"

# Final deployment
echo -e "\n${YELLOW}🚀 Deploying to production...${NC}"
npm run predeploy
vercel --prod

echo -e "\n${GREEN}✨ Setup Complete!${NC}"
echo -e "${GREEN}=================${NC}\n"

echo "📊 Your deployment is ready:"
echo "   • Production URL: $DEPLOYMENT_URL"
echo "   • Health Check: $DEPLOYMENT_URL/api/health"
echo "   • Manual Trigger: $DEPLOYMENT_URL/api/run"
echo ""
echo "🔐 Secrets configured:"
echo "   • GitHub Actions will auto-deploy on push to main"
echo "   • Vercel will run cron: ${CRON_SCHEDULE:-0 0 * * *}"
echo "   • API Secret for manual triggers: Stored securely"
echo ""
echo "📝 Next steps:"
echo "   1. Visit $DEPLOYMENT_URL/api/health to verify"
echo "   2. Check GitHub Actions tab for CI/CD status"
echo "   3. Monitor Vercel dashboard for cron executions"
echo ""
echo "🎉 Happy automating!"