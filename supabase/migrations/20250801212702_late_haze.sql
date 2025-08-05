/*
  # Create test user and devices for tenant login

  1. Create a test user in Supabase Auth
  2. Create corresponding tenant record
  3. Create devices for this tenant
  4. Ensure proper RLS policies are in place
*/

-- First, let's ensure we have proper RLS policies for tenants and devices
DROP POLICY IF EXISTS "Tenants can read own data" ON tenants;
DROP POLICY IF EXISTS "Tenants can update own data" ON tenants;
DROP POLICY IF EXISTS "Enable read access for tenant devices" ON devices;
DROP POLICY IF EXISTS "Enable insert access for tenant devices" ON devices;
DROP POLICY IF EXISTS "Enable update access for tenant devices" ON devices;

-- Create policies for tenants table
CREATE POLICY "Tenants can read own data" ON tenants
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Tenants can update own data" ON tenants
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Create policies for devices table
CREATE POLICY "Enable read access for tenant devices" ON devices
  FOR SELECT TO authenticated
  USING (tenant_id = auth.uid());

CREATE POLICY "Enable insert access for tenant devices" ON devices
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Enable update access for tenant devices" ON devices
  FOR UPDATE TO authenticated
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

-- Create a tenant record that will match a Supabase Auth user
-- Note: The ID should match the auth.users.id when the user signs up
INSERT INTO tenants (
  id,
  name,
  email,
  company,
  phone,
  address,
  plan,
  status,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'John Smith',
  'john@acmecorp.com',
  'ACME Corporation',
  '+1-555-0123',
  '123 Business St, City, State 12345',
  'professional',
  'active',
  now()
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  company = EXCLUDED.company,
  phone = EXCLUDED.phone,
  address = EXCLUDED.address,
  plan = EXCLUDED.plan,
  status = EXCLUDED.status;

-- Clear existing devices and insert new ones for this tenant
DELETE FROM devices WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001';

INSERT INTO devices (
  device_id,
  serial_number,
  name,
  location,
  coordinates,
  tenant_id,
  status,
  firmware_version,
  last_seen,
  battery_level,
  flow_rate,
  total_usage,
  install_date,
  notehub_device_uid
) VALUES 
(
  'WM-001',
  'SN123456789',
  'Main Building Meter',
  'Building A - Basement',
  '{"lat": 40.7128, "lon": -74.0060}',
  '550e8400-e29b-41d4-a716-446655440001',
  'online',
  '2.1.4',
  now() - interval '5 minutes',
  85,
  12.5,
  3456.78,
  '2024-01-15',
  'dev:123456789'
),
(
  'WM-002',
  'SN987654321',
  'Secondary Meter',
  'Building B - Utility Room',
  '{"lat": 40.7589, "lon": -73.9851}',
  '550e8400-e29b-41d4-a716-446655440001',
  'offline',
  '2.0.5',
  now() - interval '2 days',
  23,
  0,
  2134.56,
  '2024-02-01',
  'dev:987654321'
),
(
  'WM-003',
  'SN456789123',
  'Irrigation Monitor',
  'Garden Area - Zone 1',
  '{"lat": 40.7831, "lon": -73.9712}',
  '550e8400-e29b-41d4-a716-446655440001',
  'online',
  '2.1.4',
  now() - interval '15 minutes',
  92,
  8.7,
  1876.43,
  '2024-03-15',
  'dev:456789123'
),
(
  'WM-004',
  'SN789123456',
  'Emergency Backup',
  'Building C - Emergency Systems',
  '{"lat": 40.7505, "lon": -73.9934}',
  '550e8400-e29b-41d4-a716-446655440001',
  'maintenance',
  '1.9.8',
  now() - interval '1 day',
  67,
  0,
  987.65,
  '2024-04-01',
  'dev:789123456'
);

-- Verify the data was inserted
SELECT 'Tenant created:' as info, name, email FROM tenants WHERE id = '550e8400-e29b-41d4-a716-446655440001';
SELECT 'Devices created:' as info, count(*) as device_count FROM devices WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001';