/*
  # Fix Function Search Path Security

  1. Security Fix
    - Set search_path to pg_catalog, public for all functions
    - Prevents search_path manipulation attacks
    - Critical security fix for all custom functions
  
  2. Functions Fixed
    - update_fleet_groups_updated_at()
    - increment_device_data_usage(text, uuid, bigint, timestamptz, timestamptz)
    - increment_webhook_usage(text, bigint, timestamptz, timestamptz)
    - increment_proxy_usage(text, bigint, bigint, timestamptz, timestamptz)
    - update_device_settings_updated_at()
    - get_device_usage_stats(timestamptz, timestamptz)
    - authenticate_tenant(text, text)
    - hash_password(text)
    - verify_password(text, text)
    - authenticate_admin(text, text)
    - is_admin()
    - is_tenant()
    - get_user_role()
    - authenticate_user(text, text, text)
*/

-- Fix search_path for all functions by setting them to pg_catalog, public
-- This prevents search_path manipulation attacks

ALTER FUNCTION update_fleet_groups_updated_at() SET search_path = pg_catalog, public;

ALTER FUNCTION increment_device_data_usage(text, uuid, bigint, timestamp with time zone, timestamp with time zone) 
  SET search_path = pg_catalog, public;

ALTER FUNCTION increment_webhook_usage(text, bigint, timestamp with time zone, timestamp with time zone) 
  SET search_path = pg_catalog, public;

ALTER FUNCTION increment_proxy_usage(text, bigint, bigint, timestamp with time zone, timestamp with time zone) 
  SET search_path = pg_catalog, public;

ALTER FUNCTION update_device_settings_updated_at() SET search_path = pg_catalog, public;

ALTER FUNCTION get_device_usage_stats(timestamp with time zone, timestamp with time zone) 
  SET search_path = pg_catalog, public;

ALTER FUNCTION authenticate_tenant(text, text) SET search_path = pg_catalog, public;

ALTER FUNCTION hash_password(text) SET search_path = pg_catalog, public;

ALTER FUNCTION verify_password(text, text) SET search_path = pg_catalog, public;

ALTER FUNCTION authenticate_admin(text, text) SET search_path = pg_catalog, public;

ALTER FUNCTION is_admin() SET search_path = pg_catalog, public;

ALTER FUNCTION is_tenant() SET search_path = pg_catalog, public;

ALTER FUNCTION get_user_role() SET search_path = pg_catalog, public;

ALTER FUNCTION authenticate_user(text, text, text) SET search_path = pg_catalog, public;