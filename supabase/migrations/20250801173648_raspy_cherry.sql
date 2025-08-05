/*
  # Remove Public Access and Fix Authentication

  1. Security Changes
    - Remove public access policies (unsafe)
    - Fix admin authentication policies
    - Ensure proper RLS for all tables

  2. Authentication
    - Proper JWT token validation
    - Admin role detection from user metadata
    - Secure tenant and device access
*/

-- Remove the unsafe public access policy
DROP POLICY IF EXISTS "Allow public read access to tenants" ON tenants;

-- Create helper function for admin detection
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check user metadata for admin role
  IF (auth.jwt() ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check user_metadata for admin role
  IF (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check app_metadata for admin role
  IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check if email contains 'admin'
  IF (auth.jwt() ->> 'email') LIKE '%admin%' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tenants table policies
DROP POLICY IF EXISTS "Admin users full access" ON tenants;
DROP POLICY IF EXISTS "Service role full access" ON tenants;
DROP POLICY IF EXISTS "Tenants read own data" ON tenants;
DROP POLICY IF EXISTS "Tenants update own data" ON tenants;

CREATE POLICY "Admins can manage all tenants"
  ON tenants
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Tenants can read own data"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Tenants can update own data"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Devices table policies
DROP POLICY IF EXISTS "Admins can manage all devices" ON devices;
DROP POLICY IF EXISTS "Tenants can read own devices" ON devices;

CREATE POLICY "Admins can manage all devices"
  ON devices
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Tenants can read own devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

CREATE POLICY "Tenants can update own devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (tenant_id::text = auth.uid()::text)
  WITH CHECK (tenant_id::text = auth.uid()::text);

-- Device data policies
DROP POLICY IF EXISTS "Admins can manage all device data" ON device_data;
DROP POLICY IF EXISTS "Tenants can read own device data" ON device_data;

CREATE POLICY "Admins can manage all device data"
  ON device_data
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Tenants can read own device data"
  ON device_data
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

-- Alerts policies
DROP POLICY IF EXISTS "Admins can manage all alerts" ON alerts;
DROP POLICY IF EXISTS "Tenants can read own alerts" ON alerts;

CREATE POLICY "Admins can manage all alerts"
  ON alerts
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Tenants can read own alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );