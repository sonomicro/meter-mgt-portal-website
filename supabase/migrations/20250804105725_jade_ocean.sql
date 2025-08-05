/*
  # Create device settings table

  1. New Tables
    - `device_settings`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key to devices table)
      - `sampling_rate_minutes` (integer, default 5)
      - `alert_threshold_flow_rate` (numeric, default 100)
      - `low_battery_alert_enabled` (boolean, default true)
      - `auto_firmware_updates_enabled` (boolean, default false)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `device_settings` table
    - Add policies for tenants to manage their own device settings
    - Add policy for admins to manage all device settings

  3. Indexes
    - Add index on device_id for faster lookups
    - Add unique constraint to ensure one settings record per device
*/

CREATE TABLE IF NOT EXISTS device_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sampling_rate_minutes integer DEFAULT 5 CHECK (sampling_rate_minutes > 0),
  alert_threshold_flow_rate numeric DEFAULT 100 CHECK (alert_threshold_flow_rate >= 0),
  low_battery_alert_enabled boolean DEFAULT true,
  auto_firmware_updates_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(device_id)
);

-- Enable RLS
ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_settings_device_id ON device_settings(device_id);

-- RLS Policies
CREATE POLICY "Admins can manage all device settings"
  ON device_settings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Tenants can read own device settings"
  ON device_settings
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = uid()::text
    )
  );

CREATE POLICY "Tenants can insert own device settings"
  ON device_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = uid()::text
    )
  );

CREATE POLICY "Tenants can update own device settings"
  ON device_settings
  FOR UPDATE
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = uid()::text
    )
  )
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = uid()::text
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_device_settings_updated_at
  BEFORE UPDATE ON device_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_device_settings_updated_at();