import { supabase } from '../lib/supabase';
import { getCurrentUser } from './auth';
import type { User } from '../types';

async function checkAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Please log in');
  }
  return user;
}

export class SecureDatabase {
  static async getTenants() {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return [data];
    }

    throw new Error('Unauthorized');
  }

  static async updateTenant(tenantId: string, updates: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      if (user.id !== tenantId) {
        throw new Error('Forbidden: Cannot update other tenant data');
      }

      const allowedUpdates = ['name', 'company', 'phone', 'address'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      const { data, error } = await supabase
        .from('tenants')
        .update(filteredUpdates)
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async deleteTenant(tenantId: string) {
    const user = await checkAuth();

    if (user.role !== 'admin') {
      throw new Error('Forbidden: Only admins can delete tenants');
    }

    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) throw error;
  }

  static async getDevices() {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async updateDevice(deviceId: string, updates: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('devices')
        .update(updates)
        .eq('id', deviceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data: device, error: fetchError } = await supabase
        .from('devices')
        .select('tenant_id')
        .eq('id', deviceId)
        .single();

      if (fetchError) throw fetchError;

      if (device.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot update devices from other tenants');
      }

      const allowedUpdates = ['alias', 'fleet_group_id', 'alert_config'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      const { data, error } = await supabase
        .from('devices')
        .update(filteredUpdates)
        .eq('id', deviceId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async createDevice(deviceData: any) {
    const user = await checkAuth();

    if (user.role !== 'admin') {
      throw new Error('Forbidden: Only admins can create devices');
    }

    const { data, error } = await supabase
      .from('devices')
      .insert([deviceData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteDevice(deviceId: string) {
    const user = await checkAuth();

    if (user.role !== 'admin') {
      throw new Error('Forbidden: Only admins can delete devices');
    }

    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', deviceId);

    if (error) throw error;
  }

  static async getDeviceData(deviceId?: string) {
    const user = await checkAuth();

    let query = supabase
      .from('device_data')
      .select('*, devices!inner(tenant_id)')
      .order('timestamp', { ascending: false });

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    if (user.role === 'tenant') {
      query = query.eq('devices.tenant_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  static async getAlerts() {
    const user = await checkAuth();

    let query = supabase
      .from('alerts')
      .select('*, devices!inner(tenant_id)')
      .order('created_at', { ascending: false });

    if (user.role === 'tenant') {
      query = query.eq('devices.tenant_id', user.id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  static async updateAlert(alertId: string, updates: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('alerts')
        .update(updates)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data: alert, error: fetchError } = await supabase
        .from('alerts')
        .select('*, devices!inner(tenant_id)')
        .eq('id', alertId)
        .single();

      if (fetchError) throw fetchError;

      if ((alert as any).devices.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot update alerts from other tenants');
      }

      const allowedUpdates = ['resolved', 'resolved_at'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updates[key];
          return obj;
        }, {} as any);

      const { data, error } = await supabase
        .from('alerts')
        .update(filteredUpdates)
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async getFleetGroups() {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('fleet_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data, error } = await supabase
        .from('fleet_groups')
        .select('*')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async createFleetGroup(groupData: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('fleet_groups')
        .insert([groupData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const tenantGroupData = {
        ...groupData,
        tenant_id: user.id
      };

      const { data, error } = await supabase
        .from('fleet_groups')
        .insert([tenantGroupData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async updateFleetGroup(groupId: string, updates: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('fleet_groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data: group, error: fetchError } = await supabase
        .from('fleet_groups')
        .select('tenant_id')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

      if (group.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot update fleet groups from other tenants');
      }

      const { data, error } = await supabase
        .from('fleet_groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async deleteFleetGroup(groupId: string) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { error } = await supabase
        .from('fleet_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      return;
    }

    if (user.role === 'tenant') {
      const { data: group, error: fetchError } = await supabase
        .from('fleet_groups')
        .select('tenant_id')
        .eq('id', groupId)
        .single();

      if (fetchError) throw fetchError;

      if (group.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot delete fleet groups from other tenants');
      }

      const { error } = await supabase
        .from('fleet_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;
      return;
    }

    throw new Error('Unauthorized');
  }

  static async getDeviceSettings(deviceId: string) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('tenant_id')
        .eq('id', deviceId)
        .single();

      if (deviceError) throw deviceError;

      if (device.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot access settings for devices from other tenants');
      }

      const { data, error } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }

  static async updateDeviceSettings(deviceId: string, settings: any) {
    const user = await checkAuth();

    if (user.role === 'admin') {
      const { data, error } = await supabase
        .from('device_settings')
        .upsert({ device_id: deviceId, ...settings })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    if (user.role === 'tenant') {
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('tenant_id')
        .eq('id', deviceId)
        .single();

      if (deviceError) throw deviceError;

      if (device.tenant_id !== user.id) {
        throw new Error('Forbidden: Cannot update settings for devices from other tenants');
      }

      const { data, error } = await supabase
        .from('device_settings')
        .upsert({ device_id: deviceId, ...settings })
        .select()
        .single();

      if (error) throw error;
      return data;
    }

    throw new Error('Unauthorized');
  }
}
