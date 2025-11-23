/*
  # Fix Data Usage RLS Policies for Admin Access

  1. Changes
    - Drop existing restrictive policies on data usage tables
    - Add new policies that allow admins (from admins table) to read data
    - Admins are identified by checking if their ID exists in the admins table

  2. Security
    - Maintains RLS but allows admin access for analytics
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read device data usage" ON device_data_usage;
DROP POLICY IF EXISTS "Admins can read webhook usage" ON webhook_usage;
DROP POLICY IF EXISTS "Admins can read proxy usage" ON proxy_usage;
DROP POLICY IF EXISTS "Admins can read data usage summary" ON data_usage_summary;

-- Create new policies that check the admins table
CREATE POLICY "Admins can read device data usage"
  ON device_data_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can read webhook usage"
  ON webhook_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can read proxy usage"
  ON proxy_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can read data usage summary"
  ON data_usage_summary
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
    )
  );
