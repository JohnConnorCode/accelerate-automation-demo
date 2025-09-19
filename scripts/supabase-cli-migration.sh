#!/bin/bash

# Last attempt: Use Supabase CLI to execute the migration
# This might work if we can link to the remote project

echo "🚀 Attempting Supabase CLI migration..."
echo "======================================="

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install with:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"

# Try to initialize/link to the project
echo "🔗 Attempting to link to Supabase project..."

# Create a temporary supabase directory if it doesn't exist
if [ ! -d "supabase" ]; then
    echo "📁 Creating supabase directory..."
    mkdir supabase
fi

# Try different linking approaches
echo "🔄 Trying project link..."

# Method 1: Link by project ref
supabase link --project-ref eqpfvmwmdtsgddpsodsr --debug 2>&1 | tee /tmp/supabase-link.log

if [ $? -eq 0 ]; then
    echo "✅ Project linked successfully!"

    # Try to execute the SQL
    echo "📝 Executing SQL migration..."
    supabase db reset --debug

    if [ -f "scripts/create-essential-tables.sql" ]; then
        echo "🔧 Applying migration..."
        supabase db push --include-all --debug

        # Alternative: Use psql directly
        echo "🔄 Trying direct SQL execution..."
        cat scripts/create-essential-tables.sql | supabase db reset --debug

    else
        echo "❌ SQL file not found: scripts/create-essential-tables.sql"
        exit 1
    fi

else
    echo "❌ Failed to link project. Trying alternative approach..."

    # Method 2: Try with access token (if available)
    if [ ! -z "$SUPABASE_ACCESS_TOKEN" ]; then
        echo "🔑 Using access token..."
        supabase login --token $SUPABASE_ACCESS_TOKEN
        supabase link --project-ref eqpfvmwmdtsgddpsodsr
    fi

    # Method 3: Manual approach
    echo "📋 CLI approach failed. Manual execution required."
    echo ""
    echo "Please execute the migration manually:"
    echo "1. Go to: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql"
    echo "2. Paste the SQL from: scripts/create-essential-tables.sql"
    echo "3. Click 'Run'"
    echo ""
    echo "Or try this command if you have the correct access token:"
    echo "export SUPABASE_ACCESS_TOKEN=your-token"
    echo "./scripts/supabase-cli-migration.sh"

    exit 1
fi

# Verify the migration worked
echo "🔍 Verifying migration..."
npx tsx scripts/final-migration-executor.ts

echo "✅ Migration attempt complete!"