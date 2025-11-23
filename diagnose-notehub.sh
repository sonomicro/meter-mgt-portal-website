#!/bin/bash

# Notehub Proxy Diagnostic Script
# This script helps diagnose connection issues with the Notehub proxy

set -e

echo "🔍 Notehub Proxy Diagnostic Tool"
echo "=================================="
echo ""

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Check required variables
echo "📋 Step 1: Checking environment variables..."
echo ""

ERRORS=0

if [ -z "$VITE_SUPABASE_URL" ]; then
  echo "❌ VITE_SUPABASE_URL is not set"
  ERRORS=$((ERRORS+1))
else
  echo "✅ VITE_SUPABASE_URL: $VITE_SUPABASE_URL"
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ VITE_SUPABASE_ANON_KEY is not set"
  ERRORS=$((ERRORS+1))
else
  echo "✅ VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY:0:20}..."
fi

if [ -z "$VITE_NOTEHUB_PROJECT_UID" ]; then
  echo "❌ VITE_NOTEHUB_PROJECT_UID is not set"
  ERRORS=$((ERRORS+1))
else
  echo "✅ VITE_NOTEHUB_PROJECT_UID: $VITE_NOTEHUB_PROJECT_UID"
fi

# Check if project UID has app: prefix
PROJECT_UID="$VITE_NOTEHUB_PROJECT_UID"
if [[ ! "$PROJECT_UID" == app:* ]]; then
  PROJECT_UID="app:$PROJECT_UID"
  echo "ℹ️  Note: Will use app:$VITE_NOTEHUB_PROJECT_UID (prefix added automatically)"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "❌ Found $ERRORS error(s) in environment configuration"
  echo "Please check your .env file"
  exit 1
fi

echo "✅ All frontend environment variables are set correctly"
echo ""

# Test edge function availability
echo "📡 Step 2: Testing edge function availability..."
echo ""

EDGE_FUNCTION_URL="$VITE_SUPABASE_URL/functions/v1/notehub-proxy"

echo "Testing OPTIONS request (CORS preflight)..."
HTTP_CODE=$(curl -s -o /tmp/notehub-test.txt -w "%{http_code}" -X OPTIONS \
  "$EDGE_FUNCTION_URL" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  2>&1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
  echo "✅ Edge function is accessible (HTTP $HTTP_CODE)"
else
  echo "❌ Edge function returned HTTP $HTTP_CODE"
  echo "Response:"
  cat /tmp/notehub-test.txt
  echo ""
  echo "This could mean:"
  echo "  - Edge function is not deployed"
  echo "  - Wrong Supabase URL"
  echo "  - Edge function has an error"
  exit 1
fi

echo ""

# Test Notehub device fetch
echo "🔌 Step 3: Testing Notehub device fetch..."
echo ""

DEVICES_URL="$EDGE_FUNCTION_URL/v1/projects/$PROJECT_UID/devices"
echo "Fetching from: $DEVICES_URL"
echo ""

HTTP_CODE=$(curl -s -o /tmp/notehub-devices.txt -w "%{http_code}" -X GET \
  "$DEVICES_URL" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  2>&1)

echo "HTTP Status: $HTTP_CODE"
echo ""
echo "Response:"
cat /tmp/notehub-devices.txt | jq '.' 2>/dev/null || cat /tmp/notehub-devices.txt
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Successfully fetched devices from Notehub!"
  echo ""

  # Count devices
  DEVICE_COUNT=$(cat /tmp/notehub-devices.txt | jq '.devices | length' 2>/dev/null || echo "unknown")
  if [ "$DEVICE_COUNT" != "unknown" ]; then
    echo "📊 Found $DEVICE_COUNT device(s)"
  fi

elif [ "$HTTP_CODE" = "401" ]; then
  echo "❌ Authentication failed (401)"
  echo ""
  echo "Possible causes:"
  echo "  1. VITE_SUPABASE_ANON_KEY is incorrect"
  echo "  2. Edge function has verifyJWT enabled but token is invalid"
  echo ""
  echo "Solutions:"
  echo "  - Verify VITE_SUPABASE_ANON_KEY in .env matches Supabase dashboard"
  echo "  - Check that the key hasn't expired"

elif [ "$HTTP_CODE" = "500" ]; then
  echo "❌ Server error (500)"
  echo ""

  # Check if it's a credentials error
  if grep -q "credentials not configured" /tmp/notehub-devices.txt; then
    echo "🔑 Notehub credentials are not configured in the edge function!"
    echo ""
    echo "You need to set these in Supabase Dashboard:"
    echo "  1. Go to: https://supabase.com/dashboard"
    echo "  2. Select your project: xrmwxqhhaeahabeppvuk"
    echo "  3. Navigate to: Edge Functions → notehub-proxy → Settings"
    echo "  4. Add environment variables:"
    echo "     - NOTEHUB_CLIENT_ID"
    echo "     - NOTEHUB_CLIENT_SECRET"
    echo ""
    echo "Get these values from:"
    echo "  https://notehub.io → Your Project → Settings → OAuth Clients"
  else
    echo "Unknown server error. Response:"
    cat /tmp/notehub-devices.txt
  fi

elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ Forbidden (403)"
  echo ""
  echo "Possible causes:"
  echo "  1. Notehub OAuth2 client doesn't have permission for this project"
  echo "  2. Project UID is incorrect"
  echo ""
  echo "Solutions:"
  echo "  - Verify project UID: $PROJECT_UID"
  echo "  - Check OAuth2 client permissions in Notehub dashboard"

elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ Not found (404)"
  echo ""
  echo "Possible causes:"
  echo "  1. Project UID is incorrect: $PROJECT_UID"
  echo "  2. Edge function path is wrong"
  echo ""
  echo "Solutions:"
  echo "  - Verify VITE_NOTEHUB_PROJECT_UID in .env"
  echo "  - Check project exists in Notehub: https://notehub.io"
else
  echo "❌ Unexpected HTTP status: $HTTP_CODE"
  echo "Response:"
  cat /tmp/notehub-devices.txt
fi

echo ""
echo "=================================="
echo "Diagnostic complete!"
echo ""

# Cleanup
rm -f /tmp/notehub-test.txt /tmp/notehub-devices.txt

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ All systems operational!"
  echo ""
  echo "Your Notehub proxy is working correctly."
  echo "Devices should load in your application."
  exit 0
else
  echo "❌ Issues detected"
  echo ""
  echo "Please review the errors above and:"
  echo "  1. Check NOTEHUB_SETUP_GUIDE.md for detailed setup instructions"
  echo "  2. Verify all environment variables in Supabase Dashboard"
  echo "  3. Ensure OAuth2 client is created in Notehub"
  exit 1
fi
