import React, { useState } from 'react';
import { Search, Filter, Download, RefreshCw, Wifi, WifiOff, Wrench, Battery, MapPin, Calendar, ExternalLink, Eye, X, Activity, Globe, AlertTriangle } from 'lucide-react';
import { DeviceService } from '../../services/database';
import type { Database } from '../../lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];

export default function DeviceOverview() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [webhookStats, setWebhookStats] = useState({
    totalEvents: 0,
    lastReceived: null as string | null,
    devicesReporting: 0,
    isActive: false
  });

  // Check webhook activity
  React.useEffect(() => {
    checkWebhookActivity();
  }, []);

  // Load devices on component mount
  React.useEffect(() => {
    loadDevices();
  }, []);

  const checkWebhookActivity = async () => {
    try {
      // This would check recent device_data entries to see if webhook is working
      const recentDataCount = devices.filter(d => {
        const lastSeen = new Date(d.last_seen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastSeen > fiveMinutesAgo;
      }).length;
      
      setWebhookStats(prev => ({
        ...prev,
        devicesReporting: recentDataCount,
        isActive: recentDataCount > 0
      }));
    } catch (error) {
      console.error('Error checking webhook activity:', error);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading devices...');
      const data = await DeviceService.getDevices();
      console.log('Loaded devices:', data.length);
      setDevices(data);
    } catch (error) {
      console.error('Error loading devices:', error);
      setError(error instanceof Error ? error.message : 'Failed to load devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || device.location.toLowerCase().includes(locationFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesLocation;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Wifi className="h-4 w-4 text-green-600" />;
      case 'offline': return <WifiOff className="h-4 w-4 text-red-600" />;
      case 'maintenance': return <Wrench className="h-4 w-4 text-yellow-600" />;
      default: return <WifiOff className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-100 text-green-800';
      case 'offline': return 'bg-red-100 text-red-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBatteryColor = (level: number) => {
    if (level > 60) return 'text-green-600';
    if (level > 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCountryState = (location: string) => {
    return location;
  };

  const getLocations = () => {
    const locations = [...new Set(devices.map(d => getCountryState(d.location)))];
    return locations;
  };

  const handleViewDevice = (device: Device) => {
    setSelectedDevice(device);
    setShowDeviceModal(true);
  };

  const getCoordinateMapUrl = (lat: number, lon: number) => {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  };

  const totalDevices = devices.length;
  const onlineDevices = devices.filter(d => d.status === 'online').length;
  const offlineDevices = devices.filter(d => d.status === 'offline').length;
  const maintenanceDevices = devices.filter(d => d.status === 'maintenance').length;

  // Geographic distribution
  const locationStats = getLocations().map(location => ({
    location,
    count: devices.filter(d => getCountryState(d.location) === location).length
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Overview</h2>
          <p className="text-gray-600">Monitor all IoT devices across the platform</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2">
            <RefreshCw className="h-4 w-4" />
            <span>Sync All</span>
          </button>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Devices</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <MapPin className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{totalDevices}</p>
            <p className="text-sm text-gray-600">Total Devices</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-green-100">
              <Wifi className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{onlineDevices}</p>
            <p className="text-sm text-gray-600">Online</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-red-100">
              <WifiOff className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{offlineDevices}</p>
            <p className="text-sm text-gray-600">Offline</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Wrench className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{maintenanceDevices}</p>
            <p className="text-sm text-gray-600">Maintenance</p>
          </div>
        </div>
      </div>

      {/* Webhook Activity Status */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Webhook Activity</span>
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${webhookStats.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {webhookStats.isActive ? 'Active' : 'No recent activity'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{webhookStats.devicesReporting}</div>
            <p className="text-sm text-gray-600">Devices Reporting</p>
            <p className="text-xs text-gray-500">In last 5 minutes</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{totalDevices}</div>
            <p className="text-sm text-gray-600">Total Devices</p>
            <p className="text-xs text-gray-500">In system</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {webhookStats.isActive ? '✅' : '⚠️'}
            </div>
            <p className="text-sm text-gray-600">Webhook Status</p>
            <p className="text-xs text-gray-500">Real-time data flow</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Locations</option>
              {getLocations().map(location => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading devices...</span>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Device</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Location</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Battery</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Flow Rate</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Firmware</th>
                <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-gray-900">{device.device_id.toUpperCase()}</p>
                      <p className="text-sm text-gray-500">{device.serial_number}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(device.status)}
                      <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{getCountryState(device.location)}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Battery className={`h-4 w-4 ${getBatteryColor(device.batteryLevel)}`} />
                      <span className="text-sm font-medium text-gray-900">{device.battery_level}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-medium text-gray-900">
                      {device.flow_rate > 0 ? `${device.flow_rate}L/min` : 'No flow'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm text-gray-900">{device.firmware_version}</span>
                  </td>
                  <td className="py-4 px-6">
                    <button 
                      onClick={() => handleViewDevice(device)}
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      title="View Details"
                    >
                      <Eye className="h-4 w-4 text-gray-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
          <div className="space-y-4">
            {locationStats.map((stat) => (
              <div key={stat.location} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{stat.location}</span>
                <span className="text-sm font-medium text-gray-900">{stat.count} devices</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Device Health</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Battery</span>
              <span className="text-sm font-medium text-gray-900">
                {devices.length > 0 ? Math.round(devices.reduce((sum, d) => sum + d.battery_level, 0) / devices.length) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Flow Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {devices.reduce((sum, d) => sum + d.flow_rate, 0).toFixed(1)}L/min
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium text-green-600">
                {Math.round((onlineDevices / totalDevices) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Device Details Modal */}
      {showDeviceModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Device Details</h3>
              <button
                onClick={() => setShowDeviceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Device Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Device ID:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.device_id.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Serial Number:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.serial_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Tenant ID:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.tenant_id || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedDevice.status)}`}>
                        {selectedDevice.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Technical Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Firmware:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.firmware_version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Battery Level:</span>
                      <span className={`text-sm font-medium ${getBatteryColor(selectedDevice.battery_level)}`}>
                        {selectedDevice.battery_level}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Install Date:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(selectedDevice.install_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Seen:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {new Date(selectedDevice.last_seen).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Location Details</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Region:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.location}</span>
                    </div>
                    {selectedDevice.coordinates && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Latitude:</span>
                          <span className="text-sm font-medium text-gray-900">{selectedDevice.coordinates.lat}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Longitude:</span>
                          <span className="text-sm font-medium text-gray-900">{selectedDevice.coordinates.lon}</span>
                        </div>
                        <div className="mt-3">
                          <a
                            href={getCoordinateMapUrl(selectedDevice.coordinates.lat, selectedDevice.coordinates.lon)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
                          >
                            <MapPin className="h-4 w-4" />
                            <span>View on Google Maps</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Statistics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Flow:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedDevice.flow_rate > 0 ? `${selectedDevice.flow_rate}L/min` : 'No flow'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Usage:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedDevice.total_usage.toLocaleString()}L</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowDeviceModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}