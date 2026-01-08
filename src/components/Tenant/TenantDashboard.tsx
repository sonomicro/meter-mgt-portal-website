import React, { useState, useEffect } from 'react';
import { Droplets, Wifi, AlertTriangle, Battery } from 'lucide-react';
import { DeviceService } from '../../services/database';
import { getCurrentUser } from '../../services/auth';
import type { Database } from '../../lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];

export default function TenantDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    loadUserDevices();
  }, []);

  const loadUserDevices = async () => {
    try {
      setLoading(true);

      const user = await getCurrentUser();
      if (!user || user.role !== 'tenant') {
        console.log('No tenant user found');
        return;
      }

      console.log('Current tenant user:', user);
      setCurrentUserId(user.id);

      // Use DeviceService to get devices with computed status
      const userDevices = await DeviceService.getDevices();

      console.log('Loaded devices for tenant:', userDevices);
      setDevices(userDevices || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalUsage = devices.reduce((sum, device) => sum + device.total_usage, 0);
  const onlineDevices = devices.filter(d => d.status === 'online').length;

  // Count devices that are offline or in maintenance as alerts
  const activeAlerts = devices.filter(d => d.status === 'offline' || d.status === 'maintenance').length;

  const stats = [
    {
      label: 'Total Water Usage',
      value: `${totalUsage.toLocaleString()}L`,
      change: '+8.2% vs last month',
      icon: Droplets,
      color: 'blue'
    },
    {
      label: 'Active Devices',
      value: `${onlineDevices}/${devices.length}`,
      change: 'All systems operational',
      icon: Wifi,
      color: 'green'
    },
    {
      label: 'Active Alerts',
      value: activeAlerts,
      change: activeAlerts === 0 ? 'No issues' : `${activeAlerts} device${activeAlerts > 1 ? 's' : ''} offline`,
      icon: AlertTriangle,
      color: activeAlerts > 0 ? 'red' : 'green'
    },
    {
      label: 'Avg Battery',
      value: devices.length > 0 ? `${Math.round(devices.reduce((sum, d) => sum + d.battery_level, 0) / devices.length)}%` : '0%',
      change: 'Good condition',
      icon: Battery,
      color: 'green'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Monitor your water usage and device fleet</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading devices...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-gray-600">Monitor your water usage and device fleet</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600 mb-2">{stat.label}</p>
                <p className="text-xs text-gray-500">{stat.change}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Status</h3>
          <div className="space-y-4">
            {devices.length === 0 ? (
              <p className="text-gray-500 text-sm italic">No devices assigned yet</p>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      device.status === 'online' ? 'bg-green-500' :
                      device.status === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
                    }`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{device.name}</p>
                      <p className="text-xs text-gray-500">{device.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{device.flow_rate.toFixed(2)}L/min</p>
                    <p className="text-xs text-gray-500">{device.battery_level}% battery</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Trends</h3>
          <div className="space-y-4">
            {devices.length === 0 || totalUsage === 0 ? (
              <p className="text-gray-500 text-sm italic">No usage data available yet</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Usage</span>
                  <span className="text-sm font-medium text-gray-900">{totalUsage.toLocaleString()}L</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Historical usage trends will appear here as your devices report data
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
