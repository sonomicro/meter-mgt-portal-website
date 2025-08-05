import axios from 'axios';

// Notehub.io API configuration
const NOTEHUB_BASE_URL = 'https://api.notefile.net';
const NOTEHUB_PROJECT_UID = import.meta.env.VITE_NOTEHUB_PROJECT_UID || import.meta.env.VITE_NOTEHUB_PROJECT_ID;
const NOTEHUB_AUTH_TOKEN = import.meta.env.VITE_NOTEHUB_AUTH_TOKEN;

// Check if Notehub is configured
const isNotehubConfigured = NOTEHUB_PROJECT_UID && NOTEHUB_AUTH_TOKEN;

if (!isNotehubConfigured) {
  console.warn('Notehub environment variables not configured. Some features will be disabled.');
}

// Create axios instance with default headers
const notehubApi = axios.create({
  baseURL: NOTEHUB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${NOTEHUB_AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

// Types for Notehub API responses
export interface NotehubDevice {
  uid: string;
  serial_number: string;
  product_uid: string;
  fleet_uids: string[];
  last_activity: string;
  contact: string;
  location: {
    when: number;
    name: string;
    country: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  tower_info: {
    when: number;
    lat: number;
    lon: number;
  };
  voltage: number;
  temp: number;
  bars: number;
  moved: number;
  orientation: string;
  rssi: number;
  sinr: number;
  rat: string;
  rssir: number;
  rsrp: number;
  rsrq: number;
}

export interface NotehubEvent {
  event: string;
  session: string;
  best_id: string;
  device: string;
  product: string;
  received: number;
  req: string;
  when: number;
  file: string;
  note: string;
  updates: number;
  body: {
    flow_rate?: number;
    total_volume?: number;
    temperature?: number;
    pressure?: number;
    battery_level?: number;
    [key: string]: any;
  };
  where_olc: string;
  where_lat: number;
  where_lon: number;
  where_location: string;
  where_country: string;
  where_timezone: string;
  tower_when: number;
  tower_lat: number;
  tower_lon: number;
}

export interface NotehubFirmware {
  version: string;
  description: string;
  created: string;
  size: number;
  md5: string;
  type: string;
  built: string;
}

export interface WaterFlowData {
  deviceId: string;
  timestamp: string;
  flowRate: number;
  totalVolume: number;
  temperature?: number;
  pressure?: number;
  batteryLevel?: number;
  location?: {
    lat: number;
    lon: number;
    country: string;
    timezone: string;
  };
}

export interface DeviceProvisionRequest {
  device_uid: string;
  product_uid?: string;
  fleet_uid?: string;
}

export interface DeviceUpdateRequest {
  fleet_uids?: string[];
  environment_variables?: { [key: string]: string };
}

export interface FirmwareUpdateRequest {
  firmware_version: string;
  device_uids?: string[];
  fleet_uid?: string;
}

// Notehub API service class
export class NotehubService {
  // Check if Notehub is configured
  static isConfigured(): boolean {
    return isNotehubConfigured;
  }

  // Get all devices in the project
  static async getDevices(): Promise<NotehubDevice[]> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices`);
      return response.data.devices || [];
    } catch (error) {
      console.error('Error fetching devices from Notehub:', error);
      throw error;
    }
  }

  // Get specific device information
  static async getDevice(deviceUID: string): Promise<NotehubDevice> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${deviceUID}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching device ${deviceUID} from Notehub:`, error);
      throw error;
    }
  }

  // Add new device to Notehub
  static async addDevice(request: DeviceProvisionRequest): Promise<NotehubDevice> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.post(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices`, {
        device_uid: request.device_uid,
        product_uid: request.product_uid,
        fleet_uid: request.fleet_uid
      });
      return response.data;
    } catch (error) {
      console.error(`Error adding device ${request.device_uid} to Notehub:`, error);
      throw error;
    }
  }

  // Remove device from Notehub
  static async removeDevice(deviceUID: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.delete(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${deviceUID}`);
    } catch (error) {
      console.error(`Error removing device ${deviceUID} from Notehub:`, error);
      throw error;
    }
  }

  // Update device in Notehub
  static async updateDevice(deviceUID: string, updates: DeviceUpdateRequest): Promise<NotehubDevice> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.put(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${deviceUID}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating device ${deviceUID} in Notehub:`, error);
      throw error;
    }
  }

  // Get events for a specific device (live data)
  static async getDeviceEvents(deviceUID: string, limit: number = 100): Promise<NotehubEvent[]> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/events`, {
        params: {
          device: deviceUID,
          limit,
          sort_order: 'desc'
        }
      });
      return response.data.events || [];
    } catch (error) {
      console.error(`Error fetching events for device ${deviceUID}:`, error);
      throw error;
    }
  }

  // Get latest water flow data for all devices
  static async getLatestWaterFlowData(): Promise<WaterFlowData[]> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/events`, {
        params: {
          file: 'sensors.qo', // Assuming water flow data comes from sensors.qo file
          limit: 1000,
          sort_order: 'desc'
        }
      });

      const events: NotehubEvent[] = response.data.events || [];
      
      // Group events by device and get the latest for each
      const deviceMap = new Map<string, NotehubEvent>();
      
      events.forEach(event => {
        if (!deviceMap.has(event.device) || event.when > deviceMap.get(event.device)!.when) {
          deviceMap.set(event.device, event);
        }
      });

      // Convert to WaterFlowData format
      return Array.from(deviceMap.values()).map(event => ({
        deviceId: event.device,
        timestamp: new Date(event.when * 1000).toISOString(),
        flowRate: event.body.flow_rate || 0,
        totalVolume: event.body.total_volume || 0,
        temperature: event.body.temperature,
        pressure: event.body.pressure,
        batteryLevel: event.body.battery_level,
        location: {
          lat: event.where_lat,
          lon: event.where_lon,
          country: event.where_country,
          timezone: event.where_timezone
        }
      }));
    } catch (error) {
      console.error('Error fetching water flow data from Notehub:', error);
      throw error;
    }
  }

  // Get available firmware versions
  static async getFirmwareVersions(): Promise<NotehubFirmware[]> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/firmware`);
      return response.data.firmware || [];
    } catch (error) {
      console.error('Error fetching firmware versions from Notehub:', error);
      throw error;
    }
  }

  // Initiate firmware update for specific device
  static async updateDeviceFirmware(deviceUID: string, firmwareVersion: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.post(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${deviceUID}/firmware`, {
        firmware_version: firmwareVersion
      });
    } catch (error) {
      console.error(`Error updating firmware for device ${deviceUID}:`, error);
      throw error;
    }
  }

  // Initiate firmware update for multiple devices
  static async updateMultipleDevicesFirmware(deviceUIDs: string[], firmwareVersion: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const updatePromises = deviceUIDs.map(deviceUID => 
        this.updateDeviceFirmware(deviceUID, firmwareVersion)
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error updating firmware for multiple devices:', error);
      throw error;
    }
  }

  // Initiate firmware update for entire fleet
  static async updateFleetFirmware(fleetUID: string, firmwareVersion: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.post(`/v1/projects/${NOTEHUB_PROJECT_UID}/fleets/${fleetUID}/firmware`, {
        firmware_version: firmwareVersion
      });
    } catch (error) {
      console.error(`Error updating firmware for fleet ${fleetUID}:`, error);
      throw error;
    }
  }

  // Register a new device with Notehub (legacy method - kept for compatibility)
  static async registerDevice(deviceUID: string, fleetUID?: string): Promise<void> {
    return this.addDevice({
      device_uid: deviceUID,
      fleet_uid: fleetUID
    }).then(() => {});
  }

  // Send a note to a device (for configuration or commands)
  static async sendNoteToDevice(deviceUID: string, noteFile: string, body: any): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.post(`/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${deviceUID}/notes`, {
        file: noteFile,
        body
      });
    } catch (error) {
      console.error(`Error sending note to device ${deviceUID}:`, error);
      throw error;
    }
  }

  // Get device health status
  static async getDeviceHealth(deviceUID: string): Promise<{
    isOnline: boolean;
    lastSeen: string;
    batteryLevel: number;
    signalStrength: number;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const device = await this.getDevice(deviceUID);
      const now = Date.now() / 1000;
      const lastActivity = new Date(device.last_activity).getTime() / 1000;
      const isOnline = (now - lastActivity) < 300; // Consider online if seen within 5 minutes

      return {
        isOnline,
        lastSeen: device.last_activity,
        batteryLevel: Math.round((device.voltage / 5.0) * 100), // Assuming 5V max
        signalStrength: device.bars
      };
    } catch (error) {
      console.error(`Error getting device health for ${deviceUID}:`, error);
      throw error;
    }
  }

  // Setup webhook for real-time data
  static async setupWebhook(webhookUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.post(`/v1/projects/${NOTEHUB_PROJECT_UID}/routes`, {
        label: 'Water Monitoring Webhook',
        type: 'http',
        transform: {
          // Optional: Transform data before sending to webhook
          // JSONata expression to modify the payload
        },
        http: {
          url: webhookUrl,
          http_headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your-webhook-secret' // Optional security
          }
        },
        filters: {
          files: ['sensors.qo', '_health.qo', '_track.qo', '_session.qo'],
          // Optional: Filter by specific devices
          // device_uids: ['dev:123456789'],
          // Optional: Only send when certain conditions are met
          // when: 'body.flow_rate > 0'
        }
      });
    } catch (error) {
      console.error('Error setting up webhook:', error);
      throw error;
    }
  }

  // Get webhook routes for the project
  static async getWebhookRoutes(): Promise<any[]> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      const response = await notehubApi.get(`/v1/projects/${NOTEHUB_PROJECT_UID}/routes`);
      return response.data.routes || [];
    } catch (error) {
      console.error('Error fetching webhook routes:', error);
      throw error;
    }
  }

  // Delete a webhook route
  static async deleteWebhookRoute(routeId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }
    
    try {
      await notehubApi.delete(`/v1/projects/${NOTEHUB_PROJECT_UID}/routes/${routeId}`);
    } catch (error) {
      console.error('Error deleting webhook route:', error);
      throw error;
    }
  }

  // Test webhook connectivity
  static async testWebhook(webhookUrl: string): Promise<boolean> {
    try {
      const testPayload = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Webhook connectivity test from Notehub service'
      };
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Webhook test failed:', error);
      return false;
    }
  }
  // Get live data stream for a device (WebSocket-like functionality)
  static async getLiveDeviceData(deviceUID: string, callback: (data: WaterFlowData) => void): Promise<() => void> {
    if (!this.isConfigured()) {
      throw new Error('Notehub is not configured');
    }

    let isActive = true;
    
    const pollForData = async () => {
      while (isActive) {
        try {
          const events = await this.getDeviceEvents(deviceUID, 1);
          if (events.length > 0) {
            const event = events[0];
            if (event.file === 'sensors.qo' && event.body) {
              const waterFlowData: WaterFlowData = {
                deviceId: event.device,
                timestamp: new Date(event.when * 1000).toISOString(),
                flowRate: event.body.flow_rate || 0,
                totalVolume: event.body.total_volume || 0,
                temperature: event.body.temperature,
                pressure: event.body.pressure,
                batteryLevel: event.body.battery_level,
                location: {
                  lat: event.where_lat,
                  lon: event.where_lon,
                  country: event.where_country,
                  timezone: event.where_timezone
                }
              };
              callback(waterFlowData);
            }
          }
          // Poll every 30 seconds
          await new Promise(resolve => setTimeout(resolve, 30000));
        } catch (error) {
          console.error('Error polling for live data:', error);
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      }
    };

    // Start polling
    pollForData();

    // Return cleanup function
    return () => {
      isActive = false;
    };
  }
}

// Webhook handler for real-time data updates
export const handleNotehubWebhook = async (webhookData: any) => {
  try {
    // Process incoming webhook data from Notehub
    const { event, device, body, when, where_lat, where_lon } = webhookData;
    
    if (event === 'sensors.qo' && body) {
      // This is water flow sensor data
      const waterFlowData: WaterFlowData = {
        deviceId: device,
        timestamp: new Date(when * 1000).toISOString(),
        flowRate: body.flow_rate || 0,
        totalVolume: body.total_volume || 0,
        temperature: body.temperature,
        pressure: body.pressure,
        batteryLevel: body.battery_level,
        location: where_lat && where_lon ? {
          lat: where_lat,
          lon: where_lon,
          country: webhookData.where_country,
          timezone: webhookData.where_timezone
        } : undefined
      };

      // Here you would typically save this data to your database
      // and potentially trigger real-time updates to connected clients
      console.log('Received water flow data:', waterFlowData);
      
      return waterFlowData;
    }
  } catch (error) {
    console.error('Error processing Notehub webhook:', error);
    throw error;
  }
};