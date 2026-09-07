import axios from "axios";

/**
 * ENV you should have in your Bolt project:
 * - VITE_SUPABASE_URL             e.g. https://xrmwxqhhaeahabeppvuk.supabase.co
 * - VITE_NOTEHUB_PROJECT_UID      e.g. app:7c135a20-7d42-4a5e-a4a6-059bb04a72c0
 *
 * DO NOT include NOTEHUB client_id/secret in the browser.
 * Those live only in the Supabase Edge Function (notehub-proxy).
 */

// Use the Supabase URL to construct the functions URL
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('VITE_SUPABASE_URL is not configured');
}

if (!SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_ANON_KEY is not configured');
}

const PROXY_BASE = `${SUPABASE_URL}/functions/v1/notehub-proxy`;

// Ensure the project UID includes `app:` (required by Notehub)
const ensureAppPrefix = (uid?: string) =>
  uid?.startsWith("app:") ? uid : uid ? `app:${uid}` : "";

const NOTEHUB_PROJECT_UID = ensureAppPrefix(
  import.meta.env.VITE_NOTEHUB_PROJECT_UID
);

if (!NOTEHUB_PROJECT_UID || NOTEHUB_PROJECT_UID === "app:") {
  console.warn(
    "⚠️ VITE_NOTEHUB_PROJECT_UID is missing or invalid. Set it to something like 'app:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'."
  );
}

// Axios instance targeting the Supabase Edge Function proxy
const notehubApi = axios.create({
  baseURL: PROXY_BASE,
  timeout: 30000, // 30 second timeout
});

// Interceptor: add headers appropriately
notehubApi.interceptors.request.use((config) => {
  // Only set content-type when sending a body
  const hasBody = !!config.data;
  if (hasBody && !config.headers?.["Content-Type"]) {
    config.headers = { ...(config.headers || {}), "Content-Type": "application/json" };
  }

  // Add Supabase authorization header (required because verifyJWT is true on the edge function)
  if (SUPABASE_ANON_KEY) {
    config.headers = {
      ...(config.headers || {}),
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY
    };
  }

  return config;
});

/** =========================
 * Types
 * ========================*/
export interface NotehubDevice {
  uid: string;
  serial_number: string;
  product_uid: string;
  fleet_uids: string[];
  last_activity: string;
  contact: string;
  location?: {
    when: number;
    name: string;
    country: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  tower_location?: {
    when: number;
    name: string;
    country: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
  voltage?: number;
  temp?: number;
  bars?: number;
  moved?: number;
  orientation?: string;
  rssi?: number;
  sinr?: number;
  rat?: string;
  rssir?: number;
  rsrp?: number;
  rsrq?: number;
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
  body: Record<string, any>;
  where_olc?: string;
  where_lat?: number;
  where_lon?: number;
  where_location?: string;
  where_country?: string;
  where_timezone?: string;
  tower_when?: number;
  tower_lat?: number;
  tower_lon?: number;
}

export interface NotehubFirmware {
  version: string;
  description?: string;
  created: string;
  size: number;
  md5: string;
  type: string;
  built?: string;
}

export interface NotehubFleet {
  uid: string;
  label: string;
  created: string;
  device_count: number;
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

export interface WaterFlowData {
  deviceId: string;
  timestamp: string;
  flowRate: number;
  totalVolume: number;
  batteryLevel?: number;
  location?: {
    lat: number;
    lon: number;
    country?: string;
    timezone?: string;
  };
}

/** =========================
 * Service
 * ========================*/
export class NotehubService {
  static isConfigured(): boolean {
    return !!(NOTEHUB_PROJECT_UID && NOTEHUB_PROJECT_UID !== "app:");
  }

  // Devices (project)
  static async getAllDevicesFromNotehub(): Promise<NotehubDevice[]> {
    if (!this.isConfigured()) {
      throw new Error(`Notehub is not configured. VITE_NOTEHUB_PROJECT_UID is ${NOTEHUB_PROJECT_UID || 'missing'}`);
    }
    try {
      console.log('🔍 Fetching devices from Notehub via proxy...');
      console.log('📋 Using project UID:', NOTEHUB_PROJECT_UID);
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/devices`
      );
      console.log('✅ Successfully fetched devices:', r.data);
      return r.data.devices || [];
    } catch (err: any) {
      console.error('❌ Error fetching devices:', err.response?.data || err.message);
      console.error('❌ Request URL was:', `/v1/projects/${NOTEHUB_PROJECT_UID}/devices`);
      this._throwFriendly(err, "fetch devices");
    }
  }

  static async getDevice(deviceUID: string): Promise<NotehubDevice> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(
          deviceUID
        )}`
      );
      return r.data;
    } catch (err: any) {
      this._throwFriendly(err, `fetch device ${deviceUID}`);
    }
  }

  // Fleets
  static async getFleets(): Promise<NotehubFleet[]> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/fleets`
      );
      return r.data.fleets || [];
    } catch (err: any) {
      this._throwFriendly(err, "fetch fleets");
    }
  }

  static async getFleetDevices(fleetUID: string): Promise<NotehubDevice[]> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/fleets/${encodeURIComponent(
          fleetUID
        )}/devices`
      );
      return r.data.devices || [];
    } catch (err: any) {
      this._throwFriendly(err, `fetch devices for fleet ${fleetUID}`);
    }
  }

  static async createFleet(fleetName: string): Promise<NotehubFleet> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.post(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/fleets`,
        { label: fleetName }
      );
      return r.data;
    } catch (err: any) {
      this._throwFriendly(err, `create fleet "${fleetName}"`);
    }
  }

  // Device updates
  static async updateDevice(
    deviceUID: string,
    updates: DeviceUpdateRequest
  ): Promise<NotehubDevice> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const url = `/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(deviceUID)}`;
      console.log('🔄 NotehubService.updateDevice called:', { deviceUID, updates, url });

      const r = await notehubApi.put(url, updates);

      console.log('✅ NotehubService.updateDevice response:', r.data);
      return r.data;
    } catch (err: any) {
      console.error('❌ NotehubService.updateDevice error:', { deviceUID, updates, error: err.response?.data || err.message });
      this._throwFriendly(err, `update device ${deviceUID}`);
    }
  }

  // Add device to fleet(s)
  static async addDeviceToFleets(
    deviceUID: string,
    fleetUIDs: string[]
  ): Promise<void> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const url = `/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(deviceUID)}/fleets`;
      console.log('🔄 NotehubService.addDeviceToFleets called:', { deviceUID, fleetUIDs, url });

      const r = await notehubApi.put(url, { fleet_uids: fleetUIDs });

      console.log('✅ NotehubService.addDeviceToFleets response:', r.data);
    } catch (err: any) {
      console.error('❌ NotehubService.addDeviceToFleets error:', { deviceUID, fleetUIDs, error: err.response?.data || err.message });
      this._throwFriendly(err, `add device to fleets ${deviceUID}`);
    }
  }

  // Remove device from fleet(s)
  static async removeDeviceFromFleets(
    deviceUID: string,
    fleetUIDs: string[]
  ): Promise<void> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const url = `/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(deviceUID)}/fleets`;
      console.log('🔄 NotehubService.removeDeviceFromFleets called:', { deviceUID, fleetUIDs, url });

      const r = await notehubApi.delete(url, { data: { fleet_uids: fleetUIDs } });

      console.log('✅ NotehubService.removeDeviceFromFleets response:', r.data);
    } catch (err: any) {
      console.error('❌ NotehubService.removeDeviceFromFleets error:', { deviceUID, fleetUIDs, error: err.response?.data || err.message });
      this._throwFriendly(err, `remove device from fleets ${deviceUID}`);
    }
  }

  // Update device fleet assignments (legacy - kept for compatibility)
  static async updateDeviceFleets(
    deviceUID: string,
    fleetUIDs: string[]
  ): Promise<void> {
    return this.addDeviceToFleets(deviceUID, fleetUIDs);
  }

  // Events (project or device)
  static async getDeviceEvents(
    deviceUID: string,
    limit = 100
  ): Promise<NotehubEvent[]> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/events`,
        {
          params: { device: deviceUID, limit, sort_order: "desc" },
        }
      );
      return r.data.events || [];
    } catch (err: any) {
      this._throwFriendly(err, `fetch events for ${deviceUID}`);
    }
  }

  // Firmware
  static async getFirmwareVersions(): Promise<NotehubFirmware[]> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const r = await notehubApi.get(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/firmware`
      );
      return r.data.firmware || [];
    } catch (err: any) {
      this._throwFriendly(err, "fetch firmware versions");
    }
  }

  static async updateDeviceFirmware(
    deviceUID: string,
    firmwareVersion: string
  ): Promise<void> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      await notehubApi.post(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/devices/${encodeURIComponent(
          deviceUID
        )}/firmware`,
        { firmware_version: firmwareVersion }
      );
    } catch (err: any) {
      this._throwFriendly(err, `update firmware for ${deviceUID}`);
    }
  }

  static async updateMultipleDevicesFirmware(
    deviceUIDs: string[],
    firmwareVersion: string
  ): Promise<void> {
    await Promise.all(
      deviceUIDs.map((uid) =>
        this.updateDeviceFirmware(uid, firmwareVersion)
      )
    );
  }

  static async updateFleetFirmware(
    fleetUID: string,
    firmwareVersion: string
  ): Promise<void> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      await notehubApi.post(
        `/v1/projects/${NOTEHUB_PROJECT_UID}/fleets/${encodeURIComponent(
          fleetUID
        )}/firmware`,
        { firmware_version: firmwareVersion }
      );
    } catch (err: any) {
      this._throwFriendly(err, `update firmware for fleet ${fleetUID}`);
    }
  }

  static async getDeviceHealth(deviceUID: string): Promise<{
    isOnline: boolean;
    lastSeen: string;
    batteryLevel?: number;
  }> {
    if (!this.isConfigured()) throw new Error("Notehub is not configured");
    try {
      const device = await this.getDevice(deviceUID);
      const lastActivity = new Date(device.last_activity);
      const now = new Date();
      const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);

      return {
        isOnline: hoursSinceActivity < 24,
        lastSeen: device.last_activity,
        batteryLevel: device.voltage ? Math.min(100, Math.max(0, ((device.voltage - 3.0) / (4.2 - 3.0)) * 100)) : undefined
      };
    } catch (err: any) {
      this._throwFriendly(err, `fetch health for device ${deviceUID}`);
    }
  }

  /** Helpers **/

  private static _throwFriendly(err: any, action: string): never {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error(`❌ Failed to ${action}:`, { status, data, err });

    // 404 from Notehub is often "missing app: prefix" or wrong path
    if (status === 404) {
      if (err?.response?.data?.error === 'Notehub credentials not configured') {
        throw new Error(
          `Notehub credentials not configured in Supabase Edge Function. Please set NOTEHUB_CLIENT_ID and NOTEHUB_CLIENT_SECRET environment variables.`
        );
      }
      if (err?.config?.baseURL?.includes('notehub-proxy')) {
        throw new Error(
          `🚨 Supabase Edge Function "notehub-proxy" not found! Please check that the Edge Function is deployed in Supabase.`
        );
      }
      throw new Error(
        `Not found when trying to ${action}. Check that VITE_NOTEHUB_PROJECT_UID includes the 'app:' prefix and the path is correct.`
      );
    }
    if (status === 401 || status === 403) {
      throw new Error(
        `Unauthorized when trying to ${action}. Check that:\n1. NOTEHUB_CLIENT_ID and NOTEHUB_CLIENT_SECRET are properly configured in the Edge Function\n2. VITE_NOTEHUB_PROJECT_UID (${NOTEHUB_PROJECT_UID}) is correct and accessible by your credentials\n3. Your Notehub client has permissions for this project`
      );
    }
    if (status === 500 && data?.error === 'Notehub credentials not configured') {
      throw new Error(
        `Notehub credentials not configured. Please set NOTEHUB_CLIENT_ID and NOTEHUB_CLIENT_SECRET in Supabase Edge Function environment variables.`
      );
    }
    if (status >= 500) {
      throw new Error(`Notehub server error while trying to ${action}.`);
    }
    throw new Error(`Failed to ${action}: ${err?.message || "Unknown error"}`);
  }
}

/** Optional: webhook handler kept for local processing of inbound payloads.
 * Your actual ingest path is the Supabase Edge Function `notehub-webhooks`.
 */
export const handleNotehubWebhook = async (payload: any) => {
  try {
    // transform as needed for your UI
    return payload;
  } catch (e) {
    console.error("Webhook transform error:", e);
    throw e;
  }
};
