/*
  # Create admin table and update authentication system

  1. New Tables
    - `admins`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `password_hash` (text, encrypted password)
      - `name` (text)
      - `created_at` (timestamp)
      - `last_login` (timestamp)

  2. Updates to existing tables
    - Add `password_hash` column to `tenants` table

  3. Security
    - Enable RLS on `admins` table
    - Add policies for admin access
    - Create default admin user

  4. Functions
    - Create password hashing function
    - Create authentication helper functions
*/

-- Create extension for password hashing if not exists
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add password_hash column to tenants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE tenants ADD COLUMN password_hash text;
  END IF;
END $$;

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Enable RLS on admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create policies for admins table
CREATE POLICY "Admins can read own data"
  ON admins
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can update own data"
  ON admins
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- Create function to hash passwords
CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text AS $$
BEGIN
  RETURN crypt(password, gen_salt('bf'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify passwords
CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean AS $$
BEGIN
  RETURN hash = crypt(password, hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to authenticate admin
CREATE OR REPLACE FUNCTION authenticate_admin(email_input text, password_input text)
RETURNS TABLE(id uuid, email text, name text) AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.email, a.name
  FROM admins a
  WHERE a.email = email_input
    AND verify_password(password_input, a.password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to authenticate tenant
CREATE OR REPLACE FUNCTION authenticate_tenant(email_input text, password_input text)
RETURNS TABLE(id uuid, email text, name text, company text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.email, t.name, t.company
  FROM tenants t
  WHERE t.email = email_input
    AND t.password_hash IS NOT NULL
    AND verify_password(password_input, t.password_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default admin user
INSERT INTO admins (email, password_hash, name)
VALUES (
  'admin@admin.com',
  hash_password('demo123'),
  'System Administrator'
) ON CONFLICT (email) DO UPDATE SET
  password_hash = hash_password('demo123'),
  name = 'System Administrator';

-- Update existing tenants with demo password (demo123)
UPDATE tenants 
SET password_hash = hash_password('demo123')
WHERE password_hash IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_password_hash ON tenants(password_hash) WHERE password_hash IS NOT NULL;