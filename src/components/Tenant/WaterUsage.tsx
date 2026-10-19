import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, TrendingDown, BarChart3, FileText, Filter, Droplets, Activity, AlertTriangle, WifiOff, Clock, Zap, Thermometer, Gauge } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area } from 'recharts';
import { supabaseServiceRole } from '../../lib/supabase';
import { getCurrentUser } from '../../services/auth';
import type { Database } from '../../lib/supabase';
import { batteryLabel, batteryReading } from '../../lib/battery';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceData = Database['public']['Tables']['device_data']['Row'];
type FleetGroup = Database['public']['Tables']['fleet_groups']['Row'];

interface DailyUsage {
  date: string;
  usage: number;
  device: string;
}

// One env.qo note. The *_avg/min/max cover the period_s before `time` (all
// samples since the previous note); older firmware only sent the snapshot,
// which is then used as the average with no range.
interface EnvPoint {
  time: number;
  period_s: number | null;
  samples: number | null;
  temperature_avg: number | null;
  temperature_range: [number, number] | null;
  humidity_avg: number | null;
  humidity_range: [number, number] | null;
}

interface EnvRow {
  timestamp: string;
  temperature_c: number | null;
  humidity_rh: number | null;
  temperature_min_c: number | null;
  temperature_max_c: number | null;
  temperature_avg_c: number | null;
  humidity_min_rh: number | null;
  humidity_max_rh: number | null;
  humidity_avg_rh: number | null;
  samples: number | null;
  period_s: number | null;
}

const num = (v: number | null) => (v === null || v === undefined ? null : Number(v));

const toEnvPoint = (r: EnvRow): EnvPoint => {
  const range = (lo: number | null, hi: number | null): [number, number] | null =>
    lo === null || hi === null ? null : [Number(lo), Number(hi)];
  return {
    time: new Date(r.timestamp).getTime(),
    period_s: r.period_s,
    samples: r.samples,
    temperature_avg: num(r.temperature_avg_c) ?? num(r.temperature_c),
    temperature_range: range(r.temperature_min_c, r.temperature_max_c),
    humidity_avg: num(r.humidity_avg_rh) ?? num(r.humidity_rh),
    humidity_range: range(r.humidity_min_rh, r.humidity_max_rh)
  };
};

// High/low over the whole range and the mean weighted by samples per note
// (a note without a sample count weighs as one).
const envSummary = (points: EnvPoint[], key: 'temperature' | 'humidity') => {
  let high: number | null = null;
  let low: number | null = null;
  let sum = 0;
  let weight = 0;
  for (const p of points) {
    const avg = p[`${key}_avg`];
    const range = p[`${key}_range`];
    if (avg === null) continue;
    const lo = range ? range[0] : avg;
    const hi = range ? range[1] : avg;
    high = high === null || hi > high ? hi : high;
    low = low === null || lo < low ? lo : low;
    const w = p.samples && p.samples > 0 ? p.samples : 1;
    sum += avg * w;
    weight += w;
  }
  return { high, low, avg: weight > 0 ? sum / weight : null };
};

// One quality.qo note: means over the cycles since the previous note.
interface QualityPoint {
  time: number;
  cycles: number | null;
  score: number | null;
  error_pct: number | null;
  amp: number | null;
  lock: number | null;
  rep: number | null;
  plaus: number | null;
  missed: number | null;
  reason: number | null;
}

interface QualityRow {
  timestamp: string;
  interval_cycles: number | null;
  interval_mean_score: number | null;
  interval_error_pct: number | null;
  interval_sub_amp: number | null;
  interval_sub_lock: number | null;
  interval_sub_rep: number | null;
  interval_sub_plaus: number | null;
  interval_missed_blocks: number | null;
  reason_dominant: number | null;
}

const toQualityPoint = (r: QualityRow): QualityPoint => ({
  time: new Date(r.timestamp).getTime(),
  cycles: num(r.interval_cycles),
  score: num(r.interval_mean_score),
  error_pct: num(r.interval_error_pct),
  amp: num(r.interval_sub_amp),
  lock: num(r.interval_sub_lock),
  rep: num(r.interval_sub_rep),
  plaus: num(r.interval_sub_plaus),
  missed: num(r.interval_missed_blocks),
  reason: r.reason_dominant
});

const SUB_SCORES = [
  { key: 'amp', label: 'Signal strength', color: '#2563eb', hint: 'Echo amplitude. Falls with fouling, poor transducer coupling or air in the pipe.' },
  { key: 'lock', label: 'Signal lock', color: '#7c3aed', hint: 'Whether upstream and downstream echoes stay locked together. Falls with cycle slips.' },
  { key: 'rep', label: 'Stability', color: '#0891b2', hint: 'How repeatable consecutive readings are. Falls with noise or unstable coupling.' },
  { key: 'plaus', label: 'Plausibility', color: '#d97706', hint: 'Whether time-of-flight and flow are in the expected range. Falls with an empty pipe or wrong pipe data.' }
] as const;

// Reason codes of the meter's quality stream (sono_host_gui core/reason_codes.py).
const QUALITY_REASONS: Record<number, string> = {
  0x00: 'Healthy',
  0x01: 'Warming up',
  0x02: 'No signal',
  0x03: 'Signal processing error',
  0x04: 'Clock fault',
  0x05: 'Capture failed',
  0x06: 'Measurement overran its period',
  0x10: 'Signal clipped (gain too high)',
  0x11: 'Weak signal (check coupling)',
  0x12: 'Gain at maximum (check mounting)',
  0x13: 'Signal near noise floor',
  0x20: 'Signal lock slipped',
  0x21: 'Searching for signal',
  0x22: 'Channels drifting apart',
  0x30: 'Unstable readings',
  0x40: 'Time-of-flight out of range (check pipe data)',
  0x41: 'Implausible flow rate'
};

const qualityReasonLabel = (code: number | null) =>
  code === null ? '—' : QUALITY_REASONS[code] ?? `Code 0x${code.toString(16).padStart(2, '0')}`;

// Means weighted by cycles per note (a note without a count weighs as one);
// `worst` is the lowest per-report score in the range.
const qualitySummary = (points: QualityPoint[]) => {
  const keys = ['score', 'error_pct', 'amp', 'lock', 'rep', 'plaus'] as const;
  const sums = Object.fromEntries(keys.map(k => [k, { sum: 0, w: 0 }])) as Record<typeof keys[number], { sum: number; w: number }>;
  let worst: number | null = null;
  let missed = 0;
  for (const p of points) {
    const w = p.cycles && p.cycles > 0 ? p.cycles : 1;
    for (const k of keys) {
      const v = p[k];
      if (v === null) continue;
      sums[k].sum += v * w;
      sums[k].w += w;
    }
    if (p.score !== null) worst = worst === null || p.score < worst ? p.score : worst;
    missed += p.missed ?? 0;
  }
  const mean = (k: typeof keys[number]) => (sums[k].w > 0 ? sums[k].sum / sums[k].w : null);
  return {
    score: mean('score'),
    errorPct: mean('error_pct'),
    sub: { amp: mean('amp'), lock: mean('lock'), rep: mean('rep'), plaus: mean('plaus') },
    worst,
    missed,
    reason: points.length > 0 ? points[points.length - 1].reason : null
  };
};

interface DeviceUsagePercent {
  id: string;
  name: string;
  usage: number;
  percentage: number;
}

interface HourlyPattern {
  hour: number;
  day: string;
  usage: number;
}

interface LeakAlert {
  deviceId: string;
  deviceName: string;
  duration: number;
  avgFlowRate: number;
  lastSeen: string;
}

interface NoFlowAlert {
  deviceId: string;
  deviceName: string;
  duration: number;
  avgFlowRate: number;
  lastSeen: string;
}

interface LeakDetectionSetting {
  id: string;
  tenant_id: string;
  device_id: string | null;
  enabled: boolean;
  flow_duration_threshold: number;
  min_flow_rate_threshold: number;
  no_flow_enabled: boolean;
  no_flow_duration_threshold: number;
  max_flow_rate_threshold: number;
}

interface VolumeNote {
  device_id: string;
  timestamp: string;
  total_volume: number | null;
  period_s: number | null;
}

// Seconds a data.qo volume covers: period_s from firmware 2.7+, otherwise the
// gap to the device's previous note (hourly by default; long gaps are outages
// whose volume was never sent, so they are not spread over).
function noteSpans(notes: VolumeNote[]): Map<VolumeNote, number> {
  const spans = new Map<VolumeNote, number>();
  const lastByDevice = new Map<string, number>();
  [...notes]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .forEach(n => {
      const t = new Date(n.timestamp).getTime();
      const prev = lastByDevice.get(n.device_id);
      const gap = prev !== undefined ? (t - prev) / 1000 : 0;
      spans.set(n, n.period_s ?? (gap > 0 && gap <= 7200 ? gap : 3600));
      lastByDevice.set(n.device_id, t);
    });
  return spans;
}

// quality.qo mean score per report, 0..100 (the meter's own scale)
function qualityColor(score: number): string {
  return score >= 70 ? 'text-green-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
}

export default function WaterUsage() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [fleetGroups, setFleetGroups] = useState<FleetGroup[]>([]);
  const [usageData, setUsageData] = useState<DailyUsage[]>([]);
  const [rawDeviceData, setRawDeviceData] = useState<DeviceData[]>([]);
  const [deviceUsageBreakdown, setDeviceUsageBreakdown] = useState<DeviceUsagePercent[]>([]);
  const [hourlyPatterns, setHourlyPatterns] = useState<HourlyPattern[]>([]);
  const [envData, setEnvData] = useState<EnvPoint[]>([]);
  const [qualityData, setQualityData] = useState<QualityPoint[]>([]);
  const [leakAlerts, setLeakAlerts] = useState<LeakAlert[]>([]);
  const [noFlowAlerts, setNoFlowAlerts] = useState<NoFlowAlert[]>([]);
  const [leakDetectionSettings, setLeakDetectionSettings] = useState<LeakDetectionSetting[]>([]);
  const [kpiData, setKpiData] = useState({
    peakUsage: 0,
    peakDate: '',
    percentChange: 0,
    offlineDevices: 0
  });

  useEffect(() => {
    loadData();
  }, [selectedPeriod, selectedDevice]);

  const loadData = async () => {
    try {
      setLoading(true);

      const user = await getCurrentUser();
      if (!user || user.role !== 'tenant') {
        console.log('No tenant user found');
        return;
      }

      if (!supabaseServiceRole) {
        console.error('Service role client not available');
        return;
      }

      // Load devices with computed status
      const { data: userDevices, error: devicesError } = await supabaseServiceRole
        .rpc('get_devices_with_status', { filter_tenant_id: user.id });

      if (devicesError) {
        console.error('Error fetching devices:', devicesError);
        return;
      }

      setDevices(userDevices || []);

      // Load fleet groups
      const { data: groups } = await supabaseServiceRole
        .from('fleet_groups')
        .select('*')
        .eq('tenant_id', user.id);

      setFleetGroups(groups || []);

      // Load leak detection settings
      const { data: leakSettings } = await supabaseServiceRole
        .from('leak_detection_settings')
        .select('*')
        .eq('tenant_id', user.id);

      setLeakDetectionSettings(leakSettings || []);

      if (!userDevices || userDevices.length === 0) {
        setUsageData([]);
        setDeviceUsageBreakdown([]);
        setLoading(false);
        return;
      }

      // Calculate date range based on selected period
      const endDate = new Date();
      const startDate = new Date();

      switch (selectedPeriod) {
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case 'quarter':
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Build query for device data
      let query = supabaseServiceRole
        .from('device_data')
        .select('device_id, timestamp, flow_rate, total_volume, period_s, battery_level')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: true });

      // Filter by device if selected
      if (selectedDevice !== 'all') {
        query = query.eq('device_id', selectedDevice);
      } else {
        // Filter by all tenant devices
        query = query.in('device_id', userDevices.map(d => d.id));
      }

      const { data: deviceDataRecords, error: dataError } = await query;

      if (dataError) {
        console.error('Error fetching device data:', dataError);
        return;
      }

      // Store raw device data for export
      setRawDeviceData(deviceDataRecords || []);

      // Process data into daily usage. Each record's total_volume is the volume
      // of that note's period (the meter subtracts what it pushed), so usage
      // over a day or a range is the SUM of the records, not the largest one.
      const dailyMap = new Map<string, { usage: number; device: string }>();

      (deviceDataRecords || []).forEach((record: any) => {
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        const device = userDevices.find(d => d.id === record.device_id);
        const deviceName = device ? device.alias || device.name : 'Unknown Device';

        const existing = dailyMap.get(date);
        const volume = Number(record.total_volume) || 0;

        if (existing) {
          existing.usage += volume;
        } else {
          dailyMap.set(date, { usage: volume, device: deviceName });
        }
      });

      const dailyUsage: DailyUsage[] = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        usage: data.usage,
        device: data.device
      })).sort((a, b) => a.date.localeCompare(b.date));

      setUsageData(dailyUsage);

      // Calculate device usage breakdown
      const deviceUsageMap = new Map<string, number>();
      userDevices.forEach(device => {
        const deviceRecords = (deviceDataRecords || []).filter((r: any) => r.device_id === device.id);
        const volume = deviceRecords.reduce((sum, r) => sum + (Number(r.total_volume) || 0), 0);
        deviceUsageMap.set(device.id, volume);
      });

      const totalUsage = Array.from(deviceUsageMap.values()).reduce((sum, val) => sum + val, 0);
      const breakdown: DeviceUsagePercent[] = userDevices.map(device => ({
        id: device.id,
        name: device.alias || device.name,
        usage: deviceUsageMap.get(device.id) || 0,
        percentage: totalUsage > 0 ? ((deviceUsageMap.get(device.id) || 0) / totalUsage) * 100 : 0
      })).filter(d => d.usage > 0);

      setDeviceUsageBreakdown(breakdown);

      // Ambient temperature/humidity history (env.qo). Only meaningful per
      // device, so with "all devices" it is shown for a single device only.
      const envDeviceIds = selectedDevice !== 'all'
        ? [selectedDevice]
        : (userDevices.length === 1 ? [userDevices[0].id] : []);
      if (envDeviceIds.length === 1) {
        const { data: envRows } = await supabaseServiceRole
          .from('device_env_data')
          .select('timestamp, temperature_c, humidity_rh, temperature_min_c, temperature_max_c, temperature_avg_c, humidity_min_rh, humidity_max_rh, humidity_avg_rh, samples, period_s')
          .eq('device_id', envDeviceIds[0])
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: true });
        setEnvData(((envRows || []) as EnvRow[]).map(toEnvPoint));

        const { data: qualityRows } = await supabaseServiceRole
          .from('device_quality_data')
          .select('timestamp, interval_cycles, interval_mean_score, interval_error_pct, interval_sub_amp, interval_sub_lock, interval_sub_rep, interval_sub_plaus, interval_missed_blocks, reason_dominant')
          .eq('device_id', envDeviceIds[0])
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: true });
        setQualityData(((qualityRows || []) as QualityRow[]).map(toQualityPoint).filter(p => p.score !== null));
      } else {
        setEnvData([]);
        setQualityData([]);
      }

      // Calculate hourly patterns for heatmap (last 7 days only)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: hourlyData } = await supabaseServiceRole
        .from('device_data')
        .select('device_id, timestamp, total_volume, period_s')
        .gte('timestamp', weekAgo.toISOString())
        .in('device_id', userDevices.map(d => d.id));

      const hourlyMap = new Map<string, number>();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      // The flow rate in a note is one instantaneous sample, so the pattern and
      // the leak checks use the volumes, placed at the middle of the span each
      // one covers.
      const notes = (hourlyData || []) as VolumeNote[];
      const spans = noteSpans(notes);
      notes.forEach(n => {
        const span = spans.get(n) ?? 3600;
        const date = new Date(new Date(n.timestamp).getTime() - (span * 1000) / 2);
        const key = `${days[date.getDay()]}-${date.getHours()}`;
        hourlyMap.set(key, (hourlyMap.get(key) || 0) + (Number(n.total_volume) || 0));
      });

      const patterns: HourlyPattern[] = [];
      days.forEach(day => {
        for (let hour = 0; hour < 24; hour++) {
          const key = `${day}-${hour}`;
          patterns.push({
            day,
            hour,
            usage: hourlyMap.get(key) || 0
          });
        }
      });
      setHourlyPatterns(patterns);

      // Calculate KPI data
      const peakDay = dailyUsage.reduce((max, day) => day.usage > max.usage ? day : max, dailyUsage[0] || { usage: 0, date: '' });

      // Calculate percent change (compare first half vs second half of period)
      const midPoint = Math.floor(dailyUsage.length / 2);
      const firstHalf = dailyUsage.slice(0, midPoint);
      const secondHalf = dailyUsage.slice(midPoint);
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.usage, 0) / (firstHalf.length || 1);
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.usage, 0) / (secondHalf.length || 1);
      const percentChange = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

      // Count offline devices based on status
      const offlineCount = userDevices.filter(device => device.status === 'offline' || device.status === 'maintenance').length;

      setKpiData({
        peakUsage: peakDay?.usage || 0,
        peakDate: peakDay?.date || '',
        percentChange,
        offlineDevices: offlineCount
      });

      // Detect potential leaks (continuous flow for extended periods) - only if enabled
      const leaks: LeakAlert[] = [];
      // Detect stoppages (flow at/below a floor for extended periods) - only if enabled
      const noFlows: NoFlowAlert[] = [];

      // Get global setting (device_id is null) or use default
      const globalSetting = (leakSettings || []).find(s => s.device_id === null);
      const defaultThreshold = globalSetting?.flow_duration_threshold || 6;
      const defaultMinFlowRate = globalSetting?.min_flow_rate_threshold || 1.0;
      const globalEnabled = globalSetting?.enabled !== false;
      const defaultNoFlowThreshold = globalSetting?.no_flow_duration_threshold || 1;
      const defaultMaxFlowRate = globalSetting?.max_flow_rate_threshold ?? 0.1;
      const globalNoFlowEnabled = globalSetting?.no_flow_enabled !== false;

      for (const device of userDevices) {
        if (device.status === 'parked') continue;

        // Check device-specific settings, fall back to global
        const deviceSetting = (leakSettings || []).find(s => s.device_id === device.id);
        const isEnabled = deviceSetting ? deviceSetting.enabled : globalEnabled;
        const isNoFlowEnabled = deviceSetting ? deviceSetting.no_flow_enabled : globalNoFlowEnabled;

        // Skip if neither check applies to this device
        if (!isEnabled && !isNoFlowEnabled) continue;

        const threshold = deviceSetting?.flow_duration_threshold || defaultThreshold;
        const minFlowRate = deviceSetting?.min_flow_rate_threshold || defaultMinFlowRate;
        const noFlowThreshold = deviceSetting?.no_flow_duration_threshold || defaultNoFlowThreshold;
        const maxFlowRate = deviceSetting?.max_flow_rate_threshold ?? defaultMaxFlowRate;

        const deviceRecords = notes
          .filter(r => r.device_id === device.id)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        let continuousFlowCount = 0;
        let totalFlow = 0;
        let noFlowCount = 0;
        let totalNoFlow = 0;
        let leakFound = false;
        let noFlowFound = false;

        for (const record of deviceRecords) {
          const flow = ((Number(record.total_volume) || 0) / (spans.get(record) ?? 3600)) * 60;

          if (isEnabled && !leakFound) {
            if (flow >= minFlowRate) {
              continuousFlowCount++;
              totalFlow += flow;
            } else {
              continuousFlowCount = 0;
              totalFlow = 0;
            }

            // Alert if continuous flow exceeds threshold
            if (continuousFlowCount >= threshold) {
              leaks.push({
                deviceId: device.id,
                deviceName: device.alias || device.name,
                duration: continuousFlowCount,
                avgFlowRate: totalFlow / continuousFlowCount,
                lastSeen: device.last_seen || ''
              });
              leakFound = true;
            }
          }

          if (isNoFlowEnabled && !noFlowFound) {
            if (flow <= maxFlowRate) {
              noFlowCount++;
              totalNoFlow += flow;
            } else {
              noFlowCount = 0;
              totalNoFlow = 0;
            }

            // Alert if flow stays at/below the floor for too long
            if (noFlowCount >= noFlowThreshold) {
              noFlows.push({
                deviceId: device.id,
                deviceName: device.alias || device.name,
                duration: noFlowCount,
                avgFlowRate: totalNoFlow / noFlowCount,
                lastSeen: device.last_seen || ''
              });
              noFlowFound = true;
            }
          }

          if (leakFound && noFlowFound) break;
        }
      }
      setLeakAlerts(leaks);
      setNoFlowAlerts(noFlows);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = selectedDevice === 'all'
    ? usageData
    : usageData.filter(d => {
        const device = devices.find(dev => dev.id === selectedDevice);
        return device !== undefined && d.device === (device.alias || device.name);
      });

  const totalUsage = filteredData.reduce((sum, day) => sum + day.usage, 0);
  const inServiceCount = devices.filter(d => d.status !== 'parked').length;
  const avgDaily = filteredData.length > 0 ? totalUsage / filteredData.length : 0;
  const trend = filteredData.length >= 2
    ? filteredData[filteredData.length - 1]?.usage > filteredData[0]?.usage
    : false;

  const handleExport = (format: string) => {
    let content = '';
    let filename = '';

    // Filter raw data by selected device
    const exportData = selectedDevice === 'all'
      ? rawDeviceData
      : rawDeviceData.filter(d => d.device_id === selectedDevice);

    // Map device IDs to names for export
    const dataWithNames = exportData.map(record => {
      const device = devices.find(d => d.id === record.device_id);
      const fleetGroup = device?.fleet_group_id
        ? fleetGroups.find(g => g.id === device.fleet_group_id)
        : null;
      return {
        timestamp: record.timestamp,
        device_name: device?.name || 'Unknown',
        device_alias: device?.alias || '',
        fleet_group: fleetGroup?.name || '',
        device_id: record.device_id,
        flow_rate: record.flow_rate,
        total_volume: record.total_volume,
        period_s: record.period_s,
        battery_level: record.battery_level
      };
    });

    if (format === 'csv') {
      content = 'Timestamp,Device Name,Alias,Fleet Group,Device ID,Flow Rate (L/min),Volume in Period (L),Period (s),Battery Level (%)\n' +
                dataWithNames.map(d =>
                  `${d.timestamp},${d.device_name},${d.device_alias},${d.fleet_group},${d.device_id},${d.flow_rate || 0},${d.total_volume || 0},${d.period_s ?? ''},${d.battery_level ?? ''}`
                ).join('\n');
      filename = `water-usage-full-resolution-${new Date().toISOString().split('T')[0]}.csv`;
    } else if (format === 'json') {
      content = JSON.stringify(dataWithNames, null, 2);
      filename = `water-usage-full-resolution-${new Date().toISOString().split('T')[0]}.json`;
    } else {
      const selected = devices.find(d => d.id === selectedDevice);
      const deviceName = selected ? selected.alias || selected.name : 'All Devices';
      content = `WATER USAGE REPORT - FULL RESOLUTION DATA\n\n` +
                `Generated: ${new Date().toLocaleString()}\n` +
                `Period: ${selectedPeriod}\n` +
                `Device: ${deviceName}\n` +
                `Total Records: ${dataWithNames.length}\n\n` +
                `Total Usage: ${totalUsage.toFixed(1)}L\n` +
                `Daily Average: ${avgDaily.toFixed(1)}L\n\n` +
                `DETAILED DATA (Full Resolution):\n` +
                `${'='.repeat(80)}\n\n` +
                dataWithNames.map(d =>
                  `${d.timestamp}\n` +
                  `  Device: ${d.device_name}\n` +
                  (d.device_alias ? `  Alias: ${d.device_alias}\n` : '') +
                  (d.fleet_group ? `  Fleet Group: ${d.fleet_group}\n` : '') +
                  `  Flow Rate: ${(d.flow_rate || 0).toFixed(2)} L/min\n` +
                  `  Volume in Period: ${(d.total_volume || 0).toFixed(2)} L\n` +
                  `  Battery: ${d.battery_level != null ? d.battery_level + '%' : 'N/A'}\n`
                ).join('\n');
      filename = `water-usage-report-${new Date().toISOString().split('T')[0]}.txt`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const generateReport = () => {
    const selected = devices.find(d => d.id === selectedDevice);
    const deviceName = selected ? selected.alias || selected.name : 'All Devices';

    // Filter raw data by selected device
    const exportData = selectedDevice === 'all'
      ? rawDeviceData
      : rawDeviceData.filter(d => d.device_id === selectedDevice);

    // Map device IDs to names for report
    const dataWithNames = exportData.map(record => {
      const device = devices.find(d => d.id === record.device_id);
      const fleetGroup = device?.fleet_group_id
        ? fleetGroups.find(g => g.id === device.fleet_group_id)
        : null;
      return {
        timestamp: record.timestamp,
        device_name: device?.name || 'Unknown',
        device_alias: device?.alias || '',
        fleet_group: fleetGroup?.name || '',
        flow_rate: record.flow_rate,
        total_volume: record.total_volume,
        battery_level: record.battery_level
      };
    });

    const reportData = {
      period: selectedPeriod,
      device: deviceName,
      summary: {
        totalUsage,
        avgDaily,
        trend: trend ? 'increasing' : 'decreasing',
        totalRecords: dataWithNames.length
      },
      data: filteredData
    };

    const content = `WATER USAGE ANALYSIS REPORT\n\n` +
                   `Generated: ${new Date().toLocaleString()}\n` +
                   `Period: ${selectedPeriod}\n` +
                   `Device: ${reportData.device}\n` +
                   `Total Data Points: ${reportData.summary.totalRecords}\n\n` +
                   `SUMMARY\n` +
                   `${'='.repeat(80)}\n` +
                   `Total Usage: ${totalUsage.toFixed(1)}L\n` +
                   `Daily Average: ${avgDaily.toFixed(1)}L\n` +
                   `Trend: ${reportData.summary.trend}\n` +
                   `Peak Usage: ${kpiData.peakUsage.toFixed(1)}L on ${kpiData.peakDate}\n\n` +
                   `DAILY SUMMARY\n` +
                   `${'='.repeat(80)}\n` +
                   filteredData.map(d => `${d.date}: ${d.usage.toFixed(1)}L`).join('\n') +
                   `\n\n` +
                   `FULL RESOLUTION DATA (First 100 records)\n` +
                   `${'='.repeat(80)}\n\n` +
                   dataWithNames.slice(0, 100).map(d =>
                     `${d.timestamp} | ${d.device_name}\n` +
                     `  Flow: ${(d.flow_rate || 0).toFixed(2)} L/min | ` +
                     `Volume: ${(d.total_volume || 0).toFixed(2)} L | ` +
                     `Battery: ${d.battery_level != null ? d.battery_level + '%' : 'N/A'}\n`
                   ).join('\n') +
                   (dataWithNames.length > 100 ? `\n\n... and ${dataWithNames.length - 100} more records. Use Export function for complete data.\n` : '');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-usage-analysis-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Water Usage</h2>
          <p className="text-gray-600">Monitor and analyze your water consumption</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading usage data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Water Usage</h2>
          <p className="text-gray-600">Monitor and analyze your water consumption</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Devices</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>{device.alias || device.name}</option>
            ))}
          </select>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 3 Months</option>
            <option value="year">Last Year</option>
          </select>
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button
            onClick={generateReport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">No devices assigned to your account yet.</p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800">No usage data available for the selected period.</p>
        </div>
      ) : (
        <>
          {/* Enhanced KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Usage</span>
                <Droplets className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{totalUsage.toFixed(1)}L</p>
              <div className="flex items-center mt-2 text-sm">
                {kpiData.percentChange !== 0 && (
                  <>
                    {kpiData.percentChange > 0 ? (
                      <TrendingUp className="h-4 w-4 text-red-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-green-500 mr-1" />
                    )}
                    <span className={kpiData.percentChange > 0 ? 'text-red-600' : 'text-green-600'}>
                      {Math.abs(kpiData.percentChange).toFixed(1)}%
                    </span>
                    <span className="text-gray-500 ml-1">vs previous period</span>
                  </>
                )}
                {kpiData.percentChange === 0 && (
                  <span className="text-gray-500">No change</span>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Daily Average</span>
                <Activity className="h-5 w-5 text-teal-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{avgDaily.toFixed(1)}L</p>
              <p className="text-sm text-gray-500 mt-2">Per day average</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Peak Usage</span>
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{kpiData.peakUsage.toFixed(1)}L</p>
              <p className="text-sm text-gray-500 mt-2">
                {kpiData.peakDate ? new Date(kpiData.peakDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Device Status</span>
                <WifiOff className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{inServiceCount - kpiData.offlineDevices}/{inServiceCount}</p>
              <p className="text-sm text-gray-500 mt-2">
                {kpiData.offlineDevices > 0 ? `${kpiData.offlineDevices} offline` : 'All online'}
              </p>
            </div>
          </div>

          {/* Leak Detection Alerts */}
          {leakAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <h3 className="text-lg font-semibold text-red-900">Potential Leak Detected</h3>
              </div>
              <div className="space-y-3">
                {leakAlerts.map(alert => (
                  <div key={alert.deviceId} className="bg-white rounded-lg p-4 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{alert.deviceName}</p>
                        <p className="text-sm text-gray-600">
                          Continuous flow detected for {alert.duration}+ hours
                        </p>
                        <p className="text-sm text-gray-500">
                          Average flow rate: {alert.avgFlowRate.toFixed(2)} L/min
                        </p>
                      </div>
                      <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                        Investigate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Flow Alerts */}
          {noFlowAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                <h3 className="text-lg font-semibold text-amber-900">No Flow Detected</h3>
              </div>
              <div className="space-y-3">
                {noFlowAlerts.map(alert => (
                  <div key={alert.deviceId} className="bg-white rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{alert.deviceName}</p>
                        <p className="text-sm text-gray-600">
                          Flow at or below the minimum for {alert.duration}+ hours
                        </p>
                        <p className="text-sm text-gray-500">
                          Average flow rate: {alert.avgFlowRate.toFixed(2)} L/min
                        </p>
                      </div>
                      <button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors">
                        Investigate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device Health Overview */}
          {devices.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Health Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map(device => {
                  const isOnline = device.status === 'online';
                  const isParked = device.status === 'parked';
                  const batteryLevel = batteryReading(device);
                  const lastSeenText = device.last_seen
                    ? new Date(device.last_seen).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Never';

                  return (
                    <div key={device.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{device.alias || device.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isOnline ? 'Online' : isParked ? 'Parked' : 'Offline'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Battery</span>
                          <span className={`font-medium ${
                            batteryLevel === null ? 'text-gray-500' : batteryLevel > 50 ? 'text-green-600' : batteryLevel > 20 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {batteryLabel(device)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Last Seen</span>
                          <span className="text-gray-900">{lastSeenText}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600" title="Volume of the last report divided by the time it covers">Avg Flow (last report)</span>
                          <span className="text-gray-900">
                            {device.avg_flow_rate != null ? `${Number(device.avg_flow_rate).toFixed(1)} L/min` : '—'}
                          </span>
                        </div>
                        {device.ambient_temperature_c != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Temperature / Humidity</span>
                            <span className="text-gray-900">
                              {Number(device.ambient_temperature_c).toFixed(1)} °C / {Number(device.ambient_humidity_rh ?? 0).toFixed(0)} %RH
                            </span>
                          </div>
                        )}
                        {device.quality_score != null && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Measurement Quality</span>
                            <span className={`font-medium ${qualityColor(Number(device.quality_score))}`}
                                  title={device.quality_error_pct != null ? `${Number(device.quality_error_pct).toFixed(1)}% error cycles in the last report` : undefined}>
                              {Number(device.quality_score).toFixed(0)}/100
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ambient temperature / humidity */}
          {envData.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-gray-900">Temperature & Humidity</h3>
                <Thermometer className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Line: average between cloud syncs. Band: lowest to highest reading in the same period (sampled every 10 s).
              </p>
              {([
                { key: 'temperature', label: 'Temperature', unit: '°C', color: '#dc2626', digits: 1 },
                { key: 'humidity', label: 'Humidity', unit: '%RH', color: '#2563eb', digits: 0 }
              ] as const).map(({ key, label, unit, color, digits }) => {
                const summary = envSummary(envData, key);
                const fmt = (v: number | null) => (v === null ? '—' : `${v.toFixed(digits)} ${unit}`);
                return (
                  <div key={key} className="mb-6 last:mb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                      <h4 className="text-sm font-medium text-gray-900">{label}</h4>
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-600">High <strong className="text-gray-900">{fmt(summary.high)}</strong></span>
                        <span className="text-gray-600">Low <strong className="text-gray-900">{fmt(summary.low)}</strong></span>
                        <span className="text-gray-600">Average <strong className="text-gray-900">{fmt(summary.avg)}</strong></span>
                      </div>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={envData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="time"
                            type="number"
                            scale="time"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          />
                          <YAxis unit={` ${unit}`} domain={key === 'humidity' ? [0, 100] : ['auto', 'auto']} />
                          <Tooltip
                            labelFormatter={(t, payload) => {
                              const end = new Date(t as number);
                              const p = payload?.[0]?.payload as EnvPoint | undefined;
                              const fmtTime = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                              return p?.period_s
                                ? `${fmtTime(new Date(end.getTime() - p.period_s * 1000))} – ${fmtTime(end)}${p.samples ? ` (${p.samples} readings)` : ''}`
                                : fmtTime(end);
                            }}
                            formatter={(value: number | [number, number], name: string) => [
                              Array.isArray(value)
                                ? `${value[0].toFixed(digits)} – ${value[1].toFixed(digits)} ${unit}`
                                : `${value.toFixed(digits)} ${unit}`,
                              name
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey={`${key}_range`}
                            name="Low – high"
                            stroke="none"
                            fill={color}
                            fillOpacity={0.15}
                            connectNulls
                            isAnimationActive={false}
                          />
                          <Line
                            type="monotone"
                            dataKey={`${key}_avg`}
                            name="Average"
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Measurement health (quality.qo) */}
          {qualityData.length > 0 && (() => {
            const summary = qualitySummary(qualityData);
            const pct = (v: number | null, digits = 0) => (v === null ? '—' : v.toFixed(digits));
            const fmtTime = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const timeAxis = (
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
            );
            return (
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-semibold text-gray-900">Measurement Health</h3>
                  <Gauge className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  The meter scores every measurement 0–100. Each point is the average between cloud syncs; the four lines show which part of the signal drives the overall score.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500">Average score</p>
                    <p className={`text-xl font-semibold ${summary.score === null ? 'text-gray-900' : qualityColor(summary.score)}`}>{pct(summary.score)}<span className="text-sm text-gray-500">/100</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Worst report</p>
                    <p className={`text-xl font-semibold ${summary.worst === null ? 'text-gray-900' : qualityColor(summary.worst)}`}>{pct(summary.worst)}<span className="text-sm text-gray-500">/100</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Failed measurements</p>
                    <p className="text-xl font-semibold text-gray-900">{pct(summary.errorPct, 1)}<span className="text-sm text-gray-500">%</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Most frequent condition</p>
                    <p className="text-sm font-medium text-gray-900 mt-1" title="Since the meter last started">{qualityReasonLabel(summary.reason)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-sm">
                  {SUB_SCORES.map(s => (
                    <span key={s.key} className="text-gray-600" title={s.hint}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: s.color }} />
                      {s.label} <strong className="text-gray-900">{pct(summary.sub[s.key])}</strong>
                    </span>
                  ))}
                  {summary.missed > 0 && (
                    <span className="text-amber-700" title="Quality reports the meter did not process">{summary.missed} missed reports</span>
                  )}
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={qualityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      {timeAxis}
                      <YAxis domain={[0, 100]} />
                      <Tooltip
                        labelFormatter={(t, payload) => {
                          const p = payload?.[0]?.payload as QualityPoint | undefined;
                          return `${fmtTime(new Date(t as number))}${p?.cycles ? ` (${p.cycles} measurements)` : ''}`;
                        }}
                        formatter={(value: number, name: string) => [value.toFixed(0), name]}
                      />
                      <Line type="monotone" dataKey="score" name="Overall score" stroke="#111827" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
                      {SUB_SCORES.map(s => (
                        <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                      ))}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <h4 className="text-sm font-medium text-gray-900 mt-4 mb-2">Failed measurements</h4>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={qualityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      {timeAxis}
                      <YAxis unit="%" domain={[0, (max: number) => Math.max(5, Math.ceil(max))]} />
                      <Tooltip
                        labelFormatter={(t) => fmtTime(new Date(t as number))}
                        formatter={(value: number) => [`${value.toFixed(2)} %`, 'Failed']}
                      />
                      <Area type="monotone" dataKey="error_pct" name="Failed" stroke="#dc2626" fill="#dc2626" fillOpacity={0.15} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* Hourly Usage Heatmap */}
          {hourlyPatterns.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Usage Patterns (Last 7 Days)</h3>
                <Clock className="h-5 w-5 text-gray-400" />
              </div>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  <div className="flex mb-2">
                    <div className="w-12"></div>
                    {Array.from({ length: 24 }, (_, i) => (
                      <div key={i} className="w-8 text-center text-xs text-gray-500">
                        {i % 3 === 0 ? i : ''}
                      </div>
                    ))}
                  </div>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
                    const dayPatterns = hourlyPatterns.filter(p => p.day === day);
                    const maxUsage = Math.max(...hourlyPatterns.map(p => p.usage), 1);

                    return (
                      <div key={day} className="flex items-center mb-1">
                        <div className="w-12 text-xs text-gray-600 font-medium">{day}</div>
                        {dayPatterns.map(pattern => {
                          const intensity = pattern.usage / maxUsage;
                          const color = intensity === 0 ? 'bg-gray-100' :
                                       intensity < 0.25 ? 'bg-blue-100' :
                                       intensity < 0.5 ? 'bg-blue-300' :
                                       intensity < 0.75 ? 'bg-blue-500' : 'bg-blue-700';

                          return (
                            <div
                              key={`${day}-${pattern.hour}`}
                              className={`w-8 h-6 ${color} border border-white hover:ring-2 hover:ring-blue-400 cursor-pointer transition-all`}
                              title={`${day} ${pattern.hour}:00 - ${pattern.usage.toFixed(1)}L`}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-end mt-4 text-xs text-gray-500 space-x-2">
                    <span>Low</span>
                    <div className="flex space-x-1">
                      <div className="w-4 h-4 bg-gray-100 border border-gray-200"></div>
                      <div className="w-4 h-4 bg-blue-100 border border-gray-200"></div>
                      <div className="w-4 h-4 bg-blue-300 border border-gray-200"></div>
                      <div className="w-4 h-4 bg-blue-500 border border-gray-200"></div>
                      <div className="w-4 h-4 bg-blue-700 border border-gray-200"></div>
                    </div>
                    <span>High</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Daily Usage Chart</h3>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500">Interactive Chart</span>
              </div>
            </div>
            <div className="space-y-4">
              {filteredData.map((day, index) => (
                <div key={day.date} className="flex items-center space-x-4">
                  <div className="w-20 text-sm text-gray-600">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{day.usage.toFixed(1)}L</span>
                      <span className="text-sm text-gray-500">{day.device}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 hover:bg-blue-700"
                        style={{ width: `${totalUsage > 0 ? (day.usage / totalUsage) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedDevice === 'all' && deviceUsageBreakdown.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Device</h3>
              <div className="space-y-4">
                {deviceUsageBreakdown.map((device, index) => (
                  <div key={device.id}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{device.name}</span>
                      <span className="text-sm font-medium text-gray-900">{device.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-blue-600' :
                          index === 1 ? 'bg-teal-600' :
                          index === 2 ? 'bg-green-600' : 'bg-amber-600'
                        }`}
                        style={{ width: `${device.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Full Resolution Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Export all data points with timestamps at device reporting intervals. Includes flow rate, total volume, and battery level for the selected period.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>{rawDeviceData.length}</strong> data points available for export
              </p>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('csv')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-left flex items-center justify-between"
              >
                <span>Export as CSV</span>
                <span className="text-xs opacity-75">Spreadsheet format</span>
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-left flex items-center justify-between"
              >
                <span>Export as JSON</span>
                <span className="text-xs opacity-75">Machine-readable format</span>
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-left flex items-center justify-between"
              >
                <span>Export as Text Report</span>
                <span className="text-xs opacity-75">Detailed report format</span>
              </button>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
