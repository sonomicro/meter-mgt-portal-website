/*
  # Add Alert Configuration to Devices

  1. Changes
    - Add `alert_config` JSONB column to devices table for customizable alert thresholds
    - Default configuration includes:
      - Battery level threshold (default: 25%)
      - Flow rate threshold for leak detection (default: 100 L/min)
      - Temperature thresholds (min/max)
      - Pressure thresholds (min/max)
    
  2. Notes
    - Each device can have custom alert thresholds
    - Null values mean use system defaults
    - Configuration is flexible to add new alert types
*/

-- Add alert configuration column to devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'alert_config'
  ) THEN
    ALTER TABLE devices ADD COLUMN alert_config JSONB DEFAULT '{
      "battery_threshold": 25,
      "flow_rate_threshold": 100,
      "temperature_min": 0,
      "temperature_max": 50,
      "pressure_min": 0,
      "pressure_max": 10
    }'::jsonb;
  END IF;
END $$;