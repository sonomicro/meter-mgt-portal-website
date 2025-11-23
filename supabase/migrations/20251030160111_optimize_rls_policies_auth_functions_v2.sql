/*
  # Optimize RLS Policies for Performance

  1. Performance Optimization
    - Replace direct auth.uid() calls with (select auth.uid()) in RLS policies
    - This prevents re-evaluation of auth functions for each row
    - Critical for query performance at scale
  
  2. Duplicate Policies Cleanup
    - Remove duplicate policies (keeping one optimized version)
    - Consolidate "Admins can view" and "Admins can read" policies
    - Consolidate "Service can insert" and "System can insert" policies
  
  3. Tables Optimized
    - `webhook_usage` - Optimize and deduplicate admin policies
    - `proxy_usage` - Optimize and deduplicate admin policies
    - `data_usage_summary` - Optimize and deduplicate admin policies
    - `device_data_usage` - Optimize and deduplicate all policies
*/

-- webhook_usage: Drop duplicates and recreate with optimized auth checks
DROP POLICY IF EXISTS "Admins can view webhook usage" ON webhook_usage;
DROP POLICY IF EXISTS "Admins can read webhook usage" ON webhook_usage;
DROP POLICY IF EXISTS "Service can insert webhook usage" ON webhook_usage;
DROP POLICY IF EXISTS "System can insert webhook usage" ON webhook_usage;

CREATE POLICY "Admins can view webhook usage"
  ON webhook_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = (select auth.uid())
    )
  );

CREATE POLICY "System can insert webhook usage"
  ON webhook_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- proxy_usage: Drop duplicates and recreate with optimized auth checks
DROP POLICY IF EXISTS "Admins can view proxy usage" ON proxy_usage;
DROP POLICY IF EXISTS "Admins can read proxy usage" ON proxy_usage;
DROP POLICY IF EXISTS "Service can insert proxy usage" ON proxy_usage;
DROP POLICY IF EXISTS "System can insert proxy usage" ON proxy_usage;

CREATE POLICY "Admins can view proxy usage"
  ON proxy_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = (select auth.uid())
    )
  );

CREATE POLICY "System can insert proxy usage"
  ON proxy_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- data_usage_summary: Drop duplicates and recreate with optimized auth checks
DROP POLICY IF EXISTS "Admins can view usage summary" ON data_usage_summary;
DROP POLICY IF EXISTS "Admins can read data usage summary" ON data_usage_summary;

CREATE POLICY "Admins can view usage summary"
  ON data_usage_summary
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = (select auth.uid())
    )
  );

-- device_data_usage: Drop duplicates and recreate with optimized auth checks
DROP POLICY IF EXISTS "Admins can view all device usage" ON device_data_usage;
DROP POLICY IF EXISTS "Admins can read device data usage" ON device_data_usage;
DROP POLICY IF EXISTS "Tenants can view own device usage" ON device_data_usage;
DROP POLICY IF EXISTS "Service can insert device data usage" ON device_data_usage;
DROP POLICY IF EXISTS "System can insert device usage" ON device_data_usage;

CREATE POLICY "Admins can view all device usage"
  ON device_data_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = (select auth.uid())
    )
  );

CREATE POLICY "Tenants can view own device usage"
  ON device_data_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenants
      WHERE tenants.id = (select auth.uid())
        AND tenants.id = device_data_usage.tenant_id
    )
  );

CREATE POLICY "System can insert device usage"
  ON device_data_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (true);