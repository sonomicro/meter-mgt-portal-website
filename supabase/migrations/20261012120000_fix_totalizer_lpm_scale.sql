/*
  # Correct data.qo volumes for the firmware L/min vs L/h totalizer bug

  Every sono_board firmware before 2.7.0 (back to v1.0.0, legacy PascalCase
  "Totalizer" included) integrated the MSP430 flow rate, which is L/min, as
  if it were L/h (divided by 3600 instead of 60). Every data.qo volume those
  versions sent is 60x too low.

  1. Changes
    - `device_data.volume_scale`: the factor applied to the received totalizer
      (total_volume = received * volume_scale). 60 for notes from affected
      firmware, 1 otherwise; it also keeps this migration from scaling twice.
    - `devices.volume_fixed_since`: when the device booted the first fixed
      firmware. Notes stamped at or after it are stored as received; NULL means
      the device has not reported a fixed version yet, so its notes are scaled.
    - Existing rows are scaled by 60 and `devices.total_usage` recomputed.
    - `record_flow_note()` applies the scale per note.
    - `mark_device_firmware()` (called by the webhook on health.qo): on the first
      fixed version it sets `volume_fixed_since` to the boot time and un-scales
      notes the device already sent since then (a boot data.qo can be processed
      before the boot health.qo).
    - `firmware_has_lpm_totalizer()`: the version threshold, in one place.
*/

ALTER TABLE device_data ADD COLUMN IF NOT EXISTS volume_scale smallint NOT NULL DEFAULT 1;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS volume_fixed_since timestamptz;

COMMENT ON COLUMN device_data.volume_scale IS
  'Factor applied to the received totalizer: 60 for firmware that integrated L/min as L/h, else 1.';
COMMENT ON COLUMN devices.volume_fixed_since IS
  'Boot time of the first firmware with the L/min totalizer fix; data.qo notes before it are scaled by 60.';

UPDATE device_data dd
SET total_volume = dd.total_volume * 60, volume_scale = 60
FROM devices d
WHERE d.id = dd.device_id
  AND dd.volume_scale = 1
  AND dd.total_volume IS NOT NULL
  AND (d.volume_fixed_since IS NULL OR dd.timestamp < d.volume_fixed_since);

UPDATE devices d
SET total_usage = COALESCE((SELECT SUM(dd.total_volume) FROM device_data dd WHERE dd.device_id = d.id), 0);

-- health.fw_version is productVersion(): "Ver 2.7.0 <build date>"
CREATE OR REPLACE FUNCTION firmware_has_lpm_totalizer(p_version text) RETURNS boolean AS $$
DECLARE
  m text[];
BEGIN
  m := regexp_match(COALESCE(p_version, ''), '(\d+)\.(\d+)\.(\d+)');
  IF m IS NULL THEN
    RETURN false;
  END IF;
  RETURN ARRAY[m[1]::int, m[2]::int, m[3]::int] >= ARRAY[2, 7, 0];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
BEGIN
  SELECT volume_fixed_since INTO fixed_since FROM devices WHERE id = p_device_id;
  scale := CASE WHEN fixed_since IS NOT NULL AND p_timestamp >= fixed_since THEN 1 ELSE 60 END;

  INSERT INTO device_data (device_id, timestamp, flow_rate, total_volume, period_s, notehub_event, volume_scale)
  VALUES (p_device_id, p_timestamp, p_flow_rate, p_volume * scale, p_period_s, p_notehub_event, scale)
  ON CONFLICT (device_id, notehub_event) DO NOTHING;
  inserted := FOUND;

  IF inserted THEN
    UPDATE devices
    SET total_usage = COALESCE(total_usage, 0) + COALESCE(p_volume * scale, 0),
        flow_rate = p_flow_rate,
        status = 'online',
        last_seen = GREATEST(COALESCE(last_seen, p_timestamp), p_timestamp)
    WHERE id = p_device_id;
  END IF;

  RETURN inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_device_firmware(
  p_device_id uuid,
  p_fw_version text,
  p_boot_time timestamptz
) RETURNS void AS $$
DECLARE
  fixed_since timestamptz;
  undo numeric;
BEGIN
  IF NOT firmware_has_lpm_totalizer(p_fw_version) THEN
    RETURN;
  END IF;

  SELECT volume_fixed_since INTO fixed_since FROM devices WHERE id = p_device_id FOR UPDATE;
  IF fixed_since IS NOT NULL AND fixed_since <= p_boot_time THEN
    RETURN;
  END IF;

  WITH fixed AS (
    UPDATE device_data
    SET total_volume = total_volume / 60, volume_scale = 1
    WHERE device_id = p_device_id AND volume_scale = 60 AND timestamp >= p_boot_time
    RETURNING total_volume
  )
  SELECT COALESCE(SUM(total_volume) * 59, 0) INTO undo FROM fixed;

  UPDATE devices
  SET volume_fixed_since = p_boot_time,
      total_usage = COALESCE(total_usage, 0) - undo
  WHERE id = p_device_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION mark_device_firmware(uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_device_firmware(uuid, text, timestamptz) TO service_role;
