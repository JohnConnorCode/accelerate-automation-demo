#!/bin/bash

echo "🚀 Accelerate Content Automation - Local Runner"
echo "=============================================="
echo ""

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded"
else
    echo "❌ .env.local not found"
    echo "   Run: cp .env.example .env.local"
    exit 1
fi

# Check if TypeScript is built
if [ ! -d "dist" ]; then
    echo "Building TypeScript..."
    npm run build
fi

echo ""
echo "What would you like to do?"
echo "1. Fetch content from all sources"
echo "2. Score pending content with AI"
echo "3. View queue statistics"
echo "4. Test individual fetcher"
echo "5. Run full automation cycle"
echo "6. Open admin dashboard"
echo ""
read -p "Enter choice (1-6): " choice

case $choice in
    1)
        echo "Fetching content..."
        node -e "
        require('dotenv').config({ path: '.env.local' });
        const handler = require('./dist/api/cron/fetch-content').default;
        handler(
            { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } },
            {
                status: (code) => ({
                    json: (data) => {
                        console.log('Status:', code);
                        console.log('Result:', JSON.stringify(data, null, 2));
                    }
                })
            }
        ).catch(console.error);
        "
        ;;
    
    2)
        echo "Scoring content..."
        node -e "
        require('dotenv').config({ path: '.env.local' });
        const handler = require('./dist/api/cron/score-content').default;
        handler(
            { headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } },
            {
                status: (code) => ({
                    json: (data) => {
                        console.log('Status:', code);
                        console.log('Result:', JSON.stringify(data, null, 2));
                    }
                })
            }
        ).catch(console.error);
        "
        ;;
    
    3)
        echo "Getting queue statistics..."
        node -e "
        require('dotenv').config({ path: '.env.local' });
        const handler = require('./dist/api/admin/queue').default;
        handler(
            { method: 'GET', query: {} },
            {
                setHeader: () => {},
                status: (code) => ({
                    json: (data) => {
                        console.log('Status:', code);
                        console.log('Queue Statistics:');
                        if (data.success && data.data) {
                            console.log('  Total items:', data.data.length);
                            const byStatus = {};
                            data.data.forEach(item => {
                                byStatus[item.status] = (byStatus[item.status] || 0) + 1;
                            });
                            console.log('  By status:', byStatus);
                            const byType = {};
                            data.data.forEach(item => {
                                byType[item.content_type] = (byType[item.content_type] || 0) + 1;
                            });
                            console.log('  By type:', byType);
                        }
                    }
                })
            }
        ).catch(console.error);
        "
        ;;
    
    4)
        echo "Available fetchers:"
        echo "1. ProductHunt"
        echo "2. Dev.to"
        echo "3. GitHub Tools"
        echo "4. GitHub Repos"
        echo "5. Gitcoin"
        echo "6. Web3 Grants"
        read -p "Select fetcher (1-6): " fetcher
        
        node test-fetchers.js | grep -A 5 "Testing"
        ;;
    
    5)
        echo "Running full automation cycle..."
        echo ""
        echo "Step 1: Fetching content..."
        $0 <<< "1" > /dev/null 2>&1
        sleep 2
        
        echo "Step 2: Scoring with AI..."
        $0 <<< "2" > /dev/null 2>&1
        sleep 2
        
        echo "Step 3: Getting results..."
        $0 <<< "3"
        ;;
    
    6)
        echo "Opening admin dashboard..."
        open public/admin.html
        ;;
    
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✨ Done!"