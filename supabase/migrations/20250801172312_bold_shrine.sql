/*
  # Fix Admin Tenant Creation RLS Policies

  1. Security Updates
    - Drop existing problematic policies
    - Create proper admin policies for tenant management
    - Add fallback policies for authenticated users
    - Ensure admin role detection works correctly

  2. Policy Structure
    - Admin users can perform all operations on tenants table
    - Regular users can only read their own tenant data
    - Service role has full access for system operations
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Admin full access to tenants" ON tenants;
DROP POLICY IF EXISTS "Service role full access to tenants" ON tenants;
DROP POLICY IF EXISTS "Temporary tenant creation for testing" ON tenants;
DROP POLICY IF EXISTS "Tenants can read own data" ON tenants;
DROP POLICY IF EXISTS "Tenants can update own data" ON tenants;

-- Ensure RLS is enabled
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy 1: Service role has full access (system operations)
CREATE POLICY "Service role full access"
  ON tenants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy 2: Admin users have full access
CREATE POLICY "Admin users full access"
  ON tenants
  FOR ALL
  TO authenticated
  USING (
    -- Check multiple locations for admin role
    (auth.jwt() ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    -- Also check email for admin accounts
    (auth.jwt() ->> 'email' LIKE '%admin%')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() ->> 'email' LIKE '%admin%')
  );

-- Policy 3: Tenants can read their own data
CREATE POLICY "Tenants read own data"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

-- Policy 4: Tenants can update their own data
CREATE POLICY "Tenants update own data"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Create a function to help with admin role checking
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    (auth.jwt() ->> 'role' = 'admin') OR
    (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR
    (auth.jwt() ->> 'email' LIKE '%admin%')
  );
END;
$$;