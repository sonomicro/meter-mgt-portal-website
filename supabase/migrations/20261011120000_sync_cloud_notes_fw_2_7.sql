/*
  # Sync with the notes firmware 2.7 publishes

  The meter pushes one Notecard note per service each cloud tick (sono_board
  cloud_controller.c g_telem_map): data.qo, battery.qo, storage.qo, settings.qo,
  health.qo, quality.qo, env.qo, plus alarm.qo on events. Keys are kv_app.h's
  dotted names with '.' replaced by '_' (data_serializer.c sanitize_key()).
  The webhook only handled data.qo, battery.qo and settings.qo; this adds the rest.

  1. Changes
    - `device_data.total_volume` is the litres of ONE note's period, not a running
      meter reading: the firmware subtracts what it pushed once Notehub accepts a
      note (commit-after-push), so each data.qo carries the volume since the
      previous accepted one. `period_s` is the span that volume covers. Consumers
      must SUM total_volume over a time range, never take max/last.
    - `device_data.notehub_event`: Notehub's event UID, unique per device, so a
      retried webhook delivery cannot count the same volume twice.
    - `record_flow_note()`: inserts a data.qo row and, only if it was new, adds its
      volume to `devices.total_usage` (now a true running total) in one statement.
      Existing `total_usage` (last note's volume) is recomputed as the sum of the
      stored notes.
    - `devices`: latest ambient temperature/humidity (env.qo, SHT40), battery
      voltage, firmware health (health.qo: version, uptime, reset cause) and
      measurement quality (quality.qo, per-interval mean score and error rate).
    - New `device_env_data` (env.qo history) and `device_quality_data` (quality.qo
      history: cumulative counters as received, plus the per-interval values the
      webhook derives from the previous note).
    - `get_devices_with_status()` returns the new device columns.

  2. Security
    - New tables follow device_data: admins full access, tenants read rows of
      their own devices.
*/

-- ---------------------------------------------------------------------------
-- device_data: per-note period volume, de-duplicated by Notehub event
-- ---------------------------------------------------------------------------
ALTER TABLE device_data ADD COLUMN IF NOT EXISTS period_s integer;
ALTER TABLE device_data ADD COLUMN IF NOT EXISTS notehub_event text;
-- Not a partial index: supabase-js upsert(onConflict) cannot target one.
-- NULLs never conflict, so rows without an event still insert.
CREATE UNIQUE INDEX IF NOT EXISTS device_data_notehub_event_uniq
  ON device_data (device_id, notehub_event);

COMMENT ON COLUMN device_data.total_volume IS
  'Litres in this note''s period (since the previous accepted data.qo), not a running total. SUM over a range; net, so negative with reverse flow.';
COMMENT ON COLUMN device_data.period_s IS
  'Seconds the total_volume covers (flow_sensor.1.period_s).';

-- total_usage held the last note's period volume; make it the running total
UPDATE devices d
SET total_usage = COALESCE((SELECT SUM(dd.total_volume) FROM device_data dd WHERE dd.device_id = d.id), 0);

-- ---------------------------------------------------------------------------
-- devices: latest values from env.qo / battery.qo / health.qo / quality.qo
-- ---------------------------------------------------------------------------
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ambient_temperature_c numeric(6,2);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ambient_humidity_rh numeric(5,2);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS env_updated_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS battery_voltage_mv integer;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS uptime_s bigint;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_reset_cause integer;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS health_updated_at timestamptz;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS quality_score numeric(5,1);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS quality_error_pct numeric(5,2);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS quality_updated_at timestamptz;

-- ---------------------------------------------------------------------------
-- device_env_data: env.qo history (only valid samples are stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_env_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  temperature_c numeric(6,2) NOT NULL,
  humidity_rh numeric(5,2) NOT NULL,
  notehub_event text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_env_data_device_ts ON device_env_data (device_id, timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS device_env_data_notehub_event_uniq
  ON device_env_data (device_id, notehub_event);

-- ---------------------------------------------------------------------------
-- device_quality_data: quality.qo history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS device_quality_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  timestamp timestamptz NOT NULL,
  -- cumulative since boot / soak reset, as received
  cycles bigint NOT NULL,
  error_cycles bigint NOT NULL,
  warmup_cycles bigint NOT NULL,
  score_sum bigint NOT NULL,
  score_min integer,
  score_windowed integer,
  amp_recent_mean integer,
  reason_dominant integer,
  reset_count integer,
  stream_on boolean,
  -- derived by the webhook against the previous note (NULL if not derivable)
  interval_cycles bigint,
  interval_mean_score numeric(5,1),
  interval_error_pct numeric(5,2),
  notehub_event text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_quality_data_device_ts ON device_quality_data (device_id, timestamp);
CREATE UNIQUE INDEX IF NOT EXISTS device_quality_data_notehub_event_uniq
  ON device_quality_data (device_id, notehub_event);

ALTER TABLE device_env_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_quality_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins: Full access to device_env_data"
  ON device_env_data FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Tenants: View own device env data"
  ON device_env_data FOR SELECT TO authenticated
  USING (
    public.is_tenant() AND EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = device_env_data.device_id
        AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

CREATE POLICY "Admins: Full access to device_quality_data"
  ON device_quality_data FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Tenants: View own device quality data"
  ON device_quality_data FOR SELECT TO authenticated
  USING (
    public.is_tenant() AND EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = device_quality_data.device_id
        AND devices.tenant_id = public.get_user_tenant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- record_flow_note(): one data.qo, counted once
-- ---------------------------------------------------------------------------
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
BEGIN
  INSERT INTO device_data (device_id, timestamp, flow_rate, total_volume, period_s, notehub_event)
  VALUES (p_device_id, p_timestamp, p_flow_rate, p_volume, p_period_s, p_notehub_event)
  ON CONFLICT (device_id, notehub_event) DO NOTHING;
  inserted := FOUND;

  IF inserted THEN
    UPDATE devices
    SET total_usage = COALESCE(total_usage, 0) + COALESCE(p_volume, 0),
        flow_rate = p_flow_rate,
        status = 'online',
        last_seen = GREATEST(COALESCE(last_seen, p_timestamp), p_timestamp)
    WHERE id = p_device_id;
  END IF;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION record_flow_note(uuid, timestamptz, numeric, numeric, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_flow_note(uuid, timestamptz, numeric, numeric, integer, text) TO service_role;

-- ---------------------------------------------------------------------------
-- get_devices_with_status(): same as 20260906140000 plus the new columns
-- ---------------------------------------------------------------------------
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
