import { supabase } from '../lib/supabase';

export interface DeviceDataUsage {
  device_id: string;
  bytes_received: number;
  event_count: number;
  period_start: string;
  period_end: string;
}

export interface WebhookUsage {
  webhook_name: string;
  invocation_count: number;
  bytes_processed: number;
  period_start: string;
  period_end: string;
}

export interface ProxyUsage {
  proxy_name: string;
  request_count: number;
  bytes_sent: number;
  bytes_received: number;
  period_start: string;
  period_end: string;
}

export interface DataUsageSummary {
  total_device_bytes: number;
  total_webhook_bytes: number;
  total_proxy_bytes: number;
  device_count: number;
  period_start: string;
  period_end: string;
}

export interface DeviceUsageStats {
  device_id: string;
  device_name?: string;
  total_bytes: number;
  total_events: number;
  last_activity: string;
}

export const getDeviceDataUsage = async (
  startDate: Date,
  endDate: Date,
  deviceId?: string
): Promise<DeviceDataUsage[]> => {
  let query = supabase
    .from('device_data_usage')
    .select('*')
    .gte('period_start', startDate.toISOString())
    .lte('period_end', endDate.toISOString())
    .order('period_start', { ascending: true });

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching device data usage:', error);
    throw error;
  }

  return data || [];
};

export const getWebhookUsage = async (
  startDate: Date,
  endDate: Date
): Promise<WebhookUsage[]> => {
  const { data, error } = await supabase
    .from('webhook_usage')
    .select('*')
    .gte('period_start', startDate.toISOString())
    .lte('period_end', endDate.toISOString())
    .order('period_start', { ascending: true });

  if (error) {
    console.error('Error fetching webhook usage:', error);
    throw error;
  }

  return data || [];
};

export const getProxyUsage = async (
  startDate: Date,
  endDate: Date
): Promise<ProxyUsage[]> => {
  const { data, error } = await supabase
    .from('proxy_usage')
    .select('*')
    .gte('period_start', startDate.toISOString())
    .lte('period_end', endDate.toISOString())
    .order('period_start', { ascending: true });

  if (error) {
    console.error('Error fetching proxy usage:', error);
    throw error;
  }

  return data || [];
};

export const getTotalDataUsage = async (
  startDate: Date,
  endDate: Date
): Promise<{ totalBytes: number; totalEvents: number }> => {
  const deviceUsage = await getDeviceDataUsage(startDate, endDate);

  const totalBytes = deviceUsage.reduce(
    (sum, usage) => sum + Number(usage.bytes_received),
    0
  );
  const totalEvents = deviceUsage.reduce(
    (sum, usage) => sum + usage.event_count,
    0
  );

  return { totalBytes, totalEvents };
};

export const getDeviceUsageStats = async (
  startDate: Date,
  endDate: Date
): Promise<DeviceUsageStats[]> => {
  try {
    const { data: deviceUsage, error } = await supabase
      .from('device_data_usage')
      .select('device_id, bytes_received, event_count, created_at')
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const statsMap = new Map<string, DeviceUsageStats>();

    (deviceUsage || []).forEach(usage => {
      const existing = statsMap.get(usage.device_id);
      if (existing) {
        existing.total_bytes += Number(usage.bytes_received);
        existing.total_events += usage.event_count;
        if (usage.created_at > existing.last_activity) {
          existing.last_activity = usage.created_at;
        }
      } else {
        statsMap.set(usage.device_id, {
          device_id: usage.device_id,
          device_name: usage.device_id,
          total_bytes: Number(usage.bytes_received),
          total_events: usage.event_count,
          last_activity: usage.created_at
        });
      }
    });

    return Array.from(statsMap.values());
  } catch (error) {
    console.error('Error fetching device usage stats:', error);
    return [];
  }
};

export const getDataUsageTrends = async (days: number = 30) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [deviceUsage, webhookUsage, proxyUsage] = await Promise.all([
    getDeviceDataUsage(startDate, endDate),
    getWebhookUsage(startDate, endDate),
    getProxyUsage(startDate, endDate)
  ]);

  const dailyMap = new Map<string, {
    date: string;
    deviceBytes: number;
    webhookBytes: number;
    proxyBytes: number;
    totalBytes: number;
  }>();

  deviceUsage.forEach(usage => {
    const date = new Date(usage.period_start).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || {
      date,
      deviceBytes: 0,
      webhookBytes: 0,
      proxyBytes: 0,
      totalBytes: 0
    };
    existing.deviceBytes += Number(usage.bytes_received);
    existing.totalBytes += Number(usage.bytes_received);
    dailyMap.set(date, existing);
  });

  webhookUsage.forEach(usage => {
    const date = new Date(usage.period_start).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || {
      date,
      deviceBytes: 0,
      webhookBytes: 0,
      proxyBytes: 0,
      totalBytes: 0
    };
    existing.webhookBytes += Number(usage.bytes_processed);
    existing.totalBytes += Number(usage.bytes_processed);
    dailyMap.set(date, existing);
  });

  proxyUsage.forEach(usage => {
    const date = new Date(usage.period_start).toISOString().split('T')[0];
    const existing = dailyMap.get(date) || {
      date,
      deviceBytes: 0,
      webhookBytes: 0,
      proxyBytes: 0,
      totalBytes: 0
    };
    const proxyTotal = Number(usage.bytes_sent) + Number(usage.bytes_received);
    existing.proxyBytes += proxyTotal;
    existing.totalBytes += proxyTotal;
    dailyMap.set(date, existing);
  });

  return Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
