import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase is properly configured
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' && 
  supabaseAnonKey !== 'placeholder-key'
);

if (!isSupabaseConfigured) {
  console.warn('Supabase not configured properly. Please check your environment variables.');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
} else {
  console.log('✅ Supabase configured successfully');
  console.log('📍 URL:', supabaseUrl);
  console.log('🔑 Anon Key (first 50 chars):', supabaseAnonKey?.substring(0, 50) + '...');
}

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

// Service role client for authentication queries (bypasses RLS)
export const supabaseServiceRole = supabaseServiceKey ? createClient(
  supabaseUrl!,
  supabaseServiceKey!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) : null;
// Database types
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          email: string;
          company: string;
          phone: string | null;
          address: string | null;
          plan: 'basic' | 'professional' | 'enterprise';
          status: 'active' | 'inactive';
          created_at: string;
          last_login: string | null;
          password_hash: string | null;
          notehub_fleet_uid: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          company: string;
          phone?: string | null;
          address?: string | null;
          plan?: 'basic' | 'professional' | 'enterprise';
          status?: 'active' | 'inactive';
          created_at?: string;
          last_login?: string | null;
          password_hash?: string | null;
          notehub_fleet_uid?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          company?: string;
          phone?: string | null;
          address?: string | null;
          plan?: 'basic' | 'professional' | 'enterprise';
          status?: 'active' | 'inactive';
          created_at?: string;
          last_login?: string | null;
          password_hash?: string | null;
          notehub_fleet_uid?: string | null;
        };
      };
      devices: {
        Row: {
          id: string;
          device_id: string;
          serial_number: string;
          name: string;
          location: string;
          coordinates: { lat: number; lon: number } | null;
          tenant_id: string | null;
          status: 'online' | 'offline' | 'maintenance';
          firmware_version: string;
          last_seen: string;
          battery_level: number;
          flow_rate: number;
          total_usage: number;
          install_date: string;
          notehub_device_uid: string | null;
          alias: string | null;
          fleet_group_id: string | null;
          signal_strength: number | null;
          alert_config: Record<string, any> | null;
          notehub_config: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          serial_number: string;
          name: string;
          location: string;
          coordinates?: { lat: number; lon: number } | null;
          tenant_id?: string | null;
          status?: 'online' | 'offline' | 'maintenance';
          firmware_version?: string;
          last_seen?: string;
          battery_level?: number;
          flow_rate?: number;
          total_usage?: number;
          install_date?: string;
          notehub_device_uid?: string | null;
          alias?: string | null;
          fleet_group_id?: string | null;
          signal_strength?: number | null;
          alert_config?: Record<string, any> | null;
          notehub_config?: Record<string, any> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          serial_number?: string;
          name?: string;
          location?: string;
          coordinates?: { lat: number; lon: number } | null;
          tenant_id?: string | null;
          status?: 'online' | 'offline' | 'maintenance';
          firmware_version?: string;
          last_seen?: string;
          battery_level?: number;
          flow_rate?: number;
          total_usage?: number;
          install_date?: string;
          notehub_device_uid?: string | null;
          alias?: string | null;
          fleet_group_id?: string | null;
          signal_strength?: number | null;
          alert_config?: Record<string, any> | null;
          notehub_config?: Record<string, any> | null;
          created_at?: string;
        };
      };
      device_data: {
        Row: {
          id: string;
          device_id: string;
          timestamp: string;
          flow_rate: number;
          total_volume: number;
          battery_level: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          timestamp: string;
          flow_rate?: number;
          total_volume?: number;
          battery_level?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          timestamp?: string;
          flow_rate?: number;
          total_volume?: number;
          battery_level?: number | null;
          created_at?: string;
        };
      };
      alerts: {
        Row: {
          id: string;
          device_id: string;
          type: 'leak' | 'low_battery' | 'offline' | 'maintenance' | 'alarm' | 'low_signal';
          message: string;
          severity: 'low' | 'medium' | 'high';
          resolved: boolean;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          device_id: string;
          type: 'leak' | 'low_battery' | 'offline' | 'maintenance' | 'alarm' | 'low_signal';
          message: string;
          severity: 'low' | 'medium' | 'high';
          resolved?: boolean;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          device_id?: string;
          type?: 'leak' | 'low_battery' | 'offline' | 'maintenance' | 'alarm' | 'low_signal';
          message?: string;
          severity?: 'low' | 'medium' | 'high';
          resolved?: boolean;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      admins: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name: string;
          created_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          created_at?: string;
          last_login?: string | null;
        };
      };
      device_settings: {
        Row: {
          id: string;
          device_id: string;
          sampling_rate_minutes: number;
          alert_threshold_flow_rate: number;
          low_battery_alert_enabled: boolean;
          auto_firmware_updates_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          device_id: string;
          sampling_rate_minutes?: number;
          alert_threshold_flow_rate?: number;
          low_battery_alert_enabled?: boolean;
          auto_firmware_updates_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          device_id?: string;
          sampling_rate_minutes?: number;
          alert_threshold_flow_rate?: number;
          low_battery_alert_enabled?: boolean;
          auto_firmware_updates_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}