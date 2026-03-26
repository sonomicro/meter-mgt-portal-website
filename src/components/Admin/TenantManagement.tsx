import React, { useState } from 'react';
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, UserPlus, Building, Mail, Phone, Calendar, Filter, MapPin, Activity, Database, Clock, X, AlertTriangle, Key, Webhook, Server } from 'lucide-react';
import { TenantService, DeviceService } from '../../services/database';
import { getTotalDataUsage, getWebhookUsage, getProxyUsage } from '../../services/dataUsage';
import { DeviceFleetAssignmentService } from '../../services/deviceFleetAssignment';
import { supabase } from '../../lib/supabase';
import type { Database as SupabaseDatabase } from '../../lib/supabase';
import type { User } from '../../types';

type Tenant = SupabaseDatabase['public']['Tables']['tenants']['Row'];
type Device = SupabaseDatabase['public']['Tables']['devices']['Row'];

interface TenantManagementProps {
  user: User;
}

export default function TenantManagement({ user }: TenantManagementProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeviceAssignModal, setShowDeviceAssignModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [availableDevices, setAvailableDevices] = useState<Device[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());
  const [newTenant, setNewTenant] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    address: '',
    plan: 'basic' as 'basic' | 'professional' | 'enterprise',
    password: '',
    confirmPassword: ''
  });
  const [totalDevicesCount, setTotalDevicesCount] = useState(0);
  const [totalDataUsageBytes, setTotalDataUsageBytes] = useState(0);
  const [totalWebhookBytes, setTotalWebhookBytes] = useState(0);
  const [totalProxyBytes, setTotalProxyBytes] = useState(0);

  // Load tenants on component mount
  React.useEffect(() => {
    if (user) {
      loadTenants();
      loadTotalDevices();
      loadTotalDataUsage();
      loadWebhookUsage();
      loadProxyUsage();
    }
  }, [user]);

  const loadTenants = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading tenants...');
      const data = await TenantService.getAllTenants();
      console.log('Loaded tenants:', data.length);
      setTenants(data);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tenants');
      // Don't set empty array, keep existing tenants if any
    } finally {
      setLoading(false);
    }
  };

  const loadTotalDevices = async () => {
    try {
      const devices = await DeviceService.getDevices();
      setTotalDevicesCount(devices.length);
    } catch (error) {
      console.error('Error loading total devices:', error);
    }
  };

  const loadTotalDataUsage = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const { totalBytes } = await getTotalDataUsage(startDate, endDate);
      console.log('Total data usage bytes:', totalBytes);
      setTotalDataUsageBytes(totalBytes);
    } catch (error) {
      console.error('Error loading total data usage:', error);
    }
  };

  const loadWebhookUsage = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const webhookData = await getWebhookUsage(startDate, endDate);
      const totalBytes = webhookData.reduce((sum, usage) => sum + Number(usage.bytes_processed), 0);
      console.log('Total webhook bytes:', totalBytes);
      setTotalWebhookBytes(totalBytes);
    } catch (error) {
      console.error('Error loading webhook usage:', error);
    }
  };

  const loadProxyUsage = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const proxyData = await getProxyUsage(startDate, endDate);
      const totalBytes = proxyData.reduce((sum, usage) =>
        sum + Number(usage.bytes_sent) + Number(usage.bytes_received), 0
      );
      console.log('Total proxy bytes:', totalBytes);
      setTotalProxyBytes(totalBytes);
    } catch (error) {
      console.error('Error loading proxy usage:', error);
    }
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tenant.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const handleAddTenant = async () => {
    try {
      if (newTenant.password !== newTenant.confirmPassword) {
        alert('Passwords do not match');
        return;
      }
      
      if (newTenant.password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }
      
      const tenantData = {
        name: newTenant.name,
        email: newTenant.email,
        company: newTenant.company,
        phone: newTenant.phone || null,
        address: newTenant.address || null,
        plan: newTenant.plan,
        password_hash: await hashPassword(newTenant.password)
      };
      
      await TenantService.createTenant(tenantData);
      await loadTenants(); // Reload the list
      setNewTenant({ name: '', email: '', company: '', phone: '', address: '', plan: 'basic', password: '', confirmPassword: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error creating tenant:', error);
      alert('Failed to create tenant. Please try again.');
    }
  };

  const handleUpdateTenant = async () => {
    if (selectedTenant) {
      try {
        const updateData: any = {
          name: newTenant.name,
          email: newTenant.email,
          company: newTenant.company,
          phone: newTenant.phone || null,
          address: newTenant.address || null,
          plan: newTenant.plan
        };
        
        // Only update password if provided
        if (newTenant.password) {
          if (newTenant.password !== newTenant.confirmPassword) {
            alert('Passwords do not match');
            return;
          }

          if (newTenant.password.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
          }

          updateData.password_hash = await hashPassword(newTenant.password);
        }
        
        await TenantService.updateTenant(selectedTenant.id, updateData);
        await loadTenants(); // Reload the list
        setShowEditModal(false);
        setSelectedTenant(null);
        setNewTenant({ name: '', email: '', company: '', phone: '', address: '', plan: 'basic', password: '', confirmPassword: '' });
      } catch (error) {
        console.error('Error updating tenant:', error);
        alert('Failed to update tenant. Please try again.');
      }
    }
  };

  const handleResetPassword = async () => {
    if (!selectedTenant) return;

    try {
      if (newPassword !== confirmNewPassword) {
        alert('Passwords do not match');
        return;
      }

      if (newPassword.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('You must be logged in to perform this action');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: selectedTenant.id,
          newPassword: newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reset password');
      }

      alert('Password reset successfully');
      setShowResetPasswordModal(false);
      setSelectedTenant(null);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert(error instanceof Error ? error.message : 'Failed to reset password. Please try again.');
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (confirm('Are you sure you want to delete this tenant? This action cannot be undone.')) {
      try {
        await TenantService.deleteTenant(tenantId);
        await loadTenants(); // Reload the list
      } catch (error) {
        console.error('Error deleting tenant:', error);
        alert('Failed to delete tenant. Please try again.');
      }
    }
  };

  const toggleTenantStatus = async (tenantId: string) => {
    try {
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant) {
        await TenantService.updateTenant(tenantId, {
          status: tenant.status === 'active' ? 'inactive' : 'active'
        });
        await loadTenants(); // Reload the list
      }
    } catch (error) {
      console.error('Error updating tenant status:', error);
      alert('Failed to update tenant status. Please try again.');
    }
  };

  const handleViewTenant = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowViewModal(true);
    await loadTenantDevices(tenant.id);
  };

  const loadAvailableDevices = async () => {
    try {
      const allDevices = await DeviceService.getDevices();
      const unassignedOrCurrentTenant = allDevices.filter(
        d => !d.tenant_id || d.tenant_id === selectedTenant?.id
      );
      setAvailableDevices(unassignedOrCurrentTenant);
    } catch (error) {
      console.error('Error loading available devices:', error);
    }
  };

  const openDeviceAssignModal = () => {
    loadAvailableDevices();
    setSelectedDeviceIds(new Set());
    setShowDeviceAssignModal(true);
  };

  const handleAssignDevices = async () => {
    if (!selectedTenant || selectedDeviceIds.size === 0) {
      alert('Please select at least one device');
      return;
    }

    try {
      const deviceIds = Array.from(selectedDeviceIds);

      // Use the shared assignment service
      await DeviceFleetAssignmentService.assignDevicesToTenant(
        deviceIds,
        selectedTenant.id,
        selectedTenant.company
      );

      setSelectedDeviceIds(new Set());
      setShowDeviceAssignModal(false);
      await loadTenants();
      await loadTenantDevices(selectedTenant.id);
      alert(`Successfully assigned ${deviceIds.length} device(s) to ${selectedTenant.name}`);
    } catch (error) {
      console.error('Error assigning devices:', error);
      alert('Failed to assign devices. Please try again.');
    }
  };

  const handleUnassignDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to unassign this device?')) {
      return;
    }

    try {
      // Use the shared unassignment service
      await DeviceFleetAssignmentService.unassignDeviceFromTenant(deviceId);

      await loadTenants();
      if (selectedTenant) {
        await loadTenantDevices(selectedTenant.id);
      }
      console.log('✅ Device unassignment complete');
    } catch (error) {
      console.error('❌ Error unassigning device:', error);
      alert('Failed to unassign device. Please try again.');
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewTenant({
      name: tenant.name,
      email: tenant.email,
      company: tenant.company,
      phone: tenant.phone || '',
      address: tenant.address || '',
      plan: tenant.plan,
      password: '',
      confirmPassword: ''
    });
    setShowEditModal(true);
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-gray-100 text-gray-800';
      case 'professional': return 'bg-blue-100 text-blue-800';
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDataUsage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const [tenantDevices, setTenantDevices] = useState<{ [key: string]: Device[] }>({});

  // Load devices for a specific tenant
  const loadTenantDevices = async (tenantId: string) => {
    try {
      const devices = await DeviceService.getDevices(tenantId);
      setTenantDevices(prev => ({ ...prev, [tenantId]: devices }));
    } catch (error) {
      console.error('Error loading tenant devices:', error);
    }
  };

  const getTenantDevices = (tenantId: string) => {
    return tenantDevices[tenantId] || [];
  };

  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.status === 'active').length;
  const totalDataUsage = totalDataUsageBytes;
  const totalDevices = totalDevicesCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tenant Management</h2>
          <p className="text-gray-600">Manage customer accounts and access</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Tenant</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error Loading Tenants</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-blue-100">
              <Building className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{totalTenants}</p>
            <p className="text-sm text-gray-600">Total Tenants</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-green-100">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{activeTenants}</p>
            <p className="text-sm text-gray-600">Active Tenants</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-teal-100">
              <Activity className="h-6 w-6 text-teal-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{totalDevices}</p>
            <p className="text-sm text-gray-600">Total Devices</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-purple-100">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{formatBytes(totalDataUsage)}</p>
            <p className="text-sm text-gray-600">Cellular Data (30 days)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-orange-100">
              <Webhook className="h-6 w-6 text-orange-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{formatBytes(totalWebhookBytes)}</p>
            <p className="text-sm text-gray-600">Webhook Traffic (30 days)</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 rounded-lg bg-cyan-100">
              <Server className="h-6 w-6 text-cyan-600" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 mb-1">{formatBytes(totalProxyBytes)}</p>
            <p className="text-sm text-gray-600">Proxy Traffic (30 days)</p>
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
                placeholder="Search tenants..."
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Plans</option>
              <option value="basic">Basic</option>
              <option value="professional">Professional</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading tenants...</span>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-3 font-medium text-gray-900 w-48">Tenant</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-32">Company</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-24">Plan</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-16">Devices</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-20">Usage</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-20">Data</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-20">Status</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-20">Login</th>
                <th className="text-left py-3 px-2 font-medium text-gray-900 w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50">
                  <td className="py-4 px-3">
                    <div>
                      <p className="font-medium text-gray-900">{tenant.name}</p>
                      <p className="text-sm text-gray-500">{tenant.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="max-w-28">
                      <p className="text-gray-900 truncate text-sm" title={tenant.company}>{tenant.company}</p>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <span className={`px-2 py-1 rounded-full text-sm font-medium capitalize ${getPlanColor(tenant.plan)}`}>
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <span className="bg-blue-100 text-blue-800 px-1 py-1 rounded text-xs font-medium">
                      {tenant.devicesCount}
                    </span>
                  </td>
                  <td className="py-4 px-2">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{(tenant.totalUsage / 1000).toFixed(1)}kL</p>
                      <p className="text-xs text-gray-500">water</p>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{formatDataUsage(tenant.monthlyDataUsage)}</p>
                      <p className="text-xs text-gray-500">month</p>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <button
                      onClick={() => toggleTenantStatus(tenant.id)}
                      className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                        tenant.status === 'active' 
                          ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {tenant.status}
                    </button>
                  </td>
                  <td className="py-4 px-2">
                    <div>
                      <p className="text-xs text-gray-500">
                        {tenant.lastLogin ? new Date(tenant.lastLogin).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => handleViewTenant(tenant)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </button>
                      <button 
                        onClick={() => handleEditTenant(tenant)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Edit Tenant"
                      >
                        <Edit className="h-4 w-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTenant(tenant);
                          setShowResetPasswordModal(true);
                        }}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Reset Password"
                      >
                        <Key className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDeleteTenant(tenant.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                        title="Delete Tenant"
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

      {/* View Tenant Details Modal */}
      {showViewModal && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Tenant Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Contact Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">{selectedTenant.email}</span>
                    </div>
                    {selectedTenant.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{selectedTenant.phone}</span>
                      </div>
                    )}
                    {selectedTenant.address && (
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span className="text-sm text-gray-900">{selectedTenant.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Account Information</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Plan:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getPlanColor(selectedTenant.plan)}`}>
                        {selectedTenant.plan}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Status:</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedTenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedTenant.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm text-gray-900">{new Date(selectedTenant.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Login:</span>
                      <span className="text-sm text-gray-900">
                        {selectedTenant.lastLogin ? new Date(selectedTenant.lastLogin).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Usage Statistics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Devices:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedTenant.devicesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Water Usage:</span>
                      <span className="text-sm font-medium text-gray-900">{selectedTenant.totalUsage.toLocaleString()}L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Data Usage (Total):</span>
                      <span className="text-sm font-medium text-gray-900">{formatDataUsage(selectedTenant.dataUsage)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Data Usage (Monthly):</span>
                      <span className="text-sm font-medium text-gray-900">{formatDataUsage(selectedTenant.monthlyDataUsage)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700">Device Details</h4>
                    <button
                      onClick={openDeviceAssignModal}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Devices</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {getTenantDevices(selectedTenant.id).map((device) => (
                      <div key={device.id} className="flex items-center justify-between p-2 bg-gray-50 rounded group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate" title={device.device_id}>
                            {device.device_id}
                          </p>
                          {device.alias && (
                            <p className="text-xs text-blue-600 font-medium">{device.alias}</p>
                          )}
                          <p className="text-xs text-gray-500">{device.name}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-right">
                            <p className={`text-xs font-medium ${
                              device.status === 'online' ? 'text-green-600' :
                              device.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                            }`}>
                              {device.status}
                            </p>
                            <p className="text-xs text-gray-500">{device.battery_level}% battery</p>
                          </div>
                          <button
                            onClick={() => handleUnassignDevice(device.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 transition-all"
                            title="Unassign Device"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {getTenantDevices(selectedTenant.id).length === 0 && (
                      <p className="text-sm text-gray-500 italic">No devices assigned</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditTenant(selectedTenant);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Edit Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tenant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Tenant</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({...newTenant, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={newTenant.company}
                  onChange={(e) => setNewTenant({...newTenant, company: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newTenant.phone}
                  onChange={(e) => setNewTenant({...newTenant, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={newTenant.password}
                  onChange={(e) => setNewTenant({...newTenant, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={newTenant.confirmPassword}
                  onChange={(e) => setNewTenant({...newTenant, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={newTenant.plan}
                  onChange={(e) => setNewTenant({...newTenant, plan: e.target.value as 'basic' | 'professional' | 'enterprise'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
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
                onClick={handleAddTenant}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tenant Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Tenant</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({...newTenant, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
                <input
                  type="text"
                  value={newTenant.company}
                  onChange={(e) => setNewTenant({...newTenant, company: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={newTenant.phone}
                  onChange={(e) => setNewTenant({...newTenant, phone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={newTenant.password}
                  onChange={(e) => setNewTenant({...newTenant, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={newTenant.confirmPassword}
                  onChange={(e) => setNewTenant({...newTenant, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={newTenant.plan}
                  onChange={(e) => setNewTenant({...newTenant, plan: e.target.value as 'basic' | 'professional' | 'enterprise'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
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
                onClick={handleUpdateTenant}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Update Tenant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Reset Password</h3>
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedTenant(null);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Reset password for <span className="font-semibold">{selectedTenant.name}</span> ({selectedTenant.email})
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowResetPasswordModal(false);
                  setSelectedTenant(null);
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Key className="h-4 w-4" />
                <span>Reset Password</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device Assignment Modal */}
      {showDeviceAssignModal && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Devices to {selectedTenant.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Select devices to assign to this tenant. Only unassigned devices are shown.
            </p>

            {availableDevices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No available devices to assign</p>
              </div>
            ) : (
              <div className="space-y-2 mb-4">
                {availableDevices.map((device) => (
                  <div
                    key={device.id}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDeviceIds.has(device.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      const newSelection = new Set(selectedDeviceIds);
                      if (newSelection.has(device.id)) {
                        newSelection.delete(device.id);
                      } else {
                        newSelection.add(device.id);
                      }
                      setSelectedDeviceIds(newSelection);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedDeviceIds.has(device.id)}
                        onChange={() => {}}
                        className="rounded border-gray-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{device.name}</p>
                        <p className="text-xs text-gray-500">{device.device_id} - {device.location}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium ${
                        device.status === 'online' ? 'text-green-600' :
                        device.status === 'offline' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {device.status}
                      </p>
                      <p className="text-xs text-gray-500">{device.battery_level}% battery</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                {selectedDeviceIds.size} device{selectedDeviceIds.size !== 1 ? 's' : ''} selected
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeviceAssignModal(false);
                    setSelectedDeviceIds(new Set());
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignDevices}
                  disabled={selectedDeviceIds.size === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign Devices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}