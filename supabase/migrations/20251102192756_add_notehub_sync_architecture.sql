/*
  # Add Notehub Sync Architecture Support

  1. Schema Changes
    - Add `notehub_fleet_uid` column to `tenants` table
      - Stores the Notehub fleet UID associated with each tenant
      - Used for automatic fleet assignment when devices are added
    
    - Create `device_commands` table
      - Tracks device commands that need to be executed in Notehub
      - Stores command type, payload, status, and results
      - Enables async command processing via edge functions
  
  2. Security
    - RLS is disabled on all tables (using custom authentication)
    - Access control handled by application layer

  3. Notes
    - Database triggers will be added in a future migration after edge functions are deployed
    - This is a non-breaking additive change
*/

-- Add notehub_fleet_uid to tenants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'notehub_fleet_uid'
  ) THEN
    ALTER TABLE tenants ADD COLUMN notehub_fleet_uid TEXT;
  END IF;
END $$;

-- Create device_commands table
CREATE TABLE IF NOT EXISTS device_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
  command_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' NOT NULL,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_command_type CHECK (command_type IN ('firmware_update', 'env_variable', 'fleet_assign', 'sync_device')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_device_commands_device_id ON device_commands(device_id);
CREATE INDEX IF NOT EXISTS idx_device_commands_status ON device_commands(status);
CREATE INDEX IF NOT EXISTS idx_device_commands_created_at ON device_commands(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_commands_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_device_commands_updated_at ON device_commands;
CREATE TRIGGER trigger_update_device_commands_updated_at
  BEFORE UPDATE ON device_commands
  FOR EACH ROW
  EXECUTE FUNCTION update_device_commands_updated_at();
