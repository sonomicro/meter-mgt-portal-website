import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Activity, Globe, Server, Zap, Database, Clock } from 'lucide-react';
import { TenantService, DeviceService } from '../../services/database';
import type { Database as SupabaseDatabase } from '../../lib/supabase';

type Tenant = SupabaseDatabase['public']['Tables']['tenants']['Row'];
type Device = SupabaseDatabase['public']['Tables']['devices']['Row'];

const SystemAnalytics: React.FC = () => {
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      const [tenantsData, devicesData] = await Promise.all([
        TenantService.getAllTenants(),
        DeviceService.getDevices()
      ]);
      setTenants(tenantsData);
      setDevices(devicesData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const platformMetrics = [
    { name: 'Jan', users: 1200, devices: 3400, dataPoints: 45000 },
    { name: 'Feb', users: 1350, devices: 3800, dataPoints: 52000 },
    { name: 'Mar', users: 1500, devices: 4200, dataPoints: 58000 },
    { name: 'Apr', users: 1680, devices: 4600, dataPoints: 65000 },
    { name: 'May', users: 1850, devices: 5100, dataPoints: 72000 },
    { name: 'Jun', users: 2000, devices: 5500, dataPoints: 78000 },
  ];

  const deviceTypes = [
    { name: 'Clamp-on Flow Meters', value: 65, color: '#1e40af' },
    { name: 'Inline Sensors', value: 25, color: '#0d9488' },
    { name: 'Smart Valves', value: 10, color: '#7c3aed' },
  ];

  const regionalData = [
    { region: 'North America', devices: 2200, growth: 12 },
    { region: 'Europe', devices: 1800, growth: 8 },
    { region: 'Asia Pacific', devices: 1300, growth: 18 },
    { region: 'Latin America', devices: 200, growth: 25 },
  ];

  // Calculate real metrics from database
  const totalUsers = tenants.length;
  const activeDevices = devices.filter(d => d.status === 'online').length;
  const totalDevices = devices.length;

  const systemHealth = [
    { metric: 'API Response Time', value: '145ms', status: 'good', icon: Zap },
    { metric: 'Database Performance', value: '99.8%', status: 'excellent', icon: Database },
    { metric: 'Server Uptime', value: '99.99%', status: 'excellent', icon: Server },
    { metric: 'Data Processing', value: '2.3M/hr', status: 'good', icon: Activity },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'critical': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">System Analytics</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading analytics data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">System Analytics</h1>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{totalUsers.toLocaleString()}</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12.5% from last month
              </p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Devices</p>
              <p className="text-2xl font-bold text-gray-900">{activeDevices.toLocaleString()}</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +8.3% from last month
              </p>
            </div>
            <Activity className="w-8 h-8 text-teal-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Points/Day</p>
              <p className="text-2xl font-bold text-gray-900">2.8M</p>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +15.2% from last month
              </p>
            </div>
            <Database className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Global Reach</p>
              <p className="text-2xl font-bold text-gray-900">{new Set(devices.map(d => d.location)).size}</p>
              <p className="text-xs text-gray-500 mt-1">Countries served</p>
            </div>
            <Globe className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      </div>

      {/* Platform Growth */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Platform Growth</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={platformMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="users" stroke="#1e40af" strokeWidth={2} name="Users" />
              <Line type="monotone" dataKey="devices" stroke="#0d9488" strokeWidth={2} name="Devices" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Device Type Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={deviceTypes}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}%`}
                >
                  {deviceTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Regional Performance */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Regional Performance</h2>
          <div className="space-y-4">
            {regionalData.map((region) => (
              <div key={region.region} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{region.region}</p>
                  <p className="text-sm text-gray-500">{region.devices.toLocaleString()} devices</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">+{region.growth}%</p>
                  <p className="text-xs text-gray-500">growth</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemHealth.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.metric} className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${getStatusColor(item.status)}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.metric}</p>
                  <p className="text-lg font-bold text-gray-900">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Processing Trends */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Processing Trends</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={platformMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="dataPoints" fill="#1e40af" name="Data Points" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default SystemAnalytics;