/*
  # Fix Device-Tenant Association

  1. Updates
    - Update existing devices to use proper tenant UUIDs
    - Ensure devices are associated with the correct tenants
    - Add more sample devices for testing

  2. Data
    - Associates devices with tenant UUID: 550e8400-e29b-41d4-a716-446655440001
    - Creates additional test devices if needed
*/

-- First, let's see what tenants exist and update devices to use the correct tenant ID
UPDATE devices 
SET tenant_id = '550e8400-e29b-41d4-a716-446655440001'
WHERE tenant_id IS NULL OR tenant_id != '550e8400-e29b-41d4-a716-446655440001';

-- Insert additional sample devices for the specific tenant if none exist
INSERT INTO devices (
  device_id,
  serial_number,
  name,
  location,
  tenant_id,
  status,
  firmware_version,
  battery_level,
  flow_rate,
  total_usage,
  install_date
) VALUES 
(
  'WM-TENANT-001',
  'SN-TENANT-001',
  'Main Building Flow Meter',
  'Building A - Basement',
  '550e8400-e29b-41d4-a716-446655440001',
  'online',
  '2.1.4',
  85,
  12.5,
  3456.78,
  CURRENT_DATE - INTERVAL '30 days'
),
(
  'WM-TENANT-002', 
  'SN-TENANT-002',
  'Secondary Building Meter',
  'Building B - Utility Room',
  '550e8400-e29b-41d4-a716-446655440001',
  'online',
  '2.1.3',
  92,
  8.7,
  2134.56,
  CURRENT_DATE - INTERVAL '20 days'
),
(
  'WM-TENANT-003',
  'SN-TENANT-003', 
  'Backup Flow Monitor',
  'Building C - Emergency Systems',
  '550e8400-e29b-41d4-a716-446655440001',
  'offline',
  '2.0.8',
  23,
  0,
  987.65,
  CURRENT_DATE - INTERVAL '45 days'
)
ON CONFLICT (device_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  status = EXCLUDED.status,
  firmware_version = EXCLUDED.firmware_version,
  battery_level = EXCLUDED.battery_level,
  flow_rate = EXCLUDED.flow_rate,
  total_usage = EXCLUDED.total_usage;