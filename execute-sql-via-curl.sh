#!/bin/bash

echo "🔨 EXECUTING SQL VIA SUPABASE REST API..."
echo

# Set variables
SUPABASE_URL="https://eqpfvmwmdtsgddpsodsr.supabase.co"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ"

echo "1️⃣ Testing queued_projects table access..."
curl -X GET "${SUPABASE_URL}/rest/v1/queued_projects?limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --silent --write-out "\nHTTP Status: %{http_code}\n" | jq . 2>/dev/null || echo "Raw response (not JSON)"

echo
echo "2️⃣ Testing queued_funding_programs table access..."
curl -X GET "${SUPABASE_URL}/rest/v1/queued_funding_programs?limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --silent --write-out "\nHTTP Status: %{http_code}\n" | jq . 2>/dev/null || echo "Raw response (not JSON)"

echo
echo "3️⃣ Testing queued_resources table access..."
curl -X GET "${SUPABASE_URL}/rest/v1/queued_resources?limit=1" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  --silent --write-out "\nHTTP Status: %{http_code}\n" | jq . 2>/dev/null || echo "Raw response (not JSON)"

echo
echo "4️⃣ Attempting test insertion into queued_projects..."
curl -X POST "${SUPABASE_URL}/rest/v1/queued_projects" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "name": "Test Project Via Curl",
    "description": "Test",
    "url": "https://test-curl-'$(date +%s)'.com",
    "source": "curl-test",
    "score": 50,
    "status": "pending_review"
  }' \
  --write-out "\nHTTP Status: %{http_code}\n"

echo
echo "============================================================"
echo "📋 MANUAL SQL EXECUTION REQUIRED"
echo "If the above shows errors, execute this SQL in Supabase Dashboard:"
echo "https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new"
echo
cat fix-staging-constraints.sql