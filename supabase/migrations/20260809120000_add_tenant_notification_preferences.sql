/*
  # Add Tenant Notification Preferences

  1. New Tables
    - `tenant_notification_preferences`
      - `id` (uuid, primary key)
      - `tenant_id` (uuid, unique, foreign key to tenants)
      - `email_notifications_enabled` (boolean) - master switch for email notifications
      - `low_battery_alerts` (boolean) - whether a low battery alert sends an email
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `tenant_notification_preferences`
    - Add policies for tenants to read/insert/update their own row
*/

CREATE TABLE IF NOT EXISTS tenant_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  email_notifications_enabled boolean DEFAULT true,
  low_battery_alerts boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own notification preferences"
  ON tenant_notification_preferences
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can insert own notification preferences"
  ON tenant_notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Tenants can update own notification preferences"
  ON tenant_notification_preferences
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_tenant_notification_preferences_tenant ON tenant_notification_preferences(tenant_id);
