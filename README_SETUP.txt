═══════════════════════════════════════════════════════════════════════════
                       NOTEHUB SETUP - QUICK START
═══════════════════════════════════════════════════════════════════════════

CURRENT STATUS
--------------
❌ Devices not loading (404 error from Notehub)
✅ Edge function deployed and accessible
✅ Frontend authentication working
✅ All local environment variables configured

THE PROBLEM
-----------
Your Notehub credentials need to be set in Supabase Dashboard.
They currently only exist in your local .env file, but edge functions
run on Supabase servers and can't read local files.

THE FIX (5 minutes)
-------------------
1. Go to: https://supabase.com/dashboard/project/xrmwxqhhaeahabeppvuk
2. Click: Edge Functions → notehub-proxy → Settings
3. Add two environment variables:
   • NOTEHUB_CLIENT_ID = 0de98d7e-8c88-4fd2-9732-2b7b2897e93d
   • NOTEHUB_CLIENT_SECRET = c0cc55868e77c25488016fe224d6c6bedc1c5ccb6579faf62d8076ec76f2f75c
4. Save
5. Wait 30 seconds
6. Run: ./diagnose-notehub.sh

DETAILED GUIDES
---------------
• Quick Fix:          QUICK_FIX.md
• Full Setup:         NOTEHUB_SETUP_GUIDE.md
• Visual Guide:       SUPABASE_ENV_SETUP.txt
• Test Script:        ./diagnose-notehub.sh

SUPPORT
-------
After setting variables, run: ./diagnose-notehub.sh
This will tell you exactly what's working and what's not.

═══════════════════════════════════════════════════════════════════════════
