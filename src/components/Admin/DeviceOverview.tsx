import React, { useState, useEffect } from 'react';
import { Search, Plus, Settings, Wifi, WifiOff, Battery, MapPin, AlertTriangle, Activity, Database as DatabaseIcon, Globe, CreditCard as Edit, Trash2, UserPlus } from 'lucide-react';
import { DeviceService, TenantService } from '../../services/database';
import { DeviceFleetAssignmentService } from '../../services/deviceFleetAssignment';
import { NotehubService } from '../../services/notehub';
import type { Database } from '../../lib/supabase';
import type { NotehubDevice } from '../../services/notehub';

type Device = Database['public']['Tables']['devices']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

export default function DeviceOverview() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [notehubDevices, setNotehubDevices] = useState<NotehubDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'devices' | 'sync'>('devices');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState({
    lastSync: null as string | null,
    totalDevices: 0,
    syncedDevices: 0,
    orphanedDevices: [] as Device[],
    unregisteredDevices: [] as NotehubDevice[]
  });

  const [newDevice, setNewDevice] = useState({
    device_id: '',
    serial_number: '',
    name: '',
    location: '',
    coordinates: { lat: 0, lon: 0 },
    notehub_device_uid: '',
    firmware_version: '1.0.0'
  });

  useEffect(() => {
    loadDevices();
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await TenantService.getAllTenants();
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
    }
  };

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const supabaseDevices = await DeviceService.getDevices();
      setDevices(supabaseDevices);
      
      // Try to load Notehub devices if configured
      if (NotehubService.isConfigured()) {
        try {
          console.log('🔍 Loading Notehub devices...');
          const notehubData = await NotehubService.getAllDevicesFromNotehub();
          console.log('✅ Loaded Notehub devices:', notehubData.length);
          setNotehubDevices(notehubData);
          
          // Calculate sync status
          calculateSyncStatus(supabaseDevices, notehubData);
        } catch (notehubError) {
          console.error('Error loading Notehub devices:', notehubError);
          if (notehubError.message.includes('notehub-proxy')) {
            setError('Notehub proxy not deployed. Please check that the Edge Function is deployed in Supabase.');
          } else if (notehubError.message.includes('credentials not configured')) {
            setError('Notehub credentials not configured. Please set NOTEHUB_CLIENT_ID and NOTEHUB_CLIENT_SECRET in Supabase Edge Function environment variables.');
          } else {
            setError(`Notehub integration error: ${notehubError.message}`);
          }
          setNotehubDevices([]);
        }
      } else {
        console.warn('Notehub not configured, skipping Notehub device sync');
        setNotehubDevices([]);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      setError(error instanceof Error ? error.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const calculateSyncStatus = (supabaseDevices: Device[], notehubData: NotehubDevice[]) => {
    const supabaseDeviceMap = new Map(supabaseDevices.map(d => [d.notehub_device_uid, d]).filter(([uid]) => uid));
    const notehubDeviceMap = new Map(notehubData.map(d => [d.uid, d]));

    const orphanedDevices: Device[] = [];
    const unregisteredDevices: NotehubDevice[] = [];

    // Check for orphaned devices
    supabaseDevices.forEach(device => {
      if (device.notehub_device_uid) {
        const notehubDevice = notehubDeviceMap.get(device.notehub_device_uid);
        if (!notehubDevice) {
          orphanedDevices.push(device);
        }
      }
    });

    // Check for unregistered devices
    notehubData.forEach(notehubDevice => {
      if (!supabaseDeviceMap.has(notehubDevice.uid)) {
        unregisteredDevices.push(notehubDevice);
      }
    });

    setSyncStatus({
      lastSync: new Date().toISOString(),
      totalDevices: notehubData.length,
      syncedDevices: supabaseDevices.filter(d => d.notehub_device_uid).length,
      orphanedDevices,
      unregisteredDevices
    });
  };


  const handleAddDevice = async () => {
    try {
      const deviceData = {
        device_id: newDevice.device_id,
        serial_number: newDevice.serial_number,
        name: newDevice.name,
        location: newDevice.location,
        coordinates: newDevice.coordinates.lat && newDevice.coordinates.lon ? newDevice.coordinates : null,
        tenant_id: null, // Admin can assign later
        notehub_device_uid: newDevice.notehub_device_uid || null,
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
        serial_number: '',
        name: '',
        location: '',
        coordinates: { lat: 0, lon: 0 },
        notehub_device_uid: '',
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

  const handleAssignToTenant = async () => {
    console.log('🔄 handleAssignToTenant called', { selectedTenantId, selectedDevices: Array.from(selectedDevices) });

    if (!selectedTenantId) {
      alert('Please select a tenant');
      return;
    }

    try {
      const deviceIds = Array.from(selectedDevices);
      console.log('📋 Device IDs to assign:', deviceIds);

      const selectedTenant = tenants.find(t => t.id === selectedTenantId);
      console.log('🏢 Selected tenant:', selectedTenant);

      if (!selectedTenant) {
        alert('Selected tenant not found');
        return;
      }

      // Use the shared assignment service
      const results = await DeviceFleetAssignmentService.assignDevicesToTenant(
        deviceIds,
        selectedTenantId,
        selectedTenant.company
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount > 0) {
        console.warn(`⚠️ ${failCount} device(s) failed to assign completely`);
      }

      setSelectedDevices(new Set());
      setShowAssignModal(false);
      setSelectedTenantId('');

      // Just reload from Supabase to avoid rate limits
      const supabaseDevices = await DeviceService.getDevices();
      setDevices(supabaseDevices);

      alert(`Successfully assigned ${successCount} device(s) to tenant`);
    } catch (error) {
      console.error('Error assigning devices:', error);
      alert('Failed to assign devices. Please try again.');
    }
  };

  const handleUnassignFromTenant = async (device: Device) => {
    if (!device.tenant_id) {
      alert('Device is not assigned to any tenant');
      return;
    }

    if (!confirm(`Are you sure you want to unassign "${device.name}" from its tenant?`)) {
      return;
    }

    try {
      await DeviceService.updateDevice(device.id, { tenant_id: null });

      // Reload devices
      const supabaseDevices = await DeviceService.getDevices();
      setDevices(supabaseDevices);

      alert('Device successfully unassigned from tenant');
    } catch (error) {
      console.error('Error unassigning device:', error);
      alert('Failed to unassign device. Please try again.');
    }
  };

  const toggleDeviceSelection = (deviceId: string) => {
    const newSelection = new Set(selectedDevices);
    if (newSelection.has(deviceId)) {
      newSelection.delete(deviceId);
    } else {
      newSelection.add(deviceId);
    }
    setSelectedDevices(newSelection);
  };

  const openAssignModal = (device?: Device) => {
    if (device) {
      setSelectedDevices(new Set([device.id]));
    }
    setShowAssignModal(true);
  };

  // Calculate statistics
  const displayedDevices = devices;
  const totalDevices = devices.length;
  const onlineDevices = devices.filter(device => device.status === 'online').length;

  // Filter devices based on search and status
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
      case 'maintenance': return <Settings className="h-4 w-4 text-yellow-600" />;
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

  const formatLastSeen = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Overview</h2>
          <p className="text-gray-600">Monitor and manage all IoT devices across the platform</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Device Overview</h2>
          <p className="text-gray-600">Monitor and manage all IoT devices across the platform</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedDevices.size > 0 && (
            <button
              onClick={() => openAssignModal()}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>Assign to Tenant ({selectedDevices.size})</span>
            </button>
          )}
          <button
            onClick={() => setViewMode(viewMode === 'devices' ? 'sync' : 'devices')}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
          >
            <Activity className="h-4 w-4" />
            <span>{viewMode === 'devices' ? 'View Sync Status' : 'View Devices'}</span>
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <DatabaseIcon className="h-6 w-6 text-blue-600" />
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
            <p className="text-sm text-gray-600">Online Devices</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {(syncStatus.orphanedDevices || []).length}
            </p>
            <p className="text-sm text-gray-600">Orphaned Devices</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">
              {NotehubService.isConfigured() ? 'Connected' : 'Not Connected'}
            </p>
            <p className="text-sm text-gray-600">Notehub Status</p>
          </div>
        </div>
      </div>

      {/* Sync Status View */}
      {viewMode === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <DatabaseIcon className="h-5 w-5 text-red-600" />
              <span>Orphaned Devices ({(syncStatus.orphanedDevices || []).length})</span>
            </h3>
            <div className="space-y-3">
              {(syncStatus.orphanedDevices || []).slice(0, 5).map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{device.name}</p>
                    <p className="text-sm text-gray-500">{device.notehub_device_uid}</p>
                  </div>
                  <button
                    onClick={() => openEditModal(device)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Fix
                  </button>
                </div>
              ))}
              {(syncStatus.orphanedDevices || []).length === 0 && (
                <p className="text-gray-500 text-sm italic">No orphaned devices found</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Plus className="h-5 w-5 text-blue-600" />
              <span>Unregistered Devices ({(syncStatus.unregisteredDevices || []).length})</span>
            </h3>
            <div className="space-y-3">
              {(syncStatus.unregisteredDevices || []).slice(0, 5).map((device) => (
                <div key={device.uid} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{device.uid.substring(0, 16)}...</p>
                    <p className="text-sm text-gray-500">{device.serial_number}</p>
                  </div>
                  <button
                    onClick={() => {
                      const locationData = device.tower_location || device.location;
                      setNewDevice({
                        device_id: device.uid,
                        serial_number: device.serial_number || device.uid,
                        name: `Device ${device.uid.substring(0, 8)}`,
                        location: locationData ? (locationData.name ? `${locationData.name}, ${locationData.country}` : `${locationData.latitude.toFixed(4)}, ${locationData.longitude.toFixed(4)}`) : 'Unknown Location',
                        coordinates: locationData ? { lat: locationData.latitude, lon: locationData.longitude } : { lat: 0, lon: 0 },
                        notehub_device_uid: device.uid,
                        firmware_version: '1.0.0'
                      });
                      setShowAddModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Register
                  </button>
                </div>
              ))}
              {(syncStatus.unregisteredDevices || []).length === 0 && (
                <p className="text-gray-500 text-sm italic">No unregistered devices found</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Device List */}
      {viewMode !== 'sync' && (
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-900 w-12">
                    <input
                      type="checkbox"
                      checked={filteredDevices.length > 0 && selectedDevices.size === filteredDevices.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
                        } else {
                          setSelectedDevices(new Set());
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Device</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Tenant</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Status</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Location</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Battery</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Last Seen</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Firmware</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDevices.map((device) => {
                  const assignedTenant = tenants.find(t => t.id === device.tenant_id);
                  return (
                    <tr key={device.id} className="hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <input
                          type="checkbox"
                          checked={selectedDevices.has(device.id)}
                          onChange={() => toggleDeviceSelection(device.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-medium text-gray-900">{device.name}</p>
                          <p className="text-sm text-gray-500">{device.device_id}</p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {assignedTenant ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">{assignedTenant.name}</p>
                            <p className="text-xs text-gray-500">{assignedTenant.company}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 italic">Unassigned</span>
                        )}
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
                        <span className="text-sm text-gray-900">
                          {formatLastSeen(device.last_seen)}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-900">{device.firmware_version}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          {device.tenant_id ? (
                            <button
                              onClick={() => handleUnassignFromTenant(device)}
                              className="p-1 rounded hover:bg-red-100 transition-colors"
                              title="Unassign from Tenant"
                            >
                              <UserPlus className="h-4 w-4 text-red-600" style={{ transform: 'rotate(180deg)' }} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openAssignModal(device)}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                              title="Assign to Tenant"
                            >
                              <UserPlus className="h-4 w-4 text-green-600" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(device)}
                            className="p-1 rounded hover:bg-gray-100 transition-colors"
                            title="Edit Device"
                          >
                            <Edit className="h-4 w-4 text-gray-600" />
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Device</h3>
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

      {/* Assign to Tenant Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Device{selectedDevices.size > 1 ? 's' : ''} to Tenant
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {selectedDevices.size} device{selectedDevices.size > 1 ? 's' : ''} selected
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Tenant</label>
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} - {tenant.company}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedTenantId('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignToTenant}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}