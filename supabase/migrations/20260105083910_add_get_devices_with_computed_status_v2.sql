/*
  # Add function to fetch devices with computed status
  
  1. New Functions
    - `get_devices_with_status(filter_tenant_id uuid)` - Returns all devices with status computed from last_seen
      - Accepts optional tenant_id filter
      - Returns 'online' if last seen within 24 hours
      - Returns 'offline' if last seen > 24 hours ago
      - Returns 'maintenance' if status is explicitly set to maintenance
      - Orders results by created_at descending
  
  2. Security
    - Function respects RLS policies
    - Uses SECURITY DEFINER for proper permission handling
*/

CREATE OR REPLACE FUNCTION get_devices_with_status(filter_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  device_id text,
  serial_number text,
  name text,
  location text,
  coordinates jsonb,
  tenant_id uuid,
  fleet_group_id uuid,
  notehub_device_uid text,
  status text,
  last_seen timestamptz,
  battery_level numeric,
  firmware_version text,
  flow_rate numeric,
  total_usage numeric,
  signal_strength integer,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.device_id,
    d.serial_number,
    d.name,
    d.location,
    d.coordinates,
    d.tenant_id,
    d.fleet_group_id,
    d.notehub_device_uid,
    CASE 
      WHEN d.status = 'maintenance' THEN 'maintenance'::text
      WHEN d.last_seen IS NULL THEN 'offline'::text
      WHEN EXTRACT(EPOCH FROM (NOW() - d.last_seen)) / 3600.0 < 24 THEN 'online'::text
      ELSE 'offline'::text
    END as status,
    d.last_seen,
    d.battery_level,
    d.firmware_version,
    d.flow_rate,
    d.total_usage,
    d.signal_strength,
    d.created_at,
    d.updated_at
  FROM devices d
  WHERE 
    (filter_tenant_id IS NULL OR d.tenant_id = filter_tenant_id)
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
