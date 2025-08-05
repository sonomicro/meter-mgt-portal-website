import { supabase, Database } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUser } from './auth';
import { NotehubService } from './notehub';
import type { WaterFlowData } from './notehub';

type Tenant = Database['public']['Tables']['tenants']['Row'];
type Device = Database['public']['Tables']['devices']['Row'];
type DeviceData = Database['public']['Tables']['device_data']['Row'];
type Alert = Database['public']['Tables']['alerts']['Row'];

// Tenant Management Service
export class TenantService {
  // Get all tenants (admin only)
  static async getAllTenants(): Promise<Tenant[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please connect to Supabase first.');
    }

    try {
      console.log('Fetching tenants from Supabase...');
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Supabase error fetching tenants:', error);
        throw new Error(`Failed to fetch tenants: ${error.message}`);
      }
      
      console.log('Successfully fetched tenants:', data?.length || 0);
      
      // Augment each tenant with calculated statistics
      const tenantsWithStats = await Promise.all(
        (data || []).map(async (tenant) => {
          try {
            const stats = await this.getTenantStats(tenant.id);
            return {
              ...tenant,
              devicesCount: stats.deviceCount,
              totalUsage: stats.totalUsage,
              dataUsage: 0, // Placeholder - would need to be calculated from actual usage data
              monthlyDataUsage: 0, // Placeholder - would need to be calculated from actual usage data
              createdAt: tenant.created_at,
              lastLogin: tenant.last_login
            };
          } catch (error) {
            console.error(`Error getting stats for tenant ${tenant.id}:`, error);
            // Return tenant with default values if stats fetch fails
            return {
              ...tenant,
              devicesCount: 0,
              totalUsage: 0,
              dataUsage: 0,
              monthlyDataUsage: 0,
              createdAt: tenant.created_at,
              lastLogin: tenant.last_login
            };
          }
        })
      );
      
      return tenantsWithStats;
    } catch (error) {
      console.error('Error in getAllTenants:', error);
      throw error;
    }
  }

  // Get tenant by ID
  static async getTenant(id: string): Promise<Tenant | null> {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Create new tenant
  static async createTenant(tenant: Database['public']['Tables']['tenants']['Insert']): Promise<Tenant> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please connect to Supabase to create tenants.');
    }

    try {
      // First, verify the current user is an admin
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user found. Please log in first.');
      }

      console.log('Current user:', user.email);
      console.log('User metadata:', user.user_metadata);
      console.log('App metadata:', user.app_metadata);

      const { data, error } = await supabase
        .from('tenants')
        .insert(tenant)
        .select()
        .single();

      if (error) {
        console.error('Tenant creation error details:', error);
        
        if (error.code === '42501' || error.message.includes('row-level security policy')) {
          // Check if user has admin role
          const isAdmin = user.user_metadata?.role === 'admin' || 
                         user.app_metadata?.role === 'admin' ||
                         user.email?.includes('admin');
          
          if (!isAdmin) {
            throw new Error('Admin privileges required to create tenants. Please log in with an admin account.');
          } else {
            throw new Error('Database policy error: Admin user cannot create tenants. Please check RLS policies in Supabase dashboard.');
          }
        }
        
        throw new Error(`Failed to create tenant: ${error.message}`);
      }
      
      console.log('Tenant created successfully:', data);
      return data;
    } catch (error: any) {
      console.error('Tenant creation error:', error);
      throw error;
    }
  }

  // Update tenant
  static async updateTenant(id: string, updates: Database['public']['Tables']['tenants']['Update']): Promise<Tenant> {
    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Delete tenant
  static async deleteTenant(id: string): Promise<void> {
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Get tenant statistics
  static async getTenantStats(tenantId: string) {
    // Get device count
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Get total usage
    const { data: devices } = await supabase
      .from('devices')
      .select('total_usage')
      .eq('tenant_id', tenantId);

    const totalUsage = devices?.reduce((sum, device) => sum + device.total_usage, 0) || 0;

    // Get active alerts - first get device IDs, then query alerts
    let alertCount = 0;
    try {
      const { data: deviceIds } = await supabase
        .from('devices')
        .select('id')
        .eq('tenant_id', tenantId);

      if (deviceIds && deviceIds.length > 0) {
        const deviceIdArray = deviceIds.map(device => device.id);
        const { count } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('resolved', false)
          .in('device_id', deviceIdArray);
        
        alertCount = count || 0;
      }
    } catch (error) {
      console.error('Error fetching alert count:', error);
      alertCount = 0;
    }

    return {
      deviceCount: deviceCount || 0,
      totalUsage,
      activeAlerts: alertCount
    };
  }
}

// Device Management Service
export class DeviceService {
  // Get available firmware versions from Notehub
  static async getAvailableFirmwareVersions(): Promise<string[]> {
    if (!NotehubService.isConfigured()) {
      // Return default versions if Notehub not configured
      return ['1.0.0', '1.1.0', '2.0.0', '2.1.0'];
    }

    try {
      const firmwareList = await NotehubService.getFirmwareVersions();
      return firmwareList.map(fw => fw.version);
    } catch (error) {
      console.error('Error fetching firmware versions:', error);
      return ['1.0.0', '1.1.0', '2.0.0', '2.1.0']; // Fallback versions
    }
  }

  // Sync devices between Notehub and Supabase
  static async syncDevicesWithNotehub(): Promise<{
    synced: number;
    added: number;
    updated: number;
    errors: string[];
  }> {
    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    const errors: string[] = [];
    let synced = 0;
    let added = 0;
    let updated = 0;

    try {
      // Get devices from both systems
      const [notehubDevices, supabaseDevices] = await Promise.all([
        NotehubService.getDevices(),
        this.getDevices()
      ]);

      console.log(`Found ${notehubDevices.length} devices in Notehub, ${supabaseDevices.length} in Supabase`);

      // Create maps for easier lookup
      const notehubDeviceMap = new Map(notehubDevices.map(d => [d.uid, d]));
      const supabaseDeviceMap = new Map(supabaseDevices.map(d => [d.notehub_device_uid, d]).filter(([uid]) => uid));

      // Process Notehub devices
      for (const notehubDevice of notehubDevices) {
        try {
          const supabaseDevice = supabaseDeviceMap.get(notehubDevice.uid);
          
          if (supabaseDevice) {
            // Update existing device with latest Notehub data
            const health = await NotehubService.getDeviceHealth(notehubDevice.uid);
            const updates: Database['public']['Tables']['devices']['Update'] = {
              status: health.isOnline ? 'online' : 'offline',
              last_seen: health.lastSeen,
              battery_level: health.batteryLevel,
            };

            // Update location if available
            if (notehubDevice.location) {
              updates.coordinates = {
                lat: notehubDevice.location.latitude,
                lon: notehubDevice.location.longitude
              };
              updates.location = `${notehubDevice.location.name}, ${notehubDevice.location.country}`;
            }

            await this.updateDevice(supabaseDevice.id, updates);
            updated++;
          } else {
            // Add new device from Notehub to Supabase
            const health = await NotehubService.getDeviceHealth(notehubDevice.uid);
            const newDevice: Database['public']['Tables']['devices']['Insert'] = {
              device_id: notehubDevice.uid.substring(0, 20), // Truncate if needed
              serial_number: notehubDevice.serial_number || notehubDevice.uid,
              name: `Device ${notehubDevice.uid.substring(0, 8)}`,
              location: notehubDevice.location ? 
                `${notehubDevice.location.name}, ${notehubDevice.location.country}` : 
                'Unknown Location',
              coordinates: notehubDevice.location ? {
                lat: notehubDevice.location.latitude,
                lon: notehubDevice.location.longitude
              } : null,
              notehub_device_uid: notehubDevice.uid,
              status: health.isOnline ? 'online' : 'offline',
              last_seen: health.lastSeen,
              battery_level: health.batteryLevel,
              firmware_version: '1.0.0', // Default version
              tenant_id: null // Will need to be assigned manually
            };

            await this.createDeviceFromSync(newDevice);
            added++;
          }
          synced++;
        } catch (error) {
          console.error(`Error syncing device ${notehubDevice.uid}:`, error);
          errors.push(`Device ${notehubDevice.uid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Check for Supabase devices not in Notehub
      for (const supabaseDevice of supabaseDevices) {
        if (supabaseDevice.notehub_device_uid && !notehubDeviceMap.has(supabaseDevice.notehub_device_uid)) {
          console.warn(`Device ${supabaseDevice.device_id} exists in Supabase but not in Notehub`);
          // Optionally mark as offline or remove Notehub UID
          try {
            await this.updateDevice(supabaseDevice.id, {
              status: 'offline',
              notehub_device_uid: null // Remove invalid Notehub reference
            });
          } catch (error) {
            errors.push(`Failed to update orphaned device ${supabaseDevice.device_id}`);
          }
        }
      }

      return { synced, added, updated, errors };
    } catch (error) {
      console.error('Error during device sync:', error);
      throw error;
    }
  }

  // Get all devices (admin) or tenant devices
  static async getDevices(tenantId?: string): Promise<Device[]> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please connect to Supabase first.');
    }

    try {
      console.log('Fetching devices from Supabase...');
      
      // Get current authenticated user
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found. Please log in.');
      }
      
      console.log('Current authenticated user:', currentUser.id, currentUser.email);
      let query = supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      // Filter by the authenticated user's ID for tenants, or use provided tenantId for admins
      if (currentUser.role === 'tenant') {
        console.log('Filtering by tenant_id (current user id):', currentUser.id);
        query = query.eq('tenant_id', currentUser.id);
      } else if (tenantId) {
        console.log('Filtering by provided tenant_id:', tenantId);
        query = query.eq('tenant_id', tenantId);
      }
      // If admin and no tenantId provided, return all devices

      const { data, error } = await query;
      
      if (error) {
        console.error('Supabase error fetching devices:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw new Error(`Failed to fetch devices: ${error.message}`);
      }
      
      console.log('Raw query result:', data);
      console.log('Successfully fetched devices:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error in getDevices:', error);
      throw error;
    }
  }

  // Get device by ID
  static async getDevice(id: string): Promise<Device | null> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Create new device
  static async createDevice(device: Database['public']['Tables']['devices']['Insert']): Promise<Device> {
    // If device has Notehub UID and Notehub is configured, try to add to Notehub FIRST
    if (device.notehub_device_uid) {
      if (!NotehubService.isConfigured()) {
        console.warn('Notehub is not configured. Device will be added to database only.');
      } else {
        try {
          console.log(`Adding device ${device.notehub_device_uid} to Notehub first...`);
          await NotehubService.addDevice({
            device_uid: device.notehub_device_uid,
            product_uid: undefined, // Will use project default
            fleet_uid: undefined // Will use project default
          });
          console.log(`Successfully added device to Notehub`);
        } catch (notehubError) {
          console.error('Failed to add device to Notehub:', notehubError);
          console.warn('Continuing with database-only device creation. Device can be synced with Notehub later.');
          // Don't throw error - continue with database creation
        }
      }
    }

    // Add to Supabase database
    const { data, error } = await supabase
      .from('devices')
      .insert(device)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  // Create device from sync (bypasses Notehub operations)
  private static async createDeviceFromSync(device: Database['public']['Tables']['devices']['Insert']): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .insert(device)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update device
  static async updateDevice(id: string, updates: Database['public']['Tables']['devices']['Update'], skipNotehub: boolean = false): Promise<Device> {
    // Get current device data
    const currentDevice = await this.getDevice(id);
    if (!currentDevice) {
      throw new Error('Device not found');
    }

    // If updating Notehub-related fields and device has Notehub UID, update Notehub FIRST
    if (!skipNotehub && currentDevice.notehub_device_uid && NotehubService.isConfigured()) {
      const notehubUpdates: any = {};
      let hasNotehubUpdates = false;

      // Check if we're updating fields that need to be synced to Notehub
      if (updates.name || updates.location) {
        // Notehub doesn't directly support name/location updates via API
        // but we could send configuration notes to the device
        hasNotehubUpdates = true;
      }

      if (hasNotehubUpdates) {
        try {
          console.log(`Updating device ${currentDevice.notehub_device_uid} in Notehub...`);
          await NotehubService.updateDevice(currentDevice.notehub_device_uid, notehubUpdates);
        } catch (notehubError) {
          console.error('Failed to update device in Notehub:', notehubError);
          throw new Error(`Failed to update device in Notehub: ${notehubError instanceof Error ? notehubError.message : 'Unknown error'}`);
        }
      }
    }

    // Update in Supabase
    const { data, error } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Delete device
  static async deleteDevice(id: string): Promise<void> {
    // Get device data before deletion
    const device = await this.getDevice(id);
    if (!device) {
      throw new Error('Device not found');
    }

    // If device has Notehub UID, remove from Notehub FIRST
    if (device.notehub_device_uid && NotehubService.isConfigured()) {
      try {
        console.log(`Removing device ${device.notehub_device_uid} from Notehub...`);
        await NotehubService.removeDevice(device.notehub_device_uid);
        console.log(`Successfully removed device from Notehub`);
      } catch (notehubError) {
        console.error('Failed to remove device from Notehub:', notehubError);
        throw new Error(`Failed to remove device from Notehub: ${notehubError instanceof Error ? notehubError.message : 'Unknown error'}`);
      }
    }

    // Only delete from Supabase if Notehub operation succeeded (or no Notehub UID)
    const { error } = await supabase
      .from('devices')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Sync device data from Notehub
  static async syncDeviceFromNotehub(deviceId: string): Promise<Device> {
    const device = await this.getDevice(deviceId);
    if (!device || !device.notehub_device_uid) {
      throw new Error('Device not found or missing Notehub UID');
    }

    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    try {
      // Get latest data from Notehub
      const notehubDevice = await NotehubService.getDevice(device.notehub_device_uid);
      const health = await NotehubService.getDeviceHealth(device.notehub_device_uid);

      // Update device with latest data
      const updates: Database['public']['Tables']['devices']['Update'] = {
        status: health.isOnline ? 'online' : 'offline',
        last_seen: health.lastSeen,
        battery_level: health.batteryLevel,
      };

      // Update location if available
      if (notehubDevice.location) {
        updates.coordinates = {
          lat: notehubDevice.location.latitude,
          lon: notehubDevice.location.longitude
        };
        updates.location = `${notehubDevice.location.name}, ${notehubDevice.location.country}`;
      }

      return await this.updateDevice(deviceId, updates, true); // Skip Notehub update since we're syncing FROM Notehub
    } catch (error) {
      console.error(`Failed to sync device ${deviceId} from Notehub:`, error);
      throw error;
    }
  }

  // Sync all devices from Notehub
  static async syncAllDevicesFromNotehub(): Promise<void> {
    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    const devices = await this.getDevices();
    const syncPromises = devices
      .filter(device => device.notehub_device_uid)
      .map(device => this.syncDeviceFromNotehub(device.id));

    await Promise.allSettled(syncPromises);
  }

  // Update firmware for device via Notehub
  static async updateDeviceFirmware(deviceId: string, firmwareVersion: string): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (!device || !device.notehub_device_uid) {
      throw new Error('Device not found or missing Notehub UID');
    }

    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    try {
      // Initiate firmware update in Notehub FIRST
      await NotehubService.updateDeviceFirmware(device.notehub_device_uid, firmwareVersion);
      
      // Update local record to reflect pending firmware update
      await this.updateDevice(deviceId, {
        firmware_version: `${firmwareVersion} (updating...)`
      }, true); // Skip Notehub update since we just did it
    } catch (error) {
      console.error(`Failed to update firmware for device ${deviceId}:`, error);
      throw error;
    }
  }

  // Update firmware for multiple devices
  static async updateMultipleDevicesFirmware(deviceIds: string[], firmwareVersion: string): Promise<void> {
    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    // Get devices and their Notehub UIDs
    const devices = await Promise.all(deviceIds.map(id => this.getDevice(id)));
    const validDevices = devices.filter((device): device is Device => 
      device !== null && device.notehub_device_uid !== null
    );

    if (validDevices.length === 0) {
      throw new Error('No valid devices with Notehub UIDs found');
    }

    const notehubUIDs = validDevices.map(device => device.notehub_device_uid!);

    try {
      // Update firmware in Notehub FIRST
      await NotehubService.updateMultipleDevicesFirmware(notehubUIDs, firmwareVersion);
      
      // Update local records
      const updatePromises = validDevices.map(device =>
        this.updateDevice(device.id, {
          firmware_version: `${firmwareVersion} (updating...)`
        }, true) // Skip Notehub update since we just did it
      );
      
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Failed to update firmware for multiple devices:', error);
      throw error;
    }
  }

  // Remove device from Notehub only (keep in Supabase)
  static async removeDeviceFromNotehub(deviceId: string): Promise<Device> {
    const device = await this.getDevice(deviceId);
    if (!device || !device.notehub_device_uid) {
      throw new Error('Device not found or missing Notehub UID');
    }

    if (!NotehubService.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    try {
      // Remove from Notehub FIRST
      await NotehubService.removeDevice(device.notehub_device_uid);
      
      // Update local record to remove Notehub reference
      return await this.updateDevice(deviceId, {
        notehub_device_uid: null,
        status: 'offline'
      }, true); // Skip Notehub update since we just removed it
    } catch (error) {
      console.error(`Failed to remove device from Notehub:`, error);
      throw error;
    }
  }
}

// Device Data Service
export class DeviceDataService {
  // Get device data for a specific device
  static async getDeviceData(deviceId: string, limit: number = 100): Promise<DeviceData[]> {
    const { data, error } = await supabase
      .from('device_data')
      .select('*')
      .eq('device_id', deviceId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  // Add new device data point
  static async addDeviceData(data: Database['public']['Tables']['device_data']['Insert']): Promise<DeviceData> {
    const { data: result, error } = await supabase
      .from('device_data')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  // Process water flow data from Notehub
  static async processWaterFlowData(waterFlowData: WaterFlowData): Promise<void> {
    // Find device by Notehub device ID
    const { data: devices } = await supabase
      .from('devices')
      .select('id')
      .eq('notehub_device_uid', waterFlowData.deviceId);

    if (!devices || devices.length === 0) {
      console.warn(`Device not found for Notehub ID: ${waterFlowData.deviceId}`);
      return;
    }

    const device = devices[0];

    // Add device data
    await this.addDeviceData({
      device_id: device.id,
      timestamp: waterFlowData.timestamp,
      flow_rate: waterFlowData.flowRate,
      total_volume: waterFlowData.totalVolume,
      temperature: waterFlowData.temperature,
      pressure: waterFlowData.pressure,
      battery_level: waterFlowData.batteryLevel
    });

    // Update device with latest values
    await DeviceService.updateDevice(device.id, {
      flow_rate: waterFlowData.flowRate,
      total_usage: waterFlowData.totalVolume,
      battery_level: waterFlowData.batteryLevel,
      last_seen: waterFlowData.timestamp,
      status: 'online'
    });

    // Check for alerts
    await this.checkForAlerts(device.id, waterFlowData);
  }

  // Check for alerts based on device data
  private static async checkForAlerts(deviceId: string, data: WaterFlowData): Promise<void> {
    const alerts: Database['public']['Tables']['alerts']['Insert'][] = [];

    // Low battery alert
    if (data.batteryLevel && data.batteryLevel < 25) {
      alerts.push({
        device_id: deviceId,
        type: 'low_battery',
        message: `Battery level below 25% (${data.batteryLevel}%)`,
        severity: data.batteryLevel < 10 ? 'high' : 'medium'
      });
    }

    // High flow rate alert (potential leak)
    if (data.flowRate > 100) { // Threshold can be configurable
      alerts.push({
        device_id: deviceId,
        type: 'leak',
        message: `Unusually high flow rate detected: ${data.flowRate}L/min`,
        severity: 'high'
      });
    }

    // Insert alerts if any
    if (alerts.length > 0) {
      await supabase.from('alerts').insert(alerts);
    }
  }
}

// Device Settings Service
export class DeviceSettingsService {
  // Get device settings by device ID
  static async getDeviceSettings(deviceId: string): Promise<DeviceSettings | null> {
    const { data, error } = await supabase
      .from('device_settings')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data;
  }

  // Create device settings
  static async createDeviceSettings(settings: Database['public']['Tables']['device_settings']['Insert']): Promise<DeviceSettings> {
    const { data, error } = await supabase
      .from('device_settings')
      .insert(settings)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update device settings
  static async updateDeviceSettings(deviceId: string, updates: Database['public']['Tables']['device_settings']['Update']): Promise<DeviceSettings> {
    const { data, error } = await supabase
      .from('device_settings')
      .update(updates)
      .eq('device_id', deviceId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get or create device settings (returns default settings if none exist)
  static async getOrCreateDeviceSettings(deviceId: string): Promise<DeviceSettings> {
    let settings = await this.getDeviceSettings(deviceId);
    
    if (!settings) {
      // Create default settings
      settings = await this.createDeviceSettings({
        device_id: deviceId,
        sampling_rate_minutes: 5,
        alert_threshold_flow_rate: 100,
        low_battery_alert_enabled: true,
        auto_firmware_updates_enabled: false
      });
    }
    
    return settings;
  }

  // Delete device settings
  static async deleteDeviceSettings(deviceId: string): Promise<void> {
    const { error } = await supabase
      .from('device_settings')
      .delete()
      .eq('device_id', deviceId);

    if (error) throw error;
  }
}

// Alert Management Service
export class AlertService {
  // Get alerts for tenant or all alerts (admin)
  static async getAlerts(tenantId?: string): Promise<Alert[]> {
    let query = supabase
      .from('alerts')
      .select(`
        *,
        devices!inner(
          id,
          device_id,
          name,
          tenant_id
        )
      `)
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('devices.tenant_id', tenantId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Resolve alert
  static async resolveAlert(alertId: string): Promise<Alert> {
    const { data, error } = await supabase
      .from('alerts')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString()
      })
      .eq('id', alertId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Delete alert
  static async deleteAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId);

    if (error) throw error;
  }
}