import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Wifi, WifiOff, Wrench, Battery, MapPin, Calendar, RefreshCw, Download, Settings, Zap, AlertTriangle, X, Save, Upload, CheckCircle, Clock, Globe, Activity } from 'lucide-react';
import { DeviceService, NotehubService } from '../../services/database';
import type { Database } from '../../lib/supabase';
import type { User } from '../../types';

type Device = Database['public']['Tables']['devices']['Row'];

interface FleetManagementProps {
  user: User;
}

export default function FleetManagement({ user }: FleetManagementProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFirmwareModal, setShowFirmwareModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [firmwareVersions, setFirmwareVersions] = useState<string[]>(['1.0.0', '1.1.0', '2.0.0', '2.1.0']);
  const [bulkAction, setBulkAction] = useState('');
  
  // Real-time data status
  const [webhookStatus, setWebhookStatus] = useState({
    isConfigured: false,
    isReceivingData: false,
    lastDataReceived: null as string | null,
    totalEvents: 0,
    devicesReporting: 0
  });

  const [newDevice, setNewDevice] = useState({
    device_id: '', // This will be the Notehub Device UID
    name: '', // This will be the serial number
    firmware_version: '1.0.0'
  });

  const [firmwareUpdate, setFirmwareUpdate] = useState({
    version: '2.1.0',
    devices: [] as string[],
    isUpdating: false
  });

  useEffect(() => {
    loadDevices();
    checkWebhookStatus();
    // Check webhook status every 30 seconds
    const interval = setInterval(checkWebhookStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkWebhookStatus = async () => {
    try {
      // Check if devices have recent data (last 5 minutes)
      const recentDataCount = devices.filter(device => {
        const lastSeen = new Date(device.last_seen);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastSeen > fiveMinutesAgo;
      }).length;

      setWebhookStatus(prev => ({
        ...prev,
        isConfigured: true, // Assume configured if we have devices
        isReceivingData: recentDataCount > 0,
        devicesReporting: recentDataCount,
        lastDataReceived: recentDataCount > 0 ? new Date().toISOString() : prev.lastDataReceived
      }));
    } catch (error) {
      console.error('Error checking webhook status:', error);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await DeviceService.getDevices();
      setDevices(data);
    } catch (error) {
      console.error('Error loading devices:', error);
      setError(error instanceof Error ? error.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    try {
      const deviceData = {
        device_id: newDevice.device_id,
        serial_number: newDevice.name, // Use name as serial number
        name: newDevice.name,
        location: 'Unknown Location', // Default location
        coordinates: null, // No coordinates by default
        tenant_id: user.id,
        notehub_device_uid: newDevice.device_id, // Device ID is the Notehub UID
        firmware_version: newDevice.firmware_version,
        status: 'offline' as const,
        battery_level: 100,
        flow_rate: 0,
        total_usage: 0,
        install_date: new Date().toISOString().split('T')[0]
      };

      await DeviceService.createDevice(deviceData);
      await loadDevices();
      setNewDevice({
        device_id: '',
        name: '',
        firmware_version: '1.0.0'
      });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding device:', error);
      alert('Failed to add device. Please try again.');
    }
  };

  const handleEditDevice = async () => {
    if (!selectedDevice) return;

    try {
      const updates = {
        device_id: newDevice.device_id,
        serial_number: newDevice.serial_number,
        name: newDevice.name,
        location: newDevice.location,
        coordinates: newDevice.coordinates.lat && newDevice.coordinates.lon ? newDevice.coordinates : null,
        notehub_device_uid: newDevice.notehub_device_uid || null
      };

      await DeviceService.updateDevice(selectedDevice.id, updates);
      await loadDevices();
      setShowEditModal(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error updating device:', error);
      alert('Failed to update device. Please try again.');
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
      return;
    }

    try {
      await DeviceService.deleteDevice(deviceId);
      await loadDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('Failed to delete device. Please try again.');
    }
  };

  const handleSyncDevice = async (deviceId: string) => {
    try {
      setSyncing(true);
      await DeviceService.syncDeviceFromNotehub(deviceId);
      await loadDevices();
    } catch (error) {
      console.error('Error syncing device:', error);
      alert('Failed to sync device. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllDevices = async () => {
    try {
      setSyncing(true);
      const result = await DeviceService.syncDevicesWithNotehub();
      await loadDevices();
      alert(`Sync completed: ${result.synced} devices processed, ${result.added} added, ${result.updated} updated`);
    } catch (error) {
      console.error('Error syncing all devices:', error);
      alert('Failed to sync devices. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFirmwareUpdate = async () => {
    if (firmwareUpdate.devices.length === 0) {
      alert('Please select devices to update');
      return;
    }

    try {
      setFirmwareUpdate(prev => ({ ...prev, isUpdating: true }));
      
      if (firmwareUpdate.devices.length === 1) {
        await DeviceService.updateDeviceFirmware(firmwareUpdate.devices[0], firmwareUpdate.version);
      } else {
        await DeviceService.updateMultipleDevicesFirmware(firmwareUpdate.devices, firmwareUpdate.version);
      }
      
      await loadDevices();
      setShowFirmwareModal(false);
      setFirmwareUpdate({ version: '2.1.0', devices: [], isUpdating: false });
      alert('Firmware update initiated successfully!');
    } catch (error) {
      console.error('Error updating firmware:', error);
      alert('Failed to update firmware. Please try again.');
    } finally {
      setFirmwareUpdate(prev => ({ ...prev, isUpdating: false }));
    }
  };

  const handleBulkAction = async () => {
    if (selectedDevices.length === 0) {
      alert('Please select devices first');
      return;
    }

    switch (bulkAction) {
      case 'firmware':
        setFirmwareUpdate(prev => ({ ...prev, devices: selectedDevices }));
        setShowFirmwareModal(true);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedDevices.length} devices?`)) {
          try {
            await Promise.all(selectedDevices.map(id => DeviceService.deleteDevice(id)));
            await loadDevices();
            setSelectedDevices([]);
          } catch (error) {
            alert('Failed to delete some devices');
          }
        }
        break;
      case 'sync':
        try {
          setSyncing(true);
          await Promise.all(selectedDevices.map(id => {
            const device = devices.find(d => d.id === id);
            return device ? DeviceService.syncDeviceFromNotehub(id) : Promise.resolve();
          }));
          await loadDevices();
        } catch (error) {
          alert('Failed to sync some devices');
        } finally {
          setSyncing(false);
        }
        break;
    }
    setBulkAction('');
  };

  const openEditModal = (device: Device) => {
    setSelectedDevice(device);
    setNewDevice({
      device_id: device.device_id,
      serial_number: device.serial_number,
      name: device.name,
      location: device.location,
      coordinates: device.coordinates || { lat: 0, lon: 0 },
      notehub_device_uid: device.notehub_device_uid || '',
      firmware_version: device.firmware_version
    });
    setShowEditModal(true);
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesStatus;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Fleet Management</h2>
          <p className="text-gray-600">Manage your IoT water monitoring devices</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSyncAllDevices}
            disabled={syncing}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync All</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Real-time Data Status */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <span>Real-time Data Status</span>
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${webhookStatus.isReceivingData ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {webhookStatus.isReceivingData ? 'Receiving Data' : 'No Recent Data'}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{webhookStatus.devicesReporting}</div>
            <p className="text-sm text-gray-600">Devices Reporting</p>
            <p className="text-xs text-gray-500">Last 5 minutes</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
            <p className="text-sm text-gray-600">Total Devices</p>
            <p className="text-xs text-gray-500">In fleet</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {webhookStatus.lastDataReceived ? new Date(webhookStatus.lastDataReceived).toLocaleTimeString() : 'Never'}
            </div>
            <p className="text-sm text-gray-600">Last Update</p>
            <p className="text-xs text-gray-500">Real-time data</p>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {webhookStatus.isReceivingData ? '✅' : '⚠️'}
            </div>
            <p className="text-sm text-gray-600">Webhook Status</p>
            <p className="text-xs text-gray-500">Notehub integration</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error Loading Devices</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

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
            
            {selectedDevices.length > 0 && (
              <div className="flex items-center space-x-2">
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Bulk Actions ({selectedDevices.length})</option>
                  <option value="firmware">Update Firmware</option>
                  <option value="sync">Sync with Notehub</option>
                  <option value="delete">Delete Devices</option>
                </select>
                <button
                  onClick={handleBulkAction}
                  disabled={!bulkAction}
                  className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            )}
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
                  <th className="text-left py-3 px-6 font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={selectedDevices.length === filteredDevices.length && filteredDevices.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDevices(filteredDevices.map(d => d.id));
                        } else {
                          setSelectedDevices([]);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
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
                      <input
                        type="checkbox"
                        checked={selectedDevices.includes(device.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDevices([...selectedDevices, device.id]);
                          } else {
                            setSelectedDevices(selectedDevices.filter(id => id !== device.id));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{device.name}</p>
                        <p className="text-sm text-gray-500">{device.device_id}</p>
                        {device.flow_rate > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                            <Activity className="h-3 w-3 mr-1" />
                            {device.flow_rate}L/min
                          </span>
                        )}
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
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{device.location}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <Battery className={`h-4 w-4 ${getBatteryColor(device.battery_level)}`} />
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
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => handleSyncDevice(device.id)}
                          disabled={syncing}
                          className="p-1 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                          title="Sync with Notehub"
                        >
                          <RefreshCw className={`h-4 w-4 text-gray-600 ${syncing ? 'animate-spin' : ''}`} />
                        </button>
                        <button 
                          onClick={() => openEditModal(device)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Edit Device"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                        <button 
                          onClick={() => {
                            setFirmwareUpdate(prev => ({ ...prev, devices: [device.id] }));
                            setShowFirmwareModal(true);
                          }}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Update Firmware"
                        >
                          <Zap className="h-4 w-4 text-gray-600" />
                        </button>
                        <button 
                          onClick={() => handleDeleteDevice(device.id)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Delete Device"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Device</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID (Notehub Device UID)</label>
                <input
                  type="text"
                  value={newDevice.device_id}
                  onChange={(e) => setNewDevice({...newDevice, device_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="dev:867730051260929"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Name (Serial Number)</label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="867730051260929"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddDevice}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Device</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID</label>
                <input
                  type="text"
                  value={newDevice.device_id}
                  onChange={(e) => setNewDevice({...newDevice, device_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serial Number</label>
                <input
                  type="text"
                  value={newDevice.serial_number}
                  onChange={(e) => setNewDevice({...newDevice, serial_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice({...newDevice, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newDevice.location}
                  onChange={(e) => setNewDevice({...newDevice, location: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notehub Device UID</label>
                <input
                  type="text"
                  value={newDevice.notehub_device_uid}
                  onChange={(e) => setNewDevice({...newDevice, notehub_device_uid: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newDevice.coordinates.lat}
                    onChange={(e) => setNewDevice({...newDevice, coordinates: {...newDevice.coordinates, lat: parseFloat(e.target.value) || 0}})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newDevice.coordinates.lon}
                    onChange={(e) => setNewDevice({...newDevice, coordinates: {...newDevice.coordinates, lon: parseFloat(e.target.value) || 0}})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditDevice}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Device
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Firmware Update Modal */}
      {showFirmwareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Firmware</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Devices ({firmwareUpdate.devices.length})
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  {firmwareUpdate.devices.map(deviceId => {
                    const device = devices.find(d => d.id === deviceId);
                    return (
                      <div key={deviceId} className="text-sm text-gray-600 py-1">
                        {device?.name || deviceId}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Firmware Version</label>
                <select
                  value={firmwareUpdate.version}
                  onChange={(e) => setFirmwareUpdate(prev => ({ ...prev, version: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {firmwareVersions.map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))}
                </select>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ Firmware updates will be sent to devices via Notehub. This process may take several minutes to complete.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowFirmwareModal(false)}
                disabled={firmwareUpdate.isUpdating}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleFirmwareUpdate}
                disabled={firmwareUpdate.isUpdating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {firmwareUpdate.isUpdating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Update Firmware</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}