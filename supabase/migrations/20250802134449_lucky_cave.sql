/*
  # Add role helper functions for proper RLS policies

  1. Helper Functions
    - `is_admin()` - Check if current user is an admin
    - `is_tenant()` - Check if current user is a tenant
    - `get_user_role()` - Get the role of current user

  2. Security
    - Functions are SECURITY DEFINER to work with RLS
    - Proper role checking for all user types
*/

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if current user is a tenant
CREATE OR REPLACE FUNCTION is_tenant()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenants WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the role of current user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RETURN 'admin';
  ELSIF EXISTS (SELECT 1 FROM tenants WHERE id = auth.uid()) THEN
    RETURN 'tenant';
  ELSE
    RETURN null;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;