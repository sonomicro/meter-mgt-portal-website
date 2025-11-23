/*
  # Add Signal Strength to Devices

  1. Changes
    - Add `signal_strength` column to `devices` table to store cellular signal bars (0-5)
    - This data comes from Notehub's `bars` field in device payloads
  
  2. Details
    - Column type: integer (0-5 range representing signal bars)
    - Nullable: true (devices may not always report signal strength)
    - Default: null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'signal_strength'
  ) THEN
    ALTER TABLE devices ADD COLUMN signal_strength integer;
    COMMENT ON COLUMN devices.signal_strength IS 'Cellular signal strength in bars (0-5)';
  END IF;
END $$;
