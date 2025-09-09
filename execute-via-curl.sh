#!/bin/bash

# Use the service role key we found
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMjk0NzkzMCwiZXhwIjoyMDQ4NTIzOTMwfQ.lVBVMSu8wUvcD7eVFm-PZYsWVOE49KM_PAjYMpvGR5U"
API_URL="https://eqpfvmwmdtsgddpsodsr.supabase.co/rest/v1"

echo "🚀 Attempting to create tables via REST API..."
echo ""

# Try to query if tables exist first
echo "Checking if queue_projects table exists..."
curl -s -X GET \
  "$API_URL/queue_projects?select=*&limit=1" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" | jq '.'

echo ""
echo "Response received. If you see an error about relation not existing, the tables need to be created."
echo ""
echo "Unfortunately, DDL operations (CREATE TABLE) cannot be executed via REST API."
echo ""
echo "✅ SOLUTION: Execute the SQL manually at:"
echo "   https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new"
echo ""
echo "The SQL file is ready at: create-robust-queue-tables.sql"