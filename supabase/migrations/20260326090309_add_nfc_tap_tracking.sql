/*
  # NFC Tap Tracking and Public Device View

  1. New Tables
    - `nfc_taps`
      - `id` (uuid, primary key)
      - `device_id` (uuid, foreign key to devices)
      - `tenant_id` (uuid, foreign key to tenants)
      - `flow_value` (decimal) - Flow rate value from NFC tap
      - `flow_unit` (text) - Unit of measurement (L/min, gal/min, etc.)
      - `timestamp` (timestamptz) - When the measurement was taken
      - `tap_timestamp` (timestamptz) - When the user tapped the device
      - `ip_address` (text) - User's IP for analytics
      - `user_agent` (text) - Device/browser info
      - `location` (jsonb) - Optional GPS coordinates
      - `created_at` (timestamptz)

  2. Changes
    - Add `nfc_enabled` boolean to devices table
    - Add `public_view_enabled` boolean to devices table
    - Add `last_nfc_tap` timestamptz to devices table

  3. Security
    - Enable RLS on `nfc_taps` table
    - Add policies for public read access to device info (for NFC landing page)
    - Add policies for authenticated tenant users to view their tap history
    - Add policy for system to insert tap records

  4. Functions
    - Create function to get public device info for NFC landing page
    - Create function to record NFC tap

  5. Indexes
    - Add index on device_id for fast lookups
    - Add index on timestamp for analytics queries
*/

-- Add NFC-related columns to devices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'nfc_enabled'
  ) THEN
    ALTER TABLE devices ADD COLUMN nfc_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'public_view_enabled'
  ) THEN
    ALTER TABLE devices ADD COLUMN public_view_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'last_nfc_tap'
  ) THEN
    ALTER TABLE devices ADD COLUMN last_nfc_tap timestamptz;
  END IF;
END $$;

-- Create nfc_taps table
CREATE TABLE IF NOT EXISTS nfc_taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  flow_value decimal(10,3),
  flow_unit text DEFAULT 'L/min',
  timestamp timestamptz NOT NULL,
  tap_timestamp timestamptz DEFAULT now(),
  ip_address text,
  user_agent text,
  location jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE nfc_taps ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nfc_taps_device_id ON nfc_taps(device_id);
CREATE INDEX IF NOT EXISTS idx_nfc_taps_tenant_id ON nfc_taps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nfc_taps_timestamp ON nfc_taps(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_nfc_taps_tap_timestamp ON nfc_taps(tap_timestamp DESC);

-- RLS Policies for nfc_taps

-- Allow system/service role to insert tap records (for edge function)
CREATE POLICY "Service role can insert tap records"
  ON nfc_taps FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to view taps for their own tenant's devices
CREATE POLICY "Tenants can view own device taps"
  ON nfc_taps FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE user_id = auth.uid()
    )
  );

-- Allow admins to view all taps
CREATE POLICY "Admins can view all taps"
  ON nfc_taps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid()
    )
  );

-- Function to get public device info for NFC landing page
-- This bypasses RLS for public view
CREATE OR REPLACE FUNCTION get_public_device_info(p_device_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'device_id', d.id,
    'device_name', d.name,
    'serial_number', d.serial_number,
    'tenant_id', d.tenant_id,
    'tenant_name', t.name,
    'tenant_company', t.company,
    'tenant_logo', tc.logo_url,
    'tenant_primary_color', tc.primary_color,
    'tenant_secondary_color', tc.secondary_color,
    'nfc_enabled', d.nfc_enabled,
    'public_view_enabled', d.public_view_enabled,
    'last_nfc_tap', d.last_nfc_tap
  ) INTO result
  FROM devices d
  LEFT JOIN tenants t ON d.tenant_id = t.id
  LEFT JOIN tenant_customization tc ON t.id = tc.tenant_id
  WHERE d.id = p_device_id
    AND d.nfc_enabled = true
    AND d.public_view_enabled = true;

  RETURN result;
END;
$$;

-- Function to record NFC tap and update device
CREATE OR REPLACE FUNCTION record_nfc_tap(
  p_device_id uuid,
  p_flow_value decimal,
  p_flow_unit text,
  p_measurement_timestamp timestamptz,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_location jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_tap_id uuid;
  result jsonb;
BEGIN
  -- Get tenant_id for the device
  SELECT tenant_id INTO v_tenant_id
  FROM devices
  WHERE id = p_device_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Device not found or not associated with a tenant'
    );
  END IF;

  -- Insert tap record
  INSERT INTO nfc_taps (
    device_id,
    tenant_id,
    flow_value,
    flow_unit,
    timestamp,
    ip_address,
    user_agent,
    location
  ) VALUES (
    p_device_id,
    v_tenant_id,
    p_flow_value,
    p_flow_unit,
    p_measurement_timestamp,
    p_ip_address,
    p_user_agent,
    p_location
  )
  RETURNING id INTO v_tap_id;

  -- Update device's last_nfc_tap timestamp
  UPDATE devices
  SET last_nfc_tap = now()
  WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'success', true,
    'tap_id', v_tap_id,
    'device_id', p_device_id,
    'tenant_id', v_tenant_id
  );
END;
$$;