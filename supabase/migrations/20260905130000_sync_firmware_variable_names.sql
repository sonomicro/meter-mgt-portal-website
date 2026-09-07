/*
  # Sync schema with actual firmware variable names (sono_board kv_app.h)

  1. Changes
    - Drop `device_data.temperature` / `device_data.pressure` — firmware never sends these
      (leftover from an earlier BME280-based prototype); mirrored removal from
      `devices.alert_config` defaults/rows (temperature_min/max, pressure_min/max)
    - Allow `alerts.type` to include 'alarm' and 'low_signal' — the webhook has been
      inserting these values since it was written, but the CHECK constraint only allowed
      ('leak','low_battery','offline','maintenance'), so every alarm.qo / low-signal
      alert insert has been silently failing
    - Rename stale `notehub_config` keys to match the firmware's current cloud env-var
      names (flow_sensor.1.publish_interval_ms -> flow_sensor.1.sample_interval_ms,
      cloud.sync.publish_interval -> cloud.sync.publish_interval_s,
      cloud.sync.request_interval -> cloud.sync.request_interval_s), both in the column
      default and in any devices already configured under the old names
*/

-- device_data: drop unused temperature/pressure columns
ALTER TABLE device_data DROP COLUMN IF EXISTS temperature;
ALTER TABLE device_data DROP COLUMN IF EXISTS pressure;

-- devices.alert_config: strip temperature/pressure thresholds from existing rows and the default
UPDATE devices
SET alert_config = alert_config - 'temperature_min' - 'temperature_max' - 'pressure_min' - 'pressure_max'
WHERE alert_config IS NOT NULL;

ALTER TABLE devices ALTER COLUMN alert_config SET DEFAULT '{
  "battery_threshold": 25,
  "flow_rate_threshold": 100
}'::jsonb;

-- alerts.type: allow the values the webhook actually inserts
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_valid;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_valid
  CHECK (type IN ('leak', 'low_battery', 'offline', 'maintenance', 'alarm', 'low_signal'));

-- devices.notehub_config: migrate renamed env-var keys on existing devices
UPDATE devices
SET notehub_config =
  (notehub_config - 'flow_sensor.1.publish_interval_ms' - 'cloud.sync.publish_interval' - 'cloud.sync.request_interval')
  || jsonb_build_object(
       'flow_sensor.1.sample_interval_ms',
         COALESCE(notehub_config->'flow_sensor.1.sample_interval_ms', notehub_config->'flow_sensor.1.publish_interval_ms', '60000'::jsonb),
       'cloud.sync.publish_interval_s',
         COALESCE(notehub_config->'cloud.sync.publish_interval_s', notehub_config->'cloud.sync.publish_interval', '300'::jsonb),
       'cloud.sync.request_interval_s',
         COALESCE(notehub_config->'cloud.sync.request_interval_s', notehub_config->'cloud.sync.request_interval', '60'::jsonb)
     )
WHERE notehub_config IS NOT NULL;

ALTER TABLE devices ALTER COLUMN notehub_config SET DEFAULT '{
  "flow_sensor.1.enabled": true,
  "flow_sensor.1.max_flow_rate": 100.0,
  "flow_sensor.1.min_flow_rate": 0.0,
  "flow_sensor.1.calibration_mode": false,
  "flow_sensor.1.scaling_factor": 1.0,
  "flow_sensor.1.sample_interval_ms": 60000,
  "storage.ringbuffer.store_interval_ms": 5000,
  "storage.base.timestamp": 0,
  "nfc.enabled": false,
  "battery.enable": true,
  "battery.poll_interval_ms": 300000,
  "battery.min_charge": 20,
  "cloud.sync.publish_interval_s": 300,
  "cloud.sync.request_interval_s": 60,
  "system.main_loop_interval": 1000,
  "settings.board.serial": "",
  "settings.board.uid": "",
  "settings.flow.sensor": "FS3000",
  "settings.notecard.uid": "",
  "settings.battery.armed": true
}'::jsonb;
