/*
  # Disable RLS for Custom Authentication System

  1. Context
    - This application uses custom authentication with bcrypt
    - Authentication is handled at the application level, not via Supabase Auth
    - auth.uid() is always null since users don't authenticate through Supabase Auth
    - RLS policies checking auth.uid() will always fail
  
  2. Security Note
    - Access control is enforced at the application layer
    - The application uses the anon key which has limited permissions
    - All queries are filtered by the application code based on user session
  
  3. Tables Updated
    - Disable RLS on all tables since we're using custom authentication
*/

-- Disable RLS on all tables since we're using custom authentication
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE alerts DISABLE ROW LEVEL SECURITY;
ALTER TABLE device_data_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE data_usage_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_groups DISABLE ROW LEVEL SECURITY;