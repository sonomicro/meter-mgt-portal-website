/*
  # Add Device Alias and Fleet Groups

  1. Changes to Devices Table
    - Add `alias` column for tenant-specific device names
    - Add `fleet_group_id` column to group devices
    
  2. New Tables
    - `fleet_groups` table for organizing devices
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, foreign key to tenants)
      - `name` (text, group name)
      - `description` (text, optional description)
      - `color` (text, for UI color coding)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  3. Security
    - Enable RLS on `fleet_groups` table
    - Tenants can only manage their own groups
    - Admins can manage all groups

  4. Notes
    - Alias allows tenants to rename devices without affecting the actual device name
    - Fleet groups help organize devices by location, type, or any custom criteria
    - Color codes help with visual identification in the UI
*/

-- Add alias column to devices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'alias'
  ) THEN
    ALTER TABLE devices ADD COLUMN alias text;
  END IF;
END $$;

-- Create fleet_groups table
CREATE TABLE IF NOT EXISTS fleet_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  
  -- Ensure unique group names per tenant
  CONSTRAINT fleet_groups_tenant_name_unique UNIQUE (tenant_id, name)
);

-- Add fleet_group_id to devices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'fleet_group_id'
  ) THEN
    ALTER TABLE devices ADD COLUMN fleet_group_id uuid REFERENCES fleet_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_fleet_groups_tenant_id ON fleet_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_fleet_group_id ON devices(fleet_group_id);

-- Enable Row Level Security on fleet_groups
ALTER TABLE fleet_groups ENABLE ROW LEVEL SECURITY;

-- Policies for fleet_groups (tenants can manage their own groups)
CREATE POLICY "Tenants can view own fleet groups"
  ON fleet_groups
  FOR SELECT
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

CREATE POLICY "Tenants can create own fleet groups"
  ON fleet_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (tenant_id::text = auth.uid()::text);

CREATE POLICY "Tenants can update own fleet groups"
  ON fleet_groups
  FOR UPDATE
  TO authenticated
  USING (tenant_id::text = auth.uid()::text)
  WITH CHECK (tenant_id::text = auth.uid()::text);

CREATE POLICY "Tenants can delete own fleet groups"
  ON fleet_groups
  FOR DELETE
  TO authenticated
  USING (tenant_id::text = auth.uid()::text);

-- Admin policies for fleet_groups
CREATE POLICY "Admins can manage all fleet groups"
  ON fleet_groups
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Trigger to update updated_at on fleet_groups
CREATE OR REPLACE FUNCTION update_fleet_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_fleet_groups_updated_at ON fleet_groups;
CREATE TRIGGER trigger_update_fleet_groups_updated_at
  BEFORE UPDATE ON fleet_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_fleet_groups_updated_at();