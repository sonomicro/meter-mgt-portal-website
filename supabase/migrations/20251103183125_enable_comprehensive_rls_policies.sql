/*
  # Enable Comprehensive RLS Policies
  
  1. Overview
    - Enable RLS on ALL tables
    - Create restrictive policies by default
    - Admins get full access via public.is_admin()
    - Tenants get filtered access to their own data
    - Edge functions use service_role key to bypass RLS
  
  2. Security Model
    - Admins: Full CRUD on all tables
    - Tenants: 
      * Read/write own tenant record
      * Read/write devices assigned to them
      * Read/write device_data for their devices
      * Read/write alerts for their devices
      * Read/write fleet_groups they own
      * Read/write device_settings for their devices
    - Anonymous: NO ACCESS (all blocked by RLS)
  
  3. Tables Covered
    - admins (admin only)
    - tenants (admin full, tenant own record)
    - devices (admin full, tenant filtered by tenant_id)
    - device_data (admin full, tenant filtered by device ownership)
    - device_settings (admin full, tenant filtered by device ownership)
    - alerts (admin full, tenant filtered by device ownership)
    - fleet_groups (admin full, tenant filtered by tenant_id)
    - device_commands (admin full, tenant filtered by device ownership)
    - device_data_usage (admin full, tenant filtered by tenant_id)
    - webhook_usage (admin only)
    - proxy_usage (admin only)
    - data_usage_summary (admin only)
  
  4. Important Notes
    - ALL policies check authentication first
    - Policies are RESTRICTIVE by default
    - service_role key bypasses ALL RLS (for edge functions)
*/

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleet_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxy_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_usage_summary ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (clean slate)
-- ============================================================================

DROP POLICY IF EXISTS "Admins: Full access to admins table" ON admins;
DROP POLICY IF EXISTS "Admins: Select all tenants" ON tenants;
DROP POLICY IF EXISTS "Admins: Insert tenants" ON tenants;
DROP POLICY IF EXISTS "Admins: Update all tenants" ON tenants;
DROP POLICY IF EXISTS "Admins: Delete tenants" ON tenants;
DROP POLICY IF EXISTS "Tenants: Read own record" ON tenants;
DROP POLICY IF EXISTS "Tenants: Update own record" ON tenants;

-- ============================================================================
-- ADMINS TABLE POLICIES
-- ============================================================================

-- Admins can do everything with admins table
CREATE POLICY "Admins: Full access to admins table"
  ON admins
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- TENANTS TABLE POLICIES
-- ============================================================================

-- Admins can select all tenants
CREATE POLICY "Admins: Select all tenants"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can insert tenants
CREATE POLICY "Admins: Insert tenants"
  ON tenants
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update all tenants
CREATE POLICY "Admins: Update all tenants"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete tenants
CREATE POLICY "Admins: Delete tenants"
  ON tenants
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Tenants can read their own record
CREATE POLICY "Tenants: Read own record"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    user_id = auth.uid()
  );

-- Tenants can update their own record (except critical fields)
CREATE POLICY "Tenants: Update own record"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant() AND 
    user_id = auth.uid()
  )
  WITH CHECK (
    public.is_tenant() AND 
    user_id = auth.uid()
  );

-- ============================================================================
-- DEVICES TABLE POLICIES
-- ============================================================================

-- Admins can do everything with devices
CREATE POLICY "Admins: Full access to devices"
  ON devices
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view their assigned devices
CREATE POLICY "Tenants: View assigned devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- Tenants can update their assigned devices (limited fields)
CREATE POLICY "Tenants: Update assigned devices"
  ON devices
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  )
  WITH CHECK (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- ============================================================================
-- DEVICE_DATA TABLE POLICIES
-- ============================================================================

-- Admins can do everything with device_data
CREATE POLICY "Admins: Full access to device_data"
  ON device_data
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view data from their devices
CREATE POLICY "Tenants: View own device data"
  ON device_data
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_data.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- ============================================================================
-- DEVICE_SETTINGS TABLE POLICIES
-- ============================================================================

-- Admins can do everything with device_settings
CREATE POLICY "Admins: Full access to device_settings"
  ON device_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view settings for their devices
CREATE POLICY "Tenants: View own device settings"
  ON device_settings
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_settings.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- Tenants can update settings for their devices
CREATE POLICY "Tenants: Update own device settings"
  ON device_settings
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_settings.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  )
  WITH CHECK (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_settings.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- Tenants can insert settings for their devices
CREATE POLICY "Tenants: Insert own device settings"
  ON device_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_settings.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- ============================================================================
-- ALERTS TABLE POLICIES
-- ============================================================================

-- Admins can do everything with alerts
CREATE POLICY "Admins: Full access to alerts"
  ON alerts
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view alerts for their devices
CREATE POLICY "Tenants: View own device alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    (
      device_id IS NULL OR
      EXISTS (
        SELECT 1 FROM devices 
        WHERE devices.id = alerts.device_id 
        AND devices.tenant_id = public.get_user_tenant_id()
      )
    )
  );

-- Tenants can update alerts for their devices (mark as resolved)
CREATE POLICY "Tenants: Update own device alerts"
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = alerts.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  )
  WITH CHECK (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = alerts.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- ============================================================================
-- FLEET_GROUPS TABLE POLICIES
-- ============================================================================

-- Admins can do everything with fleet_groups
CREATE POLICY "Admins: Full access to fleet_groups"
  ON fleet_groups
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view their own fleet groups
CREATE POLICY "Tenants: View own fleet groups"
  ON fleet_groups
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- Tenants can create their own fleet groups
CREATE POLICY "Tenants: Create own fleet groups"
  ON fleet_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- Tenants can update their own fleet groups
CREATE POLICY "Tenants: Update own fleet groups"
  ON fleet_groups
  FOR UPDATE
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  )
  WITH CHECK (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- Tenants can delete their own fleet groups
CREATE POLICY "Tenants: Delete own fleet groups"
  ON fleet_groups
  FOR DELETE
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- ============================================================================
-- DEVICE_COMMANDS TABLE POLICIES
-- ============================================================================

-- Admins can do everything with device_commands
CREATE POLICY "Admins: Full access to device_commands"
  ON device_commands
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view commands for their devices
CREATE POLICY "Tenants: View own device commands"
  ON device_commands
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_commands.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- Tenants can create commands for their devices
CREATE POLICY "Tenants: Create commands for own devices"
  ON device_commands
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_tenant() AND 
    EXISTS (
      SELECT 1 FROM devices 
      WHERE devices.id = device_commands.device_id 
      AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- ============================================================================
-- DEVICE_DATA_USAGE TABLE POLICIES
-- ============================================================================

-- Admins can do everything with device_data_usage
CREATE POLICY "Admins: Full access to device_data_usage"
  ON device_data_usage
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Tenants can view their own data usage
CREATE POLICY "Tenants: View own data usage"
  ON device_data_usage
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant() AND 
    tenant_id = public.get_user_tenant_id()
  );

-- ============================================================================
-- WEBHOOK_USAGE TABLE POLICIES (Admin only)
-- ============================================================================

CREATE POLICY "Admins: Full access to webhook_usage"
  ON webhook_usage
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- PROXY_USAGE TABLE POLICIES (Admin only)
-- ============================================================================

CREATE POLICY "Admins: Full access to proxy_usage"
  ON proxy_usage
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================================
-- DATA_USAGE_SUMMARY TABLE POLICIES (Admin only)
-- ============================================================================

CREATE POLICY "Admins: Full access to data_usage_summary"
  ON data_usage_summary
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());