# Notehub Proxy Setup Guide

This guide explains how to set up the Notehub proxy integration with your Supabase Edge Function.

## Architecture Overview

```
Frontend (Browser)
    ↓ (calls with Supabase auth)
Supabase Edge Function (notehub-proxy)
    ↓ (authenticates with OAuth2)
Notehub API (api.notefile.net)
```

The proxy keeps your Notehub credentials secure by handling authentication on the server side.

---

## Step 1: Get Notehub Credentials

### 1.1 Log in to Notehub.io
Go to https://notehub.io and log in to your account.

### 1.2 Find Your Project UID
1. Navigate to your project
2. The URL will look like: `https://notehub.io/project/app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0`
3. Copy the entire project UID including the `app:` prefix
   - Example: `app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0`
   - In your `.env` file, you can store it **without** the `app:` prefix (the code adds it automatically)

### 1.3 Create OAuth2 Client Credentials
1. In Notehub, go to **Settings** → **OAuth Clients** (or similar)
2. Click **Create New Client**
3. Give it a name like "SonoMicro Platform"
4. Select the appropriate scopes (at minimum: read devices, read events)
5. Save and copy:
   - **Client ID** (example: `0de98d7e-8c88-4fd2-9732-2b7b2897e93d`)
   - **Client Secret** (example: `c0cc55868e77c25488016fe224d6c6bedc1c5ccb6579faf62d8076ec76f2f75c`)

---

## Step 2: Configure Environment Variables

### 2.1 Local Development (.env file)
Update your `.env` file with:

```bash
# Supabase Configuration (already set)
VITE_SUPABASE_URL=https://xrmwxqhhaeahabeppvuk.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Notehub Configuration (frontend needs these)
VITE_NOTEHUB_PROJECT_UID=7c135a20-7d42-4a5e-a4a6-059bb04a72c0

# DO NOT include these in VITE_ variables (security risk!)
# These are for reference only - set them in Supabase Dashboard
NOTEHUB_CLIENT_ID=0de98d7e-8c88-4fd2-9732-2b7b2897e93d
NOTEHUB_CLIENT_SECRET=c0cc55868e77c25488016fe224d6c6bedc1c5ccb6579faf62d8076ec76f2f75c
```

**Important Security Notes:**
- ✅ `VITE_*` variables are safe for the browser (they become public)
- ❌ `NOTEHUB_CLIENT_ID` and `NOTEHUB_CLIENT_SECRET` must NEVER have `VITE_` prefix
- The edge function reads these from `Deno.env.get()`, not from browser variables

---

## Step 3: Configure Supabase Edge Function

### 3.1 Set Environment Variables in Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/xrmwxqhhaeahabeppvuk
2. Navigate to **Edge Functions** in the left sidebar
3. Click on the **notehub-proxy** function
4. Go to the **Settings** or **Environment Variables** tab
5. Add these two variables:

| Variable Name | Value |
|--------------|-------|
| `NOTEHUB_CLIENT_ID` | `0de98d7e-8c88-4fd2-9732-2b7b2897e93d` |
| `NOTEHUB_CLIENT_SECRET` | `c0cc55868e77c25488016fe224d6c6bedc1c5ccb6579faf62d8076ec76f2f75c` |

6. Save the changes

### 3.2 Verify Edge Function is Deployed

The function should already be deployed. You can verify by checking:
- **Status**: Should show "ACTIVE"
- **JWT Verification**: Should be **enabled** (this is correct)

---

## Step 4: How It Works

### Frontend Makes Request
```typescript
// src/services/notehub.ts
const response = await notehubApi.get(
  `/v1/projects/${PROJECT_UID}/devices`
);
```

This sends a request to:
```
https://xrmwxqhhaeahabeppvuk.supabase.co/functions/v1/notehub-proxy/v1/projects/app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0/devices
```

With headers:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
apikey: <SUPABASE_ANON_KEY>
Content-Type: application/json
```

### Edge Function Processes Request
1. Validates the Supabase JWT token (because `verifyJWT: true`)
2. Reads `NOTEHUB_CLIENT_ID` and `NOTEHUB_CLIENT_SECRET` from environment
3. Obtains OAuth2 access token from Notehub:
   ```
   POST https://notehub.io/oauth2/token
   grant_type=client_credentials
   client_id=...
   client_secret=...
   ```
4. Uses the access token to call Notehub API:
   ```
   GET https://api.notefile.net/v1/projects/app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0/devices
   Authorization: Bearer <NOTEHUB_ACCESS_TOKEN>
   ```
5. Returns the response to the frontend

---

## Step 5: Testing the Setup

### 5.1 Test from Command Line
Run the test script:
```bash
chmod +x test-notehub-proxy.sh
./test-notehub-proxy.sh
```

### 5.2 Check for Common Errors

#### Error: "Missing authorization header" (401)
- ✅ **FIXED**: Frontend now sends Supabase auth headers
- If still occurring: Check that `.env` has `VITE_SUPABASE_ANON_KEY` set

#### Error: "Notehub credentials not configured" (500)
- **Cause**: Edge function can't find `NOTEHUB_CLIENT_ID` or `NOTEHUB_CLIENT_SECRET`
- **Fix**: Set them in Supabase Dashboard → Edge Functions → notehub-proxy → Environment Variables

#### Error: "OAuth2 request failed" (500)
- **Cause**: Invalid Notehub client credentials
- **Fix**: Verify your Client ID and Secret in Notehub dashboard

#### Error: "Not found" (404)
- **Cause 1**: Project UID is incorrect
- **Fix**: Verify `VITE_NOTEHUB_PROJECT_UID` matches your Notehub project
- **Cause 2**: Edge function not deployed
- **Fix**: Deploy with `supabase functions deploy notehub-proxy`

#### Error: "Unauthorized" (401/403) from Notehub
- **Cause**: OAuth2 client doesn't have access to this project
- **Fix**: Check OAuth2 client permissions in Notehub dashboard

---

## Step 6: Verify in Browser

1. Start your development server (should already be running)
2. Open browser console (F12)
3. Navigate to the Admin Dashboard
4. Check the Network tab for requests to:
   ```
   https://xrmwxqhhaeahabeppvuk.supabase.co/functions/v1/notehub-proxy/v1/projects/...
   ```
5. Look for successful 200 responses

### Expected Console Logs
```
🔍 Fetching devices from Notehub via proxy...
📋 Using project UID: app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0
✅ Successfully fetched devices: [...]
```

---

## Troubleshooting Checklist

- [ ] Notehub OAuth2 client is created and active
- [ ] Client ID and Secret are correctly copied to Supabase
- [ ] Environment variables are set in Supabase Dashboard (not local .env)
- [ ] Project UID is correct and includes `app:` prefix (or code adds it)
- [ ] Edge function `notehub-proxy` is deployed and active
- [ ] Frontend has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set
- [ ] Browser console shows no CORS errors
- [ ] OAuth2 client has correct scopes/permissions in Notehub

---

## Security Notes

### ✅ Secure Setup (Current)
- Notehub credentials stored in Supabase Edge Function environment (server-side)
- Frontend only knows: Supabase URL, Project UID
- All Notehub API calls proxied through authenticated edge function

### ❌ Insecure Setup (Avoid)
- Never put `NOTEHUB_CLIENT_SECRET` in `.env` with `VITE_` prefix
- Never call Notehub API directly from browser
- Never commit real credentials to git

---

## Quick Reference

| What | Where | Example |
|------|-------|---------|
| Supabase URL | Browser env | `https://xrmwxqhhaeahabeppvuk.supabase.co` |
| Supabase Anon Key | Browser env | `eyJhbGc...` |
| Project UID | Browser env | `7c135a20-7d42-4a5e-a4a6-059bb04a72c0` |
| Client ID | Supabase Edge Function | `0de98d7e-8c88-4fd2-9732-2b7b2897e93d` |
| Client Secret | Supabase Edge Function | `c0cc558...` |

---

## Next Steps After Setup

Once the proxy is working:
1. Devices will load from Notehub in the Admin Dashboard
2. You can view device details, events, and firmware
3. Set up the webhook for real-time updates (optional)

For webhook setup, see the `notehub-webhook` edge function documentation.
