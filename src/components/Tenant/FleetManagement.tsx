import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, CreditCard as Edit, Trash2, Wifi, WifiOff, Wrench, Battery, MapPin, Calendar, Download, Settings, Zap, AlertTriangle, X, Save, Upload, CheckCircle, Clock, Globe, Activity, Tag, Folder, FolderPlus, Antenna } from 'lucide-react';
import { DeviceService, FleetGroupService } from '../../services/database';
import { NotehubService } from '../../services/notehub';
import { getCurrentUser } from '../../services/auth';
import type { Database } from '../../lib/supabase';
import type { User } from '../../types';

type Device = Database['public']['Tables']['devices']['Row'];
type FleetGroup = Database['public']['Tables']['fleet_groups']['Row'];

interface FleetManagementProps {
  user: User;
}

export default function FleetManagement({ user }: FleetManagementProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [fleetGroups, setFleetGroups] = useState<FleetGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFirmwareModal, setShowFirmwareModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showEditDeviceModal, setShowEditDeviceModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [firmwareVersions, setFirmwareVersions] = useState<string[]>(['1.0.0', '1.1.0', '2.0.0', '2.1.0']);
  const [bulkAction, setBulkAction] = useState('');
  const [editingGroup, setEditingGroup] = useState<FleetGroup | null>(null);
  
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

  const [deviceEdit, setDeviceEdit] = useState({
    alias: '',
    fleet_group_id: null as string | null
  });

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    color: '#3B82F6'
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    flow_rate_min: 0,
    flow_rate_max: 100,
    battery_threshold: 25,
    temperature_min: 0,
    temperature_max: 50,
    pressure_min: 0,
    pressure_max: 10
  });

  useEffect(() => {
    loadDevices();
    loadFleetGroups();
  }, []);

  useEffect(() => {
    checkWebhookStatus();
    const interval = setInterval(checkWebhookStatus, 30000);
    return () => clearInterval(interval);
  }, [devices]);

  const loadFleetGroups = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      if (currentUser.role === 'tenant') {
        const data = await FleetGroupService.getFleetGroups(currentUser.id);
        setFleetGroups(data);
      }
    } catch (error) {
      console.error('Error loading fleet groups:', error);
    }
  };

  const checkWebhookStatus = async () => {
    try {
      if (devices.length === 0) {
        setWebhookStatus({
          isConfigured: false,
          isReceivingData: false,
          devicesReporting: 0,
          lastDataReceived: null,
          totalEvents: 0
        });
        return;
      }

      // Check if devices have recent data (last 2 hours)
      const recentDataCount = devices.filter(device => {
        if (!device.last_seen) return false;
        const lastSeen = new Date(device.last_seen);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return lastSeen > twoHoursAgo;
      }).length;

      // Find the most recent last_seen timestamp
      const mostRecentUpdate = devices.reduce((latest, device) => {
        if (!device.last_seen) return latest;
        const deviceTime = new Date(device.last_seen).getTime();
        return deviceTime > latest ? deviceTime : latest;
      }, 0);

      setWebhookStatus({
        isConfigured: true,
        isReceivingData: recentDataCount > 0,
        devicesReporting: recentDataCount,
        lastDataReceived: mostRecentUpdate > 0 ? new Date(mostRecentUpdate).toISOString() : null,
        totalEvents: devices.length
      });
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

  const openEditDeviceModal = (device: Device) => {
    setSelectedDevice(device);
    setDeviceEdit({
      alias: device.alias || '',
      fleet_group_id: device.fleet_group_id || null
    });
    setShowEditDeviceModal(true);
  };

  const handleSaveDeviceEdit = async () => {
    if (!selectedDevice) return;

    try {
      await DeviceService.updateDevice(selectedDevice.id, {
        alias: deviceEdit.alias || null,
        fleet_group_id: deviceEdit.fleet_group_id
      }, true);
      await loadDevices();
      setShowEditDeviceModal(false);
      setSelectedDevice(null);
    } catch (error) {
      console.error('Error updating device:', error);
      alert('Failed to update device. Please try again.');
    }
  };

  const handleCreateGroup = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        alert('User not authenticated');
        return;
      }

      if (currentUser.role !== 'tenant') {
        alert('Only tenants can create fleet groups');
        return;
      }

      await FleetGroupService.createFleetGroup({
        tenant_id: currentUser.id,
        name: newGroup.name,
        description: newGroup.description || null,
        color: newGroup.color
      });
      await loadFleetGroups();
      setNewGroup({ name: '', description: '', color: '#3B82F6' });
      setShowGroupModal(false);
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group. Please try again.');
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup) return;

    try {
      await FleetGroupService.updateFleetGroup(editingGroup.id, {
        name: newGroup.name,
        description: newGroup.description || null,
        color: newGroup.color
      });
      await loadFleetGroups();
      setEditingGroup(null);
      setNewGroup({ name: '', description: '', color: '#3B82F6' });
      setShowGroupModal(false);
    } catch (error) {
      console.error('Error updating group:', error);
      alert('Failed to update group. Please try again.');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? Devices will not be deleted.')) {
      return;
    }

    try {
      await FleetGroupService.deleteFleetGroup(groupId);
      await loadFleetGroups();
      await loadDevices();
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Failed to delete group. Please try again.');
    }
  };

  const openEditGroupModal = (group: FleetGroup) => {
    setEditingGroup(group);
    setNewGroup({
      name: group.name,
      description: group.description || '',
      color: group.color
    });
    setShowGroupModal(true);
  };

  const openAdvancedModal = (device: Device) => {
    setSelectedDevice(device);
    const config = device.alert_config || {};
    setAdvancedSettings({
      flow_rate_min: config.flow_rate_min || 0,
      flow_rate_max: config.flow_rate_max || 100,
      battery_threshold: config.battery_threshold || 25,
      temperature_min: config.temperature_min || 0,
      temperature_max: config.temperature_max || 50,
      pressure_min: config.pressure_min || 0,
      pressure_max: config.pressure_max || 10
    });
    setShowAdvancedModal(true);
  };

  const handleSaveAdvancedSettings = async () => {
    if (!selectedDevice) return;

    try {
      // Update local database with alert config
      await DeviceService.updateDevice(selectedDevice.id, {
        alert_config: advancedSettings
      }, true);

      // Send environment variables to Notehub via device command
      if (selectedDevice.notehub_device_uid) {
        const environmentVariables = {
          _max_flow_rate: advancedSettings.flow_rate_max.toString(),
          _min_flow_rate: advancedSettings.flow_rate_min.toString(),
          _min_battery_power: advancedSettings.battery_threshold.toString(),
          _min_external_temp: advancedSettings.temperature_min.toString(),
          _max_external_temp: advancedSettings.temperature_max.toString(),
          _min_external_pressure: advancedSettings.pressure_min.toString(),
          _max_external_pressure: advancedSettings.pressure_max.toString()
        };

        // Create device command to sync env vars to Notehub
        await DeviceService.updateDeviceEnvironmentVariables(
          selectedDevice.id,
          environmentVariables
        );
      }

      await loadDevices();
      setShowAdvancedModal(false);
      setSelectedDevice(null);
      alert('Settings saved and synced to device successfully!');
    } catch (error) {
      console.error('Error updating device settings:', error);
      alert('Failed to update device settings. Please try again.');
    }
  };

  const filteredDevices = devices.filter(device => {
    const displayName = device.alias || device.name;
    const matchesSearch = displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         device.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    const matchesGroup = groupFilter === 'all' ||
                        (groupFilter === 'ungrouped' && !device.fleet_group_id) ||
                        device.fleet_group_id === groupFilter;
    return matchesSearch && matchesStatus && matchesGroup;
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

  const getSignalColor = (bars: number) => {
    if (bars >= 4) return 'text-green-600';
    if (bars >= 2) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderSignalBars = (strength: number | null | undefined) => {
    if (strength === null || strength === undefined) {
      return (
        <div className="flex items-center space-x-2">
          <Antenna className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">N/A</span>
        </div>
      );
    }

    const bars = Math.max(0, Math.min(5, strength));
    const color = getSignalColor(bars);

    return (
      <div className="flex items-center space-x-2">
        <Antenna className={`h-4 w-4 ${color}`} />
        <span className={`text-sm font-medium ${color}`}>{bars}</span>
      </div>
    );
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
            onClick={() => {
              setEditingGroup(null);
              setNewGroup({ name: '', description: '', color: '#3B82F6' });
              setShowGroupModal(true);
            }}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <FolderPlus className="h-4 w-4" />
            <span>Manage Groups</span>
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{webhookStatus.devicesReporting}</div>
            <p className="text-sm text-gray-600">Devices Reporting</p>
            <p className="text-xs text-gray-500">Last 2 hours</p>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{devices.length}</div>
            <p className="text-sm text-gray-600">Total Devices</p>
            <p className="text-xs text-gray-500">In fleet</p>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {webhookStatus.lastDataReceived
                ? new Date(webhookStatus.lastDataReceived).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'No data'}
            </div>
            <p className="text-sm text-gray-600">Last Update</p>
            <p className="text-xs text-gray-500">Real-time data</p>
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
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Groups</option>
              <option value="ungrouped">Ungrouped</option>
              {fleetGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
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
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Signal</th>
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
                        <div className="flex items-center space-x-2">
                          <p className="font-medium text-gray-900">{device.alias || device.name}</p>
                          {device.alias && (
                            <Tag className="h-3 w-3 text-blue-600" title={`Original: ${device.name}`} />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">{device.device_id}</p>
                        {device.fleet_group_id && (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1"
                            style={{
                              backgroundColor: fleetGroups.find(g => g.id === device.fleet_group_id)?.color + '20',
                              color: fleetGroups.find(g => g.id === device.fleet_group_id)?.color
                            }}
                          >
                            <Folder className="h-3 w-3 mr-1" />
                            {fleetGroups.find(g => g.id === device.fleet_group_id)?.name}
                          </span>
                        )}
                        {device.flow_rate > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1 ml-2">
                            <Activity className="h-3 w-3 mr-1" />
                            {device.flow_rate.toFixed(2)}L/min
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
                        <Battery className={`h-4 w-4 ${getBatteryColor(device.status === 'offline' ? 0 : device.battery_level)}`} />
                        <span className="text-sm font-medium text-gray-900">{device.status === 'offline' ? 0 : device.battery_level}%</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {renderSignalBars(device.status === 'offline' ? 0 : device.signal_strength)}
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-medium text-gray-900">
                        {device.status === 'offline' ? 'Offline' : (device.flow_rate > 0 ? `${device.flow_rate.toFixed(2)}L/min` : 'No flow')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-gray-900">{device.firmware_version}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditDeviceModal(device)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Edit Alias & Group"
                        >
                          <Tag className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => openAdvancedModal(device)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Advanced Settings"
                        >
                          <Settings className="h-4 w-4 text-gray-600" />
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

      {/* Edit Device Alias & Group Modal */}
      {showEditDeviceModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Device Alias & Group</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device Name (Original)</label>
                <input
                  type="text"
                  value={selectedDevice.name}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alias (Custom Name)</label>
                <input
                  type="text"
                  value={deviceEdit.alias}
                  onChange={(e) => setDeviceEdit({...deviceEdit, alias: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter a custom name for this device"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to use original name</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fleet Group</label>
                <select
                  value={deviceEdit.fleet_group_id || ''}
                  onChange={(e) => setDeviceEdit({...deviceEdit, fleet_group_id: e.target.value || null})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">No Group</option>
                  {fleetGroups.map(group => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEditDeviceModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeviceEdit}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Settings Modal */}
      {showAdvancedModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Device Settings</h3>
            <p className="text-sm text-gray-600 mb-6">
              Configure alert thresholds and monitoring parameters for <strong>{selectedDevice.alias || selectedDevice.name}</strong>
            </p>

            <div className="space-y-6">
              {/* Flow Rate Settings */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Activity className="h-5 w-5 text-blue-600 mr-2" />
                  Flow Rate Thresholds
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Flow Rate (L/min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.flow_rate_min}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, flow_rate_min: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert if flow rate drops below this value</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Flow Rate (L/min)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.flow_rate_max}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, flow_rate_max: parseFloat(e.target.value) || 100})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alert if flow rate exceeds this value (leak detection)</p>
                  </div>
                </div>
              </div>

              {/* Battery Threshold */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Battery className="h-5 w-5 text-yellow-600 mr-2" />
                  Battery Threshold
                </h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Low Battery Alert (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={advancedSettings.battery_threshold}
                    onChange={(e) => setAdvancedSettings({...advancedSettings, battery_threshold: parseInt(e.target.value) || 25})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Alert when battery level drops below this percentage</p>
                </div>
              </div>

              {/* Temperature Thresholds */}
              <div className="bg-red-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  Temperature Thresholds (°C)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.temperature_min}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, temperature_min: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.temperature_max}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, temperature_max: parseFloat(e.target.value) || 50})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Pressure Thresholds */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                  <Activity className="h-5 w-5 text-green-600 mr-2" />
                  Pressure Thresholds (bar)
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Pressure</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.pressure_min}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, pressure_min: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Pressure</label>
                    <input
                      type="number"
                      step="0.1"
                      value={advancedSettings.pressure_max}
                      onChange={(e) => setAdvancedSettings({...advancedSettings, pressure_max: parseFloat(e.target.value) || 10})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAdvancedModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdvancedSettings}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Save Settings</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Groups Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Manage Fleet Groups</h3>

            {/* Create/Edit Group Form */}
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                {editingGroup ? 'Edit Group' : 'Create New Group'}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({...newGroup, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Building A, Production Line, North Region"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                  <input
                    type="text"
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({...newGroup, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Brief description of this group"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={newGroup.color}
                      onChange={(e) => setNewGroup({...newGroup, color: e.target.value})}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">{newGroup.color}</span>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  {editingGroup && (
                    <button
                      onClick={() => {
                        setEditingGroup(null);
                        setNewGroup({ name: '', description: '', color: '#3B82F6' });
                      }}
                      className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                    disabled={!newGroup.name.trim()}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {editingGroup ? 'Update Group' : 'Create Group'}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing Groups List */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Existing Groups</h4>
              {fleetGroups.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No groups created yet</p>
              ) : (
                <div className="space-y-2">
                  {fleetGroups.map(group => (
                    <div key={group.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3 flex-1">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: group.color }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{group.name}</p>
                          {group.description && (
                            <p className="text-sm text-gray-500">{group.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditGroupModal(group)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Edit Group"
                        >
                          <Edit className="h-4 w-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroup(null);
                  setNewGroup({ name: '', description: '', color: '#3B82F6' });
                }}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
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