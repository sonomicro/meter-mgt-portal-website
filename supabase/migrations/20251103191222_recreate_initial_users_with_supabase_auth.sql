/*
  # Recreate Initial Users with Supabase Auth
  
  1. Purpose
    - Recreate the three initial users that were lost
    - Create them directly in Supabase Auth
    - Link to admins/tenants tables
  
  2. Users Created
    - Admin: admin@sonomicro.com (password: demo123)
    - Tenant: ol@gos.com (password: gos123)
    - Tenant: test@dog.com (password: dog123)
  
  3. Process
    - Creates Supabase Auth users with confirmed emails
    - Creates corresponding records in admins/tenants tables
    - Links auth users to admin/tenant records via user_id
*/

DO $$
DECLARE
  v_admin_id uuid;
  v_tenant1_id uuid;
  v_tenant2_id uuid;
  v_auth_admin_id uuid;
  v_auth_tenant1_id uuid;
  v_auth_tenant2_id uuid;
BEGIN
  -- Create admin auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@sonomicro.com',
    extensions.crypt('demo123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin Boss","role":"admin"}'::jsonb
  )
  RETURNING id INTO v_auth_admin_id;

  -- Create admin record
  INSERT INTO admins (id, email, password_hash, name, user_id, created_at, last_login)
  VALUES (
    gen_random_uuid(),
    'admin@sonomicro.com',
    extensions.crypt('demo123', extensions.gen_salt('bf')),
    'Admin Boss',
    v_auth_admin_id,
    now(),
    now()
  )
  RETURNING id INTO v_admin_id;

  -- Create tenant 1 auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'ol@gos.com',
    extensions.crypt('gos123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Ölgerðin","role":"tenant"}'::jsonb
  )
  RETURNING id INTO v_auth_tenant1_id;

  -- Create tenant 1 record
  INSERT INTO tenants (id, name, email, password_hash, company, phone, address, plan, status, user_id, created_at, last_login)
  VALUES (
    gen_random_uuid(),
    'Ölgerðin',
    'ol@gos.com',
    extensions.crypt('gos123', extensions.gen_salt('bf')),
    'Ölgerðin Corporation',
    '+354-123-4567',
    'Reykjavik, Iceland',
    'professional',
    'active',
    v_auth_tenant1_id,
    now(),
    now()
  )
  RETURNING id INTO v_tenant1_id;

  -- Create tenant 2 auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test@dog.com',
    extensions.crypt('dog123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Testing Dog","role":"tenant"}'::jsonb
  )
  RETURNING id INTO v_auth_tenant2_id;

  -- Create tenant 2 record
  INSERT INTO tenants (id, name, email, password_hash, company, phone, address, plan, status, user_id, created_at, last_login)
  VALUES (
    gen_random_uuid(),
    'Testing Dog',
    'test@dog.com',
    extensions.crypt('dog123', extensions.gen_salt('bf')),
    'Dog Testing Inc',
    '+1-555-0123',
    'San Francisco, CA',
    'basic',
    'active',
    v_auth_tenant2_id,
    now(),
    now()
  )
  RETURNING id INTO v_tenant2_id;

  RAISE NOTICE 'Successfully created all users with Supabase Auth integration';
  RAISE NOTICE 'Admin ID: %, Auth ID: %', v_admin_id, v_auth_admin_id;
  RAISE NOTICE 'Tenant 1 ID: %, Auth ID: %', v_tenant1_id, v_auth_tenant1_id;
  RAISE NOTICE 'Tenant 2 ID: %, Auth ID: %', v_tenant2_id, v_auth_tenant2_id;
END $$;