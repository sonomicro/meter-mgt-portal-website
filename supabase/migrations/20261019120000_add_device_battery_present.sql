/*
  # Battery board presence

  Firmware 2.8.0 reports in battery.qo whether the meter has a battery board
  (`battery.present`, `battery.board`: none / li_ion / supercap) and only sends
  a charge reading when it has one and monitoring is enabled. Before that,
  battery.qo always said 0 % and the portal also derived a level from the
  Notecard supply voltage, so a meter without a battery showed 0 % or 100 %.

  1. Changes
    - `devices.battery_present` (null = not reported yet, older firmware) and
      `devices.battery_board`.
    - `get_devices_with_status()` returns both.
*/

ALTER TABLE devices ADD COLUMN IF NOT EXISTS battery_present boolean;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS battery_board text;

COMMENT ON COLUMN devices.battery_present IS
  'From battery.qo battery.present; null until firmware that reports it has checked in.';

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
  avg_flow_rate numeric,
  total_usage numeric,
  install_date date,
  notehub_device_uid text,
  created_at timestamptz,
  alert_config jsonb,
  alias text,
  fleet_group_id uuid,
  signal_strength integer,
  notehub_config jsonb,
  ambient_temperature_c numeric,
  ambient_humidity_rh numeric,
  env_updated_at timestamptz,
  battery_voltage_mv integer,
  uptime_s bigint,
  last_reset_cause integer,
  health_updated_at timestamptz,
  quality_score numeric,
  quality_error_pct numeric,
  quality_updated_at timestamptz,
  parked boolean,
  parked_at timestamptz,
  battery_present boolean,
  battery_board text
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
      WHEN d.parked THEN 'parked'::text
      WHEN d.status = 'maintenance' THEN 'maintenance'::text
      WHEN d.last_seen IS NULL THEN 'offline'::text
      WHEN EXTRACT(EPOCH FROM (NOW() - d.last_seen)) / 3600.0 < 2 THEN 'online'::text
      ELSE 'offline'::text
    END as status,
    d.firmware_version,
    d.last_seen,
    d.battery_level,
    d.flow_rate,
    d.avg_flow_rate,
    d.total_usage,
    d.install_date,
    d.notehub_device_uid,
    d.created_at,
    d.alert_config,
    d.alias,
    d.fleet_group_id,
    d.signal_strength,
    d.notehub_config,
    d.ambient_temperature_c,
    d.ambient_humidity_rh,
    d.env_updated_at,
    d.battery_voltage_mv,
    d.uptime_s,
    d.last_reset_cause,
    d.health_updated_at,
    d.quality_score,
    d.quality_error_pct,
    d.quality_updated_at,
    d.parked,
    d.parked_at,
    d.battery_present,
    d.battery_board
  FROM devices d
  WHERE
    (filter_tenant_id IS NULL OR d.tenant_id = filter_tenant_id)
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
