import React from 'react';
import { Users, Database, Activity, AlertTriangle } from 'lucide-react';
import { TenantService, DeviceService, AlertService } from '../../services/database';
import type { Database as SupabaseDatabase } from '../../lib/supabase';

type Tenant = SupabaseDatabase['public']['Tables']['tenants']['Row'];
type Device = SupabaseDatabase['public']['Tables']['devices']['Row'];
type Alert = SupabaseDatabase['public']['Tables']['alerts']['Row'];

export default function AdminDashboard() {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [tenantsData, devicesData, alertsData] = await Promise.all([
        TenantService.getAllTenants(),
        DeviceService.getDevices(),
        AlertService.getAlerts()
      ]);
      setTenants(tenantsData);
      setDevices(devicesData);
      setAlerts(alertsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const unresolvedAlerts = alerts.filter(a => !a.resolved).length;

  const stats = [
    {
      label: 'Total Tenants',
      value: totalTenants,
      change: '+12%',
      icon: Users,
      color: 'blue'
    },
    {
      label: 'Active Devices',
      value: `${onlineDevices}/${totalDevices}`,
      change: '94% uptime',
      icon: Database,
      color: 'green'
    },
    {
      label: 'System Health',
      value: '98.5%',
      change: '+0.3%',
      icon: Activity,
      color: 'indigo'
    },
    {
      label: 'Active Alerts',
      value: unresolvedAlerts,
      change: '-2 today',
      icon: AlertTriangle,
      color: 'red'
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">System Overview</h2>
          <p className="text-gray-600">Monitor your IoT water management platform</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading dashboard data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">System Overview</h2>
        <p className="text-gray-600">Monitor your IoT water management platform</p>
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
                <span className="text-sm font-medium text-green-600">{stat.change}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tenant Activity</h3>
          <div className="space-y-4">
            {tenants.slice(0, 5).map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                    <p className="text-xs text-gray-500">{tenant.company}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">0 devices</p>
                  <p className="text-xs text-gray-500">0L</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Alerts</h3>
          <div className="space-y-4">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3 py-2">
                <div className={`p-1 rounded-full ${
                  alert.severity === 'high' ? 'bg-red-100' :
                  alert.severity === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                }`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    alert.severity === 'high' ? 'text-red-600' :
                    alert.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                  <p className="text-xs text-gray-500">
                    Device {alert.device_id} • {alert.created_at && !isNaN(new Date(alert.created_at).getTime()) ? new Date(alert.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  alert.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {alert.resolved ? 'Resolved' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}