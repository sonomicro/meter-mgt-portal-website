/*
  # Add Tenant Customization

  1. Changes
    - Add `logo_url` column to `tenants` table for custom logos
    - Add `primary_color` column to `tenants` table for theme customization (optional)
    
  2. Security
    - Existing RLS policies will apply to the new columns
    
  Note: Storage bucket and policies need to be configured through Supabase Dashboard
*/

-- Add logo_url column to tenants table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE tenants ADD COLUMN logo_url text;
  END IF;
END $$;

-- Add primary_color column for theme customization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'primary_color'
  ) THEN
    ALTER TABLE tenants ADD COLUMN primary_color text DEFAULT '#3B82F6';
  END IF;
END $$;
