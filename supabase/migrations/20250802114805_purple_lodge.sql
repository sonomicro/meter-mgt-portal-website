/*
  # Reset and Recreate Database Schema

  This migration drops all existing tables and recreates them with an improved schema.

  ## New Tables
  1. **admins** - System administrators
  2. **tenants** - Customer organizations  
  3. **devices** - IoT water flow monitoring devices
  4. **device_data** - Time-series sensor data from devices
  5. **alerts** - System alerts and notifications

  ## Security
  - Enable RLS on all tables
  - Add appropriate policies for data access
  - Create helper functions for role checking

  ## Improvements
  - Better data types and constraints
  - Improved indexing for performance
  - Enhanced security policies
  - Default values for better data consistency
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS device_data CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Create helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admins 
    WHERE id::text = auth.uid()::text
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admins table
CREATE TABLE admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  
  CONSTRAINT admins_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create tenants table
CREATE TABLE tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  company text NOT NULL,
  phone text,
  address text,
  plan text NOT NULL DEFAULT 'basic',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  last_login timestamptz,
  
  CONSTRAINT tenants_email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT tenants_plan_valid CHECK (plan IN ('basic', 'professional', 'enterprise')),
  CONSTRAINT tenants_status_valid CHECK (status IN ('active', 'inactive'))
);

-- Create devices table
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  serial_number text UNIQUE NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  coordinates jsonb,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'offline',
  firmware_version text NOT NULL DEFAULT '1.0.0',
  last_seen timestamptz DEFAULT now(),
  battery_level integer DEFAULT 100,
  flow_rate numeric DEFAULT 0,
  total_usage numeric DEFAULT 0,
  install_date date DEFAULT CURRENT_DATE,
  notehub_device_uid text,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT devices_status_valid CHECK (status IN ('online', 'offline', 'maintenance')),
  CONSTRAINT devices_battery_valid CHECK (battery_level >= 0 AND battery_level <= 100),
  CONSTRAINT devices_flow_rate_valid CHECK (flow_rate >= 0),
  CONSTRAINT devices_total_usage_valid CHECK (total_usage >= 0)
);

-- Create device_data table
CREATE TABLE device_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  flow_rate numeric DEFAULT 0,
  total_volume numeric DEFAULT 0,
  temperature numeric,
  pressure numeric,
  battery_level integer,
  created_at timestamptz DEFAULT now(),
  
  CONSTRAINT device_data_flow_rate_valid CHECK (flow_rate >= 0),
  CONSTRAINT device_data_total_volume_valid CHECK (total_volume >= 0),
  CONSTRAINT device_data_battery_valid CHECK (battery_level IS NULL OR (battery_level >= 0 AND battery_level <= 100))
);

-- Create alerts table
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  type text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  
  CONSTRAINT alerts_type_valid CHECK (type IN ('leak', 'low_battery', 'offline', 'maintenance')),
  CONSTRAINT alerts_severity_valid CHECK (severity IN ('low', 'medium', 'high'))
);

-- Create indexes for better performance
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_admins_email ON admins(email);

CREATE INDEX idx_devices_tenant_id ON devices(tenant_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_notehub_uid ON devices(notehub_device_uid) WHERE notehub_device_uid IS NOT NULL;

CREATE INDEX idx_device_data_device_id ON device_data(device_id);
CREATE INDEX idx_device_data_timestamp ON device_data(timestamp);
CREATE INDEX idx_device_data_device_timestamp ON device_data(device_id, timestamp DESC);

CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);

-- Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admins table
CREATE POLICY "Admins can read own data"
  ON admins FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Admins can update own data"
  ON admins FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

-- RLS Policies for tenants table
CREATE POLICY "Users can read own tenant data"
  ON tenants FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own tenant data"
  ON tenants FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text)
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Users can create own tenant record"
  ON tenants FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "Admins can manage all tenants"
  ON tenants FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for devices table
CREATE POLICY "Enable read access for tenant devices"
  ON devices FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

CREATE POLICY "Enable insert access for tenant devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = auth.uid()::text);

CREATE POLICY "Enable update access for tenant devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (tenant_id::text = auth.uid()::text)
  WITH CHECK (tenant_id::text = auth.uid()::text);

CREATE POLICY "Enable full access for admins"
  ON devices FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for device_data table
CREATE POLICY "Tenants can read own device data"
  ON device_data FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices 
      WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Tenants can insert own device data"
  ON device_data FOR INSERT
  TO authenticated
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices 
      WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admins can manage all device data"
  ON device_data FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- RLS Policies for alerts table
CREATE POLICY "Tenants can read own alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices 
      WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Tenants can update own alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices 
      WHERE tenant_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices 
      WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Admins can manage all alerts"
  ON alerts FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Insert sample admin user
INSERT INTO admins (id, email, password_hash, name) VALUES 
(
  gen_random_uuid(),
  'admin@sonomicro.com',
  'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', -- SHA-256 of 'demo123'
  'System Administrator'
);

-- Insert sample tenant user
INSERT INTO tenants (id, name, email, password_hash, company, phone, address, plan) VALUES 
(
  gen_random_uuid(),
  'John Smith',
  'john@acmecorp.com',
  'd3ad9315b7be5dd53b31a273b3b3aba5defe700808305aa16a3062b76658a791', -- SHA-256 of 'demo123'
  'ACME Corporation',
  '+1-555-0123',
  '123 Business Ave, Suite 100, New York, NY 10001',
  'professional'
);

-- Get the tenant ID for sample devices
DO $$
DECLARE
  tenant_uuid uuid;
BEGIN
  SELECT id INTO tenant_uuid FROM tenants WHERE email = 'john@acmecorp.com';
  
  -- Insert sample devices
  INSERT INTO devices (device_id, serial_number, name, location, tenant_id, status, firmware_version, battery_level, flow_rate, total_usage) VALUES 
  ('WM-001', 'SN123456789', 'Main Building Meter', 'Building A - Basement', tenant_uuid, 'online', '2.1.4', 85, 12.5, 3456.78),
  ('WM-002', 'SN987654321', 'Secondary Meter', 'Building B - Utility Room', tenant_uuid, 'offline', '2.1.3', 23, 0, 2134.56),
  ('WM-003', 'SN456789123', 'Irrigation Monitor', 'Garden Area - Zone 1', tenant_uuid, 'online', '2.1.4', 92, 8.7, 1876.43);
END $$;