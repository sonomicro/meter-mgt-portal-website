# Quick Fix: Notehub 404 Error

## Problem
Your Notehub proxy is returning 404 when trying to fetch devices.

## Root Cause
The edge function environment variables are **not set in Supabase**. The function is trying to authenticate with Notehub but failing.

## Solution: Set Environment Variables in Supabase

### Step-by-Step Instructions

1. **Go to Supabase Dashboard**
   - Open: https://supabase.com/dashboard/project/xrmwxqhhaeahabeppvuk

2. **Navigate to Edge Functions**
   - Click "Edge Functions" in the left sidebar
   - Find the `notehub-proxy` function
   - Click on it

3. **Add Environment Variables**
   - Look for "Settings", "Configuration", or "Environment Variables" tab
   - Click "Add Variable" or similar button
   - Add these TWO variables:

   **Variable 1:**
   ```
   Name: NOTEHUB_CLIENT_ID
   Value: 0de98d7e-8c88-4fd2-9732-2b7b2897e93d
   ```

   **Variable 2:**
   ```
   Name: NOTEHUB_CLIENT_SECRET
   Value: c0cc55868e77c25488016fe224d6c6bedc1c5ccb6579faf62d8076ec76f2f75c
   ```

4. **Save Changes**
   - Click "Save" or "Update"
   - The edge function will restart automatically with the new variables

5. **Test Again**
   - Run: `./diagnose-notehub.sh`
   - OR refresh your application
   - Devices should now load!

---

## Visual Guide

```
Supabase Dashboard
    └─ Edge Functions
        └─ notehub-proxy
            └─ Settings / Environment Variables
                ├─ NOTEHUB_CLIENT_ID = 0de98d7e...
                └─ NOTEHUB_CLIENT_SECRET = c0cc5586...
```

---

## Why This Happens

Your local `.env` file has these variables, but **edge functions don't read from local .env files**. They run on Supabase's servers and need variables set in the Supabase dashboard.

Think of it like this:
- ✅ Frontend (browser): reads from `.env` via `VITE_*` variables
- ✅ Edge Function (Supabase server): reads from Supabase dashboard environment variables
- ❌ Edge Function: does NOT read from your local `.env` file

---

## How to Verify It Worked

After setting the variables, you should see:

### In the diagnostic script:
```bash
./diagnose-notehub.sh
```

Expected output:
```
✅ All systems operational!
Your Notehub proxy is working correctly.
```

### In your browser console:
```
✅ Successfully fetched devices: [...array of devices...]
```

### In the Network tab:
- Status: 200 OK
- Response: JSON with devices array

---

## Still Not Working?

If you still get errors after setting the variables:

### Check Notehub OAuth Client
1. Go to https://notehub.io
2. Navigate to your project settings
3. Find "OAuth Clients" or "API Clients"
4. Verify the client exists and is active
5. Verify it has these permissions:
   - Read projects
   - Read devices
   - Read events

### Check Project UID
1. In Notehub, check your project URL
2. It should be: `https://notehub.io/project/app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0`
3. The UID should match: `7c135a20-7d42-4a5e-a4a6-059bb04a72c0` (or `app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0`)

### View Edge Function Logs
1. In Supabase Dashboard → Edge Functions → notehub-proxy
2. Look for "Logs" tab
3. Check for error messages about:
   - "Notehub credentials not configured"
   - "OAuth2 request failed"
   - Authentication errors

---

## Need More Help?

See the full setup guide: `NOTEHUB_SETUP_GUIDE.md`
