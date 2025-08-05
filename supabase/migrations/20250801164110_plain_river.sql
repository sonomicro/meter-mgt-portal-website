/*
  # Tenant Management and Device Tracking Schema

  1. New Tables
    - `tenants`
      - `id` (uuid, primary key)
      - `name` (text)
      - `email` (text, unique)
      - `company` (text)
      - `phone` (text)
      - `address` (text)
      - `plan` (text)
      - `status` (text)
      - `created_at` (timestamp)
      - `last_login` (timestamp)
    - `devices`
      - `id` (uuid, primary key)
      - `device_id` (text, unique)
      - `serial_number` (text, unique)
      - `name` (text)
      - `location` (text)
      - `coordinates` (jsonb)
      - `tenant_id` (uuid, foreign key)
      - `status` (text)
      - `firmware_version` (text)
      - `last_seen` (timestamp)
      - `battery_level` (integer)
      - `flow_rate` (decimal)
      - `total_usage` (decimal)
      - `install_date` (date)
      - `notehub_device_uid` (text)
      - `created_at` (timestamp)
    - `device_data`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key)
      - `timestamp` (timestamp)
      - `flow_rate` (decimal)
      - `total_volume` (decimal)
      - `temperature` (decimal)
      - `pressure` (decimal)
      - `battery_level` (integer)
      - `created_at` (timestamp)
    - `alerts`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key)
      - `type` (text)
      - `message` (text)
      - `severity` (text)
      - `resolved` (boolean)
      - `created_at` (timestamp)
      - `resolved_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Admin users can access all data
    - Tenant users can only access their own data
*/

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  company text NOT NULL,
  phone text,
  address text,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'enterprise')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  last_login timestamptz
);

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  serial_number text UNIQUE NOT NULL,
  name text NOT NULL,
  location text NOT NULL,
  coordinates jsonb,
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
  firmware_version text NOT NULL DEFAULT '1.0.0',
  last_seen timestamptz DEFAULT now(),
  battery_level integer DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  flow_rate decimal DEFAULT 0,
  total_usage decimal DEFAULT 0,
  install_date date DEFAULT CURRENT_DATE,
  notehub_device_uid text,
  created_at timestamptz DEFAULT now()
);

-- Create device_data table for time-series data
CREATE TABLE IF NOT EXISTS device_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  flow_rate decimal DEFAULT 0,
  total_volume decimal DEFAULT 0,
  temperature decimal,
  pressure decimal,
  battery_level integer,
  created_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('leak', 'low_battery', 'offline', 'maintenance')),
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Create policies for tenants table
CREATE POLICY "Admins can manage all tenants"
  ON tenants
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Tenants can read own data"
  ON tenants
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text);

CREATE POLICY "Tenants can update own data"
  ON tenants
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

-- Create policies for devices table
CREATE POLICY "Admins can manage all devices"
  ON devices
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Tenants can read own devices"
  ON devices
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

-- Create policies for device_data table
CREATE POLICY "Admins can manage all device data"
  ON device_data
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Tenants can read own device data"
  ON device_data
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

-- Create policies for alerts table
CREATE POLICY "Admins can manage all alerts"
  ON alerts
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Tenants can read own alerts"
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_devices_tenant_id ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_device_data_device_id ON device_data(device_id);
CREATE INDEX IF NOT EXISTS idx_device_data_timestamp ON device_data(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_device_id ON alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

-- Insert sample data
INSERT INTO tenants (id, name, email, company, phone, address, plan, status, created_at, last_login) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'John Smith', 'john@acmecorp.com', 'ACME Corporation', '+1 (555) 123-4567', '123 Business Ave, Suite 100, New York, NY 10001', 'professional', 'active', '2024-01-15', '2024-12-19T08:30:00Z'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Sarah Johnson', 'sarah@techsolutions.com', 'Tech Solutions LLC', '+1 (555) 987-6543', '456 Tech Park Dr, San Francisco, CA 94107', 'enterprise', 'active', '2024-02-20', '2024-12-18T14:22:00Z'),
  ('550e8400-e29b-41d4-a716-446655440003', 'Michael Chen', 'michael@greenbuilding.com', 'Green Building Co', '+1 (555) 456-7890', '789 Green St, Portland, OR 97201', 'basic', 'inactive', '2024-03-10', '2024-12-15T11:45:00Z')
ON CONFLICT (email) DO NOTHING;

INSERT INTO devices (device_id, serial_number, name, location, coordinates, tenant_id, status, firmware_version, last_seen, battery_level, flow_rate, total_usage, install_date, notehub_device_uid) VALUES
  ('device-1', 'WFM-001-2024', 'Device-001', 'New York, USA', '{"lat": 40.7128, "lon": -74.0060}', '550e8400-e29b-41d4-a716-446655440001', 'online', '2.1.4', '2024-12-19T10:30:00Z', 85, 12.5, 3456, '2024-01-20', 'dev:864475044123456'),
  ('device-2', 'WFM-002-2024', 'Device-002', 'New York, USA', '{"lat": 40.7589, "lon": -73.9851}', '550e8400-e29b-41d4-a716-446655440001', 'online', '2.1.4', '2024-12-19T10:32:00Z', 92, 8.3, 2890, '2024-01-20', 'dev:864475044123457'),
  ('device-3', 'WFM-003-2024', 'Device-003', 'California, USA', '{"lat": 37.7749, "lon": -122.4194}', '550e8400-e29b-41d4-a716-446655440002', 'maintenance', '2.0.8', '2024-12-18T14:20:00Z', 23, 0, 8756, '2024-02-25', 'dev:864475044123458'),
  ('device-4', 'WFM-004-2024', 'Device-004', 'Oregon, USA', '{"lat": 45.5152, "lon": -122.6784}', '550e8400-e29b-41d4-a716-446655440002', 'offline', '2.1.3', '2024-12-17T09:15:00Z', 67, 0, 5432, '2024-03-01', 'dev:864475044123459')
ON CONFLICT (device_id) DO NOTHING;

INSERT INTO alerts (device_id, type, message, severity, resolved, created_at) VALUES
  ((SELECT id FROM devices WHERE device_id = 'device-3'), 'low_battery', 'Battery level below 25%', 'high', false, '2024-12-19T08:30:00Z'),
  ((SELECT id FROM devices WHERE device_id = 'device-4'), 'offline', 'Device has been offline for 2 days', 'high', false, '2024-12-17T09:15:00Z'),
  ((SELECT id FROM devices WHERE device_id = 'device-1'), 'maintenance', 'Scheduled maintenance due', 'medium', true, '2024-12-19T10:00:00Z')
ON CONFLICT DO NOTHING;