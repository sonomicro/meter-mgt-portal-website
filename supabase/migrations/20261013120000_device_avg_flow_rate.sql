/*
  # Average flow per device from the reported volumes

  `devices.flow_rate` is the single flow sample in the latest data.qo. On a
  meter with intermittent flow it is often 0 while the volumes show steady use,
  so the dashboards showed "0 L/min" for a flowing meter.

  1. Changes
    - `devices.avg_flow_rate`: L/min averaged over the newest data.qo, i.e. its
      (scaled) volume divided by the span it covers: `period_s` when the
      firmware sends it (2.7+), else the gap to the device's previous note
      (gaps over 2 h are outages, so 3600 s is assumed).
    - `record_flow_note()` maintains it; a late, older note does not overwrite it.
    - Backfilled from the newest stored note of each device.
    - `get_devices_with_status()` returns it.
*/

ALTER TABLE devices ADD COLUMN IF NOT EXISTS avg_flow_rate numeric;

COMMENT ON COLUMN devices.avg_flow_rate IS
  'L/min averaged over the newest data.qo (volume / span covered); flow_rate is the instantaneous sample.';

CREATE OR REPLACE FUNCTION note_span_s(p_device_id uuid, p_timestamp timestamptz, p_period_s integer)
RETURNS numeric AS $$
DECLARE
  prev timestamptz;
  gap numeric;
BEGIN
  IF p_period_s IS NOT NULL AND p_period_s > 0 THEN
    RETURN p_period_s;
  END IF;
  SELECT max(timestamp) INTO prev FROM device_data
  WHERE device_id = p_device_id AND timestamp < p_timestamp;
  gap := extract(epoch FROM p_timestamp - prev);
  RETURN CASE WHEN gap > 0 AND gap <= 7200 THEN gap ELSE 3600 END;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

UPDATE devices d
SET avg_flow_rate = latest.total_volume / note_span_s(d.id, latest.timestamp, latest.period_s) * 60
FROM (
  SELECT DISTINCT ON (device_id) device_id, timestamp, total_volume, period_s
  FROM device_data
  ORDER BY device_id, timestamp DESC
) latest
WHERE latest.device_id = d.id;

CREATE OR REPLACE FUNCTION record_flow_note(
  p_device_id uuid,
  p_timestamp timestamptz,
  p_flow_rate numeric,
  p_volume numeric,
  p_period_s integer,
  p_notehub_event text
) RETURNS boolean AS $$
DECLARE
  inserted boolean;
  fixed_since timestamptz;
  scale smallint;
  is_newest boolean;
  avg_lpm numeric;
BEGIN
  SELECT volume_fixed_since INTO fixed_since FROM devices WHERE id = p_device_id;
  scale := CASE WHEN fixed_since IS NOT NULL AND p_timestamp >= fixed_since THEN 1 ELSE 60 END;

  is_newest := NOT EXISTS (
    SELECT 1 FROM device_data WHERE device_id = p_device_id AND timestamp > p_timestamp
  );
  avg_lpm := COALESCE(p_volume, 0) * scale / note_span_s(p_device_id, p_timestamp, p_period_s) * 60;

  INSERT INTO device_data (device_id, timestamp, flow_rate, total_volume, period_s, notehub_event, volume_scale)
  VALUES (p_device_id, p_timestamp, p_flow_rate, p_volume * scale, p_period_s, p_notehub_event, scale)
  ON CONFLICT (device_id, notehub_event) DO NOTHING;
  inserted := FOUND;

  IF inserted THEN
    UPDATE devices
    SET total_usage = COALESCE(total_usage, 0) + COALESCE(p_volume * scale, 0),
        flow_rate = CASE WHEN is_newest THEN p_flow_rate ELSE flow_rate END,
        avg_flow_rate = CASE WHEN is_newest THEN avg_lpm ELSE avg_flow_rate END,
        status = 'online',
        last_seen = GREATEST(COALESCE(last_seen, p_timestamp), p_timestamp)
    WHERE id = p_device_id;
  END IF;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
  quality_updated_at timestamptz
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
    d.quality_updated_at
  FROM devices d
  WHERE
    (filter_tenant_id IS NULL OR d.tenant_id = filter_tenant_id)
  ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
