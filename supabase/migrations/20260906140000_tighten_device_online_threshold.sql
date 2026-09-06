/*
  # Tighten device online threshold

  1. Changes
    - get_devices_with_status: consider a device "offline" after 2 hours of no
      last_seen update instead of 24. Devices report roughly hourly, so 24h let
      a device sit stale for most of a day while still showing "online".

  2. Notes
    - A future per-device threshold (e.g. a devices.online_threshold_hours
      column referenced here instead of the literal 2) can replace this without
      changing the function's shape.
*/

DROP FUNCTION IF EXISTS get_devices_with_status(uuid);

CREATE OR REPLACE FUNCTION get_devices_with_status(filter_tenant_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  device_id text,
  serial_number text,
  name text,
  location text,
  coordinates jsonb,
  tenant_id uuid,
  status text,
  firmware_version text,
  last_seen timestamptz,
  battery_level integer,
  flow_rate numeric,
  total_usage numeric,
  install_date date,
  notehub_device_uid text,
  created_at timestamptz,
  alert_config jsonb,
  alias text,
  fleet_group_id uuid,
  signal_strength integer,
  notehub_config jsonb
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
    CASE
      WHEN d.status = 'maintenance' THEN 'maintenance'::text
      WHEN d.last_seen IS NULL THEN 'offline'::text
      WHEN EXTRACT(EPOCH FROM (NOW() - d.last_seen)) / 3600.0 < 2 THEN 'online'::text
      ELSE 'offline'::text
    END as status,
    d.firmware_version,
    d.last_seen,
    d.battery_level,
    d.flow_rate,
    d.total_usage,
    d.install_date,
    d.notehub_device_uid,
    d.created_at,
    d.alert_config,
    d.alias,
    d.fleet_group_id,
    d.signal_strength,
    d.notehub_config
  FROM devices d
  WHERE
    (filter_tenant_id IS NULL OR d.tenant_id = filter_tenant_id)
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
