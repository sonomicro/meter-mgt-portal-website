/*
  # Fix Password Hash Functions
  
  1. Changes
    - Update hash_password and verify_password functions to use pgcrypto extension correctly
    - Set proper search_path to include extensions schema
*/

CREATE OR REPLACE FUNCTION hash_password(password text)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = extensions, pg_catalog, public
AS $$
BEGIN
  RETURN extensions.crypt(password, extensions.gen_salt('bf'));
END;
$$;

CREATE OR REPLACE FUNCTION verify_password(password text, hash text)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = extensions, pg_catalog, public
AS $$
BEGIN
  RETURN hash = extensions.crypt(password, hash);
END;
$$;

CREATE OR REPLACE FUNCTION authenticate_legacy_user(
  p_email text,
  p_password text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, pg_catalog, public
AS $$
DECLARE
  v_user_record record;
  v_table_name text;
  v_password_match boolean;
BEGIN
  -- Determine table based on role
  IF p_role = 'admin' THEN
    v_table_name := 'admins';
  ELSIF p_role = 'tenant' THEN
    v_table_name := 'tenants';
  ELSE
    RETURN jsonb_build_object('error', 'Invalid role');
  END IF;

  -- Get user record
  EXECUTE format('SELECT * FROM %I WHERE email = $1 AND user_id IS NULL', v_table_name)
  INTO v_user_record
  USING p_email;

  -- Check if user exists
  IF v_user_record IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found', 'needs_migration', false);
  END IF;

  -- Verify password using verify_password function
  v_password_match := verify_password(p_password, v_user_record.password_hash);

  IF NOT v_password_match THEN
    RETURN jsonb_build_object('error', 'Invalid password', 'needs_migration', false);
  END IF;

  -- Return success with user data
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_record.id,
    'email', v_user_record.email,
    'name', v_user_record.name,
    'needs_migration', true
  );
END;
$$;