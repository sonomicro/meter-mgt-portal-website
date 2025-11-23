/*
  # Fix Function Search Path Security Issue

  1. Changes
    - Updates `update_device_commands_updated_at()` function to set explicit SEARCH_PATH
    - This prevents potential security vulnerabilities from search_path manipulation

  2. Security
    - Sets SECURITY DEFINER search_path to 'public' to prevent malicious schema injection
    - Function behavior remains identical, only security posture is improved
*/

-- Recreate the function with explicit search_path
CREATE OR REPLACE FUNCTION update_device_commands_updated_at()
RETURNS TRIGGER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;