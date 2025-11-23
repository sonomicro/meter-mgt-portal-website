#!/bin/bash

# Test script for Notehub proxy via Supabase Edge Function
# This script tests the authentication and device fetching through the proxy

SUPABASE_URL="https://xrmwxqhhaeahabeppvuk.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhybXd4cWhoYWVhaGFiZXBwdnVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU3NTI2NzEsImV4cCI6MjA1MTMyODY3MX0.VQgKhJhXOLdJhJhXOLdJhJhXOLdJhJhXOLdJhJhXOLd"
PROJECT_UID="7c135a20-7d42-4a5e-a4a6-059bb04a72c0"

echo "🔧 Testing Notehub proxy via Supabase Edge Function"
echo "📋 Configuration:"
echo "   Supabase URL: $SUPABASE_URL"
echo "   Project UID: $PROJECT_UID"
echo ""

echo "🚀 Step 1: Testing Edge Function availability..."
curl -X OPTIONS \
  "$SUPABASE_URL/functions/v1/notehub-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "🔍 Step 2: Fetching devices from Notehub via proxy..."
curl -X GET \
  "$SUPABASE_URL/functions/v1/notehub-proxy/v1/projects/$PROJECT_UID/devices" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "📊 Step 3: Fetching fleets from Notehub via proxy..."
curl -X GET \
  "$SUPABASE_URL/functions/v1/notehub-proxy/v1/projects/$PROJECT_UID/fleets" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -v

echo ""
echo ""

echo "✅ Test completed!"
echo ""
echo "Expected responses:"
echo "- Step 1: Should return 200 OK with CORS headers"
echo "- Step 2: Should return device list or empty array"
echo "- Step 3: Should return fleet list or empty array"
echo ""
echo "If you get 404 errors, check:"
echo "1. Edge Function is deployed: supabase functions deploy notehub-proxy"
echo "2. Environment variables are set in Supabase dashboard"
echo "3. Notehub credentials are correct"