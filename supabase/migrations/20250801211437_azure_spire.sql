/*
  # Insert test devices directly for debugging

  This migration will:
  1. Delete any existing devices to start fresh
  2. Insert test devices with the exact tenant UUID we're looking for
  3. Show what was inserted for verification
*/

-- First, let's see what tenants exist
DO $$
BEGIN
  RAISE NOTICE 'Current tenants in database:';
END $$;

-- Show existing tenants
SELECT id, name, email FROM tenants;

-- Delete existing devices to start fresh
DELETE FROM devices;

-- Insert test devices with the exact tenant UUID
INSERT INTO devices (
  id,
  device_id,
  serial_number,
  name,
  location,
  tenant_id,
  status,
  firmware_version,
  last_seen,
  battery_level,
  flow_rate,
  total_usage,
  install_date,
  created_at
) VALUES 
(
  gen_random_uuid(),
  'WM-TEST-001',
  'SN-TEST-001',
  'Test Device 1',
  'Test Location 1',
  '550e8400-e29b-41d4-a716-446655440001',
  'online',
  '2.1.4',
  now(),
  85,
  12.5,
  1500.0,
  CURRENT_DATE,
  now()
),
(
  gen_random_uuid(),
  'WM-TEST-002',
  'SN-TEST-002',
  'Test Device 2',
  'Test Location 2',
  '550e8400-e29b-41d4-a716-446655440001',
  'offline',
  '2.1.3',
  now() - interval '2 hours',
  45,
  0.0,
  2300.0,
  CURRENT_DATE - interval '30 days',
  now()
);

-- Verify the devices were inserted
SELECT 
  device_id,
  name,
  tenant_id,
  status,
  battery_level
FROM devices 
WHERE tenant_id = '550e8400-e29b-41d4-a716-446655440001';

-- Also check if the tenant exists
SELECT id, name, email FROM tenants WHERE id = '550e8400-e29b-41d4-a716-446655440001';