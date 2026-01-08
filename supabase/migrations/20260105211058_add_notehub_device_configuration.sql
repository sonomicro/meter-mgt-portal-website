/*
  # Add Notehub Device Configuration

  1. Changes
    - Add `notehub_config` JSONB column to devices table to store Notehub environment variables
    - This column stores device-specific settings that are synced to Notehub
    - Includes flow sensor, battery, storage, cloud sync, and system settings

  2. Default Configuration
    - Set sensible defaults for all Notehub environment variables
    - Allow per-device customization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'notehub_config'
  ) THEN
    ALTER TABLE devices ADD COLUMN notehub_config jsonb DEFAULT '{
      "flow_sensor.1.enabled": true,
      "flow_sensor.1.max_flow_rate": 100.0,
      "flow_sensor.1.min_flow_rate": 0.0,
      "flow_sensor.1.calibration_mode": false,
      "flow_sensor.1.scaling_factor": 1.0,
      "flow_sensor.1.publish_interval_ms": 60000,
      "storage.ringbuffer.store_interval_ms": 5000,
      "storage.base.timestamp": 0,
      "nfc.enabled": false,
      "battery.enable": true,
      "battery.poll_interval_ms": 300000,
      "battery.min_charge": 20,
      "cloud.sync.publish_interval": 300,
      "cloud.sync.request_interval": 60,
      "system.main_loop_interval": 1000,
      "settings.board.serial": "",
      "settings.board.uid": "",
      "settings.flow.sensor": "FS3000",
      "settings.notecard.uid": "",
      "settings.battery.armed": true
    }'::jsonb;
  END IF;
END $$;