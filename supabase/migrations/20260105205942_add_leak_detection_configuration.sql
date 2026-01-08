/*
  # Add Leak Detection Configuration
  
  1. New Tables
    - `leak_detection_settings`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key to tenants)
      - `device_id` (uuid, nullable, foreign key to devices) - if null, applies to all tenant devices
      - `enabled` (boolean) - whether leak detection is enabled
      - `flow_duration_threshold` (integer) - hours of continuous flow before alerting
      - `min_flow_rate_threshold` (numeric) - minimum flow rate to consider as continuous flow (L/min)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `leak_detection_settings` table
    - Add policy for tenants to read their own settings
    - Add policy for tenants to insert their own settings
    - Add policy for tenants to update their own settings
    - Add policy for tenants to delete their own settings
*/

CREATE TABLE IF NOT EXISTS leak_detection_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  enabled boolean DEFAULT true,
  flow_duration_threshold integer DEFAULT 6,
  min_flow_rate_threshold numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, device_id)
);

ALTER TABLE leak_detection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own leak detection settings"
  ON leak_detection_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can insert own leak detection settings"
  ON leak_detection_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can update own leak detection settings"
  ON leak_detection_settings
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can delete own leak detection settings"
  ON leak_detection_settings
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leak_detection_settings_tenant ON leak_detection_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leak_detection_settings_device ON leak_detection_settings(device_id);