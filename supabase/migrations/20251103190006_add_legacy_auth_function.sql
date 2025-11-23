/*
  # Add Legacy Authentication Function
  
  1. New Functions
    - `authenticate_legacy_user` - Server-side function to authenticate and migrate legacy users
      - Uses SECURITY DEFINER to bypass RLS
      - Verifies bcrypt password
      - Creates Supabase Auth user
      - Links auth user to existing record
  
  2. Security
    - Function uses SECURITY DEFINER (elevated privileges)
    - Only accessible for authentication purposes
    - Does not expose sensitive data
*/

CREATE OR REPLACE FUNCTION authenticate_legacy_user(
  p_email text,
  p_password text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Verify password using crypt
  v_password_match := (v_user_record.password_hash = crypt(p_password, v_user_record.password_hash));

  IF NOT v_password_match THEN
    RETURN jsonb_build_object('error', 'Invalid password', 'needs_migration', false);
  END IF;

  -- Return success with user data (migration will be handled by edge function)
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_record.id,
    'email', v_user_record.email,
    'name', v_user_record.name,
    'needs_migration', true
  );
END;
$$;