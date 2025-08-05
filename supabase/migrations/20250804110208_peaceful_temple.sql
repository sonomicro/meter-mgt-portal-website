/*
  # Create device_settings table

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
    - Add policies for admins to manage all device settings

  3. Constraints
    - Unique constraint on device_id (one settings record per device)
    - Foreign key constraint to devices table
    - Check constraints for valid values

  4. Triggers
    - Auto-update updated_at timestamp on changes
*/

-- Create device_settings table
CREATE TABLE IF NOT EXISTS device_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  sampling_rate_minutes integer DEFAULT 5 NOT NULL,
  alert_threshold_flow_rate numeric DEFAULT 100 NOT NULL,
  low_battery_alert_enabled boolean DEFAULT true NOT NULL,
  auto_firmware_updates_enabled boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Constraints
  CONSTRAINT device_settings_device_id_unique UNIQUE (device_id),
  CONSTRAINT device_settings_sampling_rate_valid CHECK (sampling_rate_minutes > 0 AND sampling_rate_minutes <= 1440),
  CONSTRAINT device_settings_alert_threshold_valid CHECK (alert_threshold_flow_rate >= 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_device_settings_device_id ON device_settings(device_id);

-- Enable Row Level Security
ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for tenants (can manage settings for their own devices)
CREATE POLICY "Tenants can read own device settings"
  ON device_settings
  FOR SELECT
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Tenants can insert own device settings"
  ON device_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Tenants can update own device settings"
  ON device_settings
  FOR UPDATE
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  )
  WITH CHECK (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Tenants can delete own device settings"
  ON device_settings
  FOR DELETE
  TO authenticated
  USING (
    device_id IN (
      SELECT id FROM devices WHERE tenant_id::text = auth.uid()::text
    )
  );

-- Create policies for admins (can manage all device settings)
CREATE POLICY "Admins can manage all device settings"
  ON device_settings
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_device_settings_updated_at ON device_settings;
CREATE TRIGGER trigger_update_device_settings_updated_at
  BEFORE UPDATE ON device_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_device_settings_updated_at();