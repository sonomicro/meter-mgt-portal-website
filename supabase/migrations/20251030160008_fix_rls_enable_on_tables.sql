/*
  # Enable RLS on Tables with Policies

  1. Security Fix
    - Enable RLS on all tables that have policies but RLS is currently disabled
    - This is critical security fix - tables with policies but no RLS enabled are completely open
  
  2. Tables Fixed
    - `admins` - Enable RLS
    - `alerts` - Enable RLS
    - `device_data` - Enable RLS
    - `device_settings` - Enable RLS
    - `devices` - Enable RLS
    - `tenants` - Enable RLS
*/

-- Enable RLS on all tables that have policies
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;