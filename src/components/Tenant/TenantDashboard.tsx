import React from 'react';
import { Droplets, Wifi, AlertTriangle, Battery } from 'lucide-react';
import { mockDevices, mockAlerts } from '../../data/mockData';

export default function TenantDashboard() {
  const userDevices = mockDevices.filter(d => d.tenantId === '1');
  const totalUsage = userDevices.reduce((sum, device) => sum + device.totalUsage, 0);
  const onlineDevices = userDevices.filter(d => d.status === 'online').length;
  const activeAlerts = mockAlerts.filter(a => !a.resolved && 
    userDevices.some(d => d.id === a.deviceId)).length;

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
      value: `${onlineDevices}/${userDevices.length}`,
      change: 'All systems operational',
      icon: Wifi,
      color: 'green'
    },
    {
      label: 'Active Alerts',
      value: activeAlerts,
      change: activeAlerts === 0 ? 'No issues' : 'Requires attention',
      icon: AlertTriangle,
      color: activeAlerts > 0 ? 'red' : 'green'
    },
    {
      label: 'Avg Battery',
      value: `${Math.round(userDevices.reduce((sum, d) => sum + d.batteryLevel, 0) / userDevices.length)}%`,
      change: 'Good condition',
      icon: Battery,
      color: 'indigo'
    }
  ];

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
            {userDevices.map((device) => (
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
                  <p className="text-sm font-medium text-gray-900">{device.flowRate}L/min</p>
                  <p className="text-xs text-gray-500">{device.batteryLevel}% battery</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Trends</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Today</span>
              <span className="text-sm font-medium text-gray-900">245L</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '65%' }} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">This Week</span>
              <span className="text-sm font-medium text-gray-900">1,842L</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '78%' }} />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">This Month</span>
              <span className="text-sm font-medium text-gray-900">6,345L</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '92%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}