#!/bin/bash

# Direct Supabase SQL execution via curl
# This script executes the production tables SQL using Supabase REST API

echo "🚀 Executing production tables SQL via Supabase API..."

SUPABASE_URL="https://eqpfvmwmdtsgddpsodsr.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODE3MjIxNiwiZXhwIjoxNzg5NzA4MjE2fQ.SP8w6qyeEQiiJmv9yMlRkEKo5YPVczsBT5DAi8OeoII"

# Test 1: Create accelerate_startups table
echo "Creating accelerate_startups table..."
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE IF NOT EXISTS public.accelerate_startups (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL, description TEXT, website TEXT, founders TEXT[] DEFAULT ARRAY[]::TEXT[], team_size INTEGER, location TEXT, country TEXT, funding_amount DECIMAL(15,2), funding_round TEXT, funding_investors TEXT[] DEFAULT ARRAY[]::TEXT[], technology_stack TEXT[] DEFAULT ARRAY[]::TEXT[], industry_tags TEXT[] DEFAULT ARRAY[]::TEXT[], source TEXT, source_url TEXT, accelerate_fit BOOLEAN DEFAULT true, accelerate_reason TEXT, accelerate_score DECIMAL(3,2) DEFAULT 0, approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), approved_by TEXT DEFAULT '\''admin'\'', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
  }'

echo -e "\n"

# Test 2: Create accelerate_investors table
echo "Creating accelerate_investors table..."
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE IF NOT EXISTS public.accelerate_investors (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, title TEXT NOT NULL, description TEXT, url TEXT UNIQUE NOT NULL, amount_min DECIMAL(15,2), amount_max DECIMAL(15,2), deadline TIMESTAMP WITH TIME ZONE, organization TEXT, eligibility_criteria JSONB DEFAULT '\''[]'\''::jsonb, source TEXT, metadata JSONB DEFAULT '\''{}'\''::jsonb, tags TEXT[] DEFAULT ARRAY[]::TEXT[], accelerate_fit BOOLEAN DEFAULT true, accelerate_reason TEXT, accelerate_score DECIMAL(3,2) DEFAULT 0, approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), approved_by TEXT DEFAULT '\''admin'\'', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
  }'

echo -e "\n"

# Test 3: Create accelerate_news table
echo "Creating accelerate_news table..."
curl -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "CREATE TABLE IF NOT EXISTS public.accelerate_news (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, title TEXT NOT NULL, description TEXT, url TEXT UNIQUE NOT NULL, category TEXT, author TEXT, published_date TIMESTAMP WITH TIME ZONE, source TEXT, metadata JSONB DEFAULT '\''{}'\''::jsonb, tags TEXT[] DEFAULT ARRAY[]::TEXT[], accelerate_fit BOOLEAN DEFAULT true, accelerate_reason TEXT, accelerate_score DECIMAL(3,2) DEFAULT 0, approved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), approved_by TEXT DEFAULT '\''admin'\'', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());"
  }'

echo -e "\n✅ Table creation commands executed!"
echo "Now verifying table existence..."

# Verify tables exist
echo "Checking accelerate_startups..."
curl -X GET "$SUPABASE_URL/rest/v1/accelerate_startups?select=id&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"

echo -e "\nChecking accelerate_investors..."
curl -X GET "$SUPABASE_URL/rest/v1/accelerate_investors?select=id&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"

echo -e "\nChecking accelerate_news..."
curl -X GET "$SUPABASE_URL/rest/v1/accelerate_news?select=id&limit=1" \
  -H "apikey: $SUPABASE_KEY" \
  -H "Authorization: Bearer $SUPABASE_KEY"

echo -e "\n\n🎉 Production tables setup complete!"