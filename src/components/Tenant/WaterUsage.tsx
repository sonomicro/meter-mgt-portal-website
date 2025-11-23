import React, { useState, useEffect } from 'react';
import { Calendar, Download, TrendingUp, TrendingDown, BarChart3, FileText, Filter, Droplets, Activity, AlertTriangle, WifiOff, Clock, Zap } from 'lucide-react';
import { supabaseServiceRole } from '../../lib/supabase';
import { getCurrentUser } from '../../services/auth';
import type { Database } from '../../lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];
type DeviceData = Database['public']['Tables']['device_data']['Row'];

interface DailyUsage {
  date: string;
  usage: number;
  device: string;
}

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

export default function WaterUsage() {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [usageData, setUsageData] = useState<DailyUsage[]>([]);
  const [deviceUsageBreakdown, setDeviceUsageBreakdown] = useState<DeviceUsagePercent[]>([]);
  const [hourlyPatterns, setHourlyPatterns] = useState<HourlyPattern[]>([]);
  const [leakAlerts, setLeakAlerts] = useState<LeakAlert[]>([]);
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

      // Load devices
      const { data: userDevices, error: devicesError } = await supabaseServiceRole
        .from('devices')
        .select('*')
        .eq('tenant_id', user.id);

      if (devicesError) {
        console.error('Error fetching devices:', devicesError);
        return;
      }

      setDevices(userDevices || []);

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
        .select('device_id, timestamp, total_volume')
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

      // Process data into daily usage
      const dailyMap = new Map<string, { usage: number; device: string }>();

      (deviceDataRecords || []).forEach((record: any) => {
        const date = new Date(record.timestamp).toISOString().split('T')[0];
        const device = userDevices.find(d => d.id === record.device_id);
        const deviceName = device?.name || 'Unknown Device';

        const existing = dailyMap.get(date);
        const volume = Number(record.total_volume) || 0;

        if (existing) {
          existing.usage = Math.max(existing.usage, volume);
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
        const maxVolume = deviceRecords.reduce((max, r) => Math.max(max, Number(r.total_volume) || 0), 0);
        deviceUsageMap.set(device.id, maxVolume);
      });

      const totalUsage = Array.from(deviceUsageMap.values()).reduce((sum, val) => sum + val, 0);
      const breakdown: DeviceUsagePercent[] = userDevices.map(device => ({
        id: device.id,
        name: device.name,
        usage: deviceUsageMap.get(device.id) || 0,
        percentage: totalUsage > 0 ? ((deviceUsageMap.get(device.id) || 0) / totalUsage) * 100 : 0
      })).filter(d => d.usage > 0);

      setDeviceUsageBreakdown(breakdown);

      // Calculate hourly patterns for heatmap (last 7 days only)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data: hourlyData } = await supabaseServiceRole
        .from('device_data')
        .select('device_id, timestamp, flow_rate')
        .gte('timestamp', weekAgo.toISOString())
        .in('device_id', userDevices.map(d => d.id));

      const hourlyMap = new Map<string, number>();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      (hourlyData || []).forEach((record: any) => {
        const date = new Date(record.timestamp);
        const day = days[date.getDay()];
        const hour = date.getHours();
        const key = `${day}-${hour}`;
        const flow = Number(record.flow_rate) || 0;
        hourlyMap.set(key, (hourlyMap.get(key) || 0) + flow);
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

      // Detect potential leaks (continuous flow for extended periods)
      const leaks: LeakAlert[] = [];
      for (const device of userDevices) {
        const deviceRecords = (hourlyData || [])
          .filter((r: any) => r.device_id === device.id)
          .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        let continuousFlowCount = 0;
        let totalFlow = 0;

        for (const record of deviceRecords) {
          const flow = Number(record.flow_rate) || 0;
          if (flow > 0) {
            continuousFlowCount++;
            totalFlow += flow;
          } else {
            continuousFlowCount = 0;
            totalFlow = 0;
          }

          // Alert if continuous flow for 6+ hours
          if (continuousFlowCount >= 6) {
            const avgFlow = totalFlow / continuousFlowCount;
            leaks.push({
              deviceId: device.id,
              deviceName: device.name,
              duration: continuousFlowCount,
              avgFlowRate: avgFlow,
              lastSeen: device.last_seen || ''
            });
            break;
          }
        }
      }
      setLeakAlerts(leaks);

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
        return d.device === device?.name;
      });

  const totalUsage = filteredData.reduce((sum, day) => sum + day.usage, 0);
  const avgDaily = filteredData.length > 0 ? totalUsage / filteredData.length : 0;
  const trend = filteredData.length >= 2
    ? filteredData[filteredData.length - 1]?.usage > filteredData[0]?.usage
    : false;

  const handleExport = (format: string) => {
    let content = '';
    let filename = '';

    if (format === 'csv') {
      content = 'Date,Usage (L)\n' +
                filteredData.map(d => `${d.date},${d.usage}`).join('\n');
      filename = 'water-usage.csv';
    } else if (format === 'json') {
      content = JSON.stringify(filteredData, null, 2);
      filename = 'water-usage.json';
    } else {
      const deviceName = devices.find(d => d.id === selectedDevice)?.name || 'All Devices';
      content = `Water Usage Report\n\nPeriod: ${selectedPeriod}\nDevice: ${deviceName}\n\nTotal Usage: ${totalUsage.toFixed(1)}L\nDaily Average: ${avgDaily.toFixed(1)}L\n\nDaily Breakdown:\n` +
                filteredData.map(d => `${d.date}: ${d.usage.toFixed(1)}L`).join('\n');
      filename = 'water-usage-report.txt';
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
    const deviceName = devices.find(d => d.id === selectedDevice)?.name || 'All Devices';
    const reportData = {
      period: selectedPeriod,
      device: deviceName,
      summary: {
        totalUsage,
        avgDaily,
        trend: trend ? 'increasing' : 'decreasing'
      },
      data: filteredData
    };

    const content = `WATER USAGE ANALYSIS REPORT\n\n` +
                   `Generated: ${new Date().toLocaleString()}\n` +
                   `Period: ${selectedPeriod}\n` +
                   `Device: ${reportData.device}\n\n` +
                   `SUMMARY\n` +
                   `Total Usage: ${totalUsage.toFixed(1)}L\n` +
                   `Daily Average: ${avgDaily.toFixed(1)}L\n` +
                   `Trend: ${reportData.summary.trend}\n\n` +
                   `DETAILED DATA\n` +
                   filteredData.map(d => `${d.date}: ${d.usage.toFixed(1)}L`).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'water-usage-analysis.txt';
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
              <option key={device.id} value={device.id}>{device.name}</option>
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
              <p className="text-3xl font-bold text-gray-900">{devices.length - kpiData.offlineDevices}/{devices.length}</p>
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

          {/* Device Health Overview */}
          {devices.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Health Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map(device => {
                  const isOnline = device.status === 'online';
                  const batteryLevel = device.battery_level || 0;
                  const lastSeenText = device.last_seen
                    ? new Date(device.last_seen).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Never';

                  return (
                    <div key={device.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{device.name}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Battery</span>
                          <span className={`font-medium ${
                            batteryLevel > 50 ? 'text-green-600' : batteryLevel > 20 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {batteryLevel}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Last Seen</span>
                          <span className="text-gray-900">{lastSeenText}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Flow Rate</span>
                          <span className="text-gray-900">{device.flow_rate?.toFixed(1) || '0'} L/min</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Usage Data</h3>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('csv')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                Export as CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-left"
              >
                Export as JSON
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-left"
              >
                Export as Report
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
