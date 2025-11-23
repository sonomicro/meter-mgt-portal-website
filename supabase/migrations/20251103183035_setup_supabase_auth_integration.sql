/*
  # Setup Supabase Auth Integration
  
  1. Purpose
    - Migrate from custom bcrypt authentication to Supabase Auth
    - Link existing admins and tenants tables to auth.users
    - Preserve existing data while adding auth integration
  
  2. Changes
    - Add user_id column to admins table (foreign key to auth.users)
    - Add user_id column to tenants table (foreign key to auth.users)
    - Create helper functions to check user roles in public schema
    - Keep existing password_hash columns for migration period
  
  3. Security
    - Prepare tables for RLS policies
    - Set up role checking functions
    - Maintain data integrity with foreign keys
  
  4. Migration Strategy
    - Non-destructive: keeps existing columns
    - Allows gradual migration of users
    - New users will be created in auth.users
*/

-- Add user_id column to admins table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admins' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE admins ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS admins_user_id_key ON admins(user_id);
  END IF;
END $$;

-- Add user_id column to tenants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE tenants ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS tenants_user_id_key ON tenants(user_id);
  END IF;
END $$;

-- Create function to get user's tenant_id (in public schema)
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM tenants WHERE user_id = auth.uid();
$$;

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;

-- Create function to check if user is tenant
CREATE OR REPLACE FUNCTION public.is_tenant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenants WHERE user_id = auth.uid()
  );
$$;

-- Create helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM admins WHERE user_id = auth.uid()) THEN
    RETURN 'admin';
  ELSIF EXISTS (SELECT 1 FROM tenants WHERE user_id = auth.uid()) THEN
    RETURN 'tenant';
  ELSE
    RETURN 'anonymous';
  END IF;
END;
$$;