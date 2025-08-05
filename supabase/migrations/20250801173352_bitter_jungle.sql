/*
  # Allow Public Access to Tenants for Demo

  1. Security Changes
    - Add policy to allow public read access to tenants table
    - This enables the app to show tenant data even without authentication
    - Useful for demo purposes when users aren't properly authenticated

  2. Changes
    - Add public read policy for tenants table
    - Keep existing admin policies for full CRUD operations
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can read tenants" ON tenants;
DROP POLICY IF EXISTS "Allow public read access to tenants" ON tenants;

-- Allow public read access to tenants (for demo purposes)
CREATE POLICY "Allow public read access to tenants"
  ON tenants
  FOR SELECT
  TO public
  USING (true);

-- Ensure the existing admin policies are still in place
DO $$
BEGIN
  -- Check if admin policy exists, if not create it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tenants' 
    AND policyname = 'Admin users full access'
  ) THEN
    CREATE POLICY "Admin users full access"
      ON tenants
      FOR ALL
      TO authenticated
      USING (
        (jwt() ->> 'role'::text) = 'admin'::text OR
        (jwt() -> 'user_metadata'::text ->> 'role'::text) = 'admin'::text OR
        (jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text OR
        (jwt() ->> 'email'::text) LIKE '%admin%'
      )
      WITH CHECK (
        (jwt() ->> 'role'::text) = 'admin'::text OR
        (jwt() -> 'user_metadata'::text ->> 'role'::text) = 'admin'::text OR
        (jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text OR
        (jwt() ->> 'email'::text) LIKE '%admin%'
      );
  END IF;
END $$;