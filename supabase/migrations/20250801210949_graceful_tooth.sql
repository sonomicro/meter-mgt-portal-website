/*
  # Add sample devices for testing

  1. Sample Devices
    - Creates test devices for existing tenants
    - Includes various device types and statuses
    - Proper UUID references to tenant table

  2. Data
    - Multiple devices per tenant for testing
    - Different locations and configurations
    - Realistic flow rates and battery levels
*/

-- Insert sample devices for testing
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
-- Devices for first tenant (get the first tenant ID)
(
  'WM-001',
  'SN123456789',
  'Main Building Meter',
  'Building A - Basement',
  '{"lat": 40.7128, "lon": -74.0060}',
  (SELECT id FROM tenants LIMIT 1),
  'online',
  '2.1.4',
  now(),
  85,
  12.5,
  3456.78,
  CURRENT_DATE - INTERVAL '30 days',
  'dev:123456789'
),
(
  'WM-002',
  'SN987654321',
  'Secondary Meter',
  'Building B - Utility Room',
  '{"lat": 40.7589, "lon": -73.9851}',
  (SELECT id FROM tenants LIMIT 1),
  'offline',
  '2.1.3',
  now() - INTERVAL '2 days',
  23,
  0,
  2134.56,
  CURRENT_DATE - INTERVAL '45 days',
  'dev:987654321'
),
(
  'WM-003',
  'SN456789123',
  'Irrigation Monitor',
  'Garden Area - Zone 1',
  '{"lat": 40.7831, "lon": -73.9712}',
  (SELECT id FROM tenants LIMIT 1),
  'online',
  '2.1.4',
  now() - INTERVAL '15 minutes',
  92,
  8.7,
  1876.43,
  CURRENT_DATE - INTERVAL '20 days',
  'dev:456789123'
);

-- Add devices for second tenant if exists
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
)
SELECT 
  'WM-004',
  'SN789123456',
  'Emergency Backup',
  'Building C - Emergency Systems',
  '{"lat": 40.7505, "lon": -73.9934}',
  t.id,
  'maintenance',
  '1.9.8',
  now() - INTERVAL '1 day',
  67,
  0,
  987.65,
  CURRENT_DATE - INTERVAL '60 days',
  'dev:789123456'
FROM tenants t
WHERE t.id != (SELECT id FROM tenants LIMIT 1)
LIMIT 1;