import React, { useState, useEffect } from 'react';
import { Save, User, Bell, Shield, Key, Mail, Phone, Building, Settings, AlertTriangle, Upload, Image } from 'lucide-react';
import { supabaseServiceRole, supabase } from '../../lib/supabase';
import { getCurrentUser } from '../../services/auth';
import { TenantService } from '../../services/database';
import type { Database } from '../../lib/supabase';

type Device = Database['public']['Tables']['devices']['Row'];
type LeakDetectionSetting = Database['public']['Tables']['leak_detection_settings']['Row'];

export default function TenantSettings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState({
    name: 'John Smith',
    email: 'john@acmecorp.com',
    phone: '+1 (555) 123-4567',
    company: 'ACME Corporation',
    address: '123 Business Ave, Suite 100',
    city: 'New York',
    state: 'NY',
    zipCode: '10001',
    timezone: 'EST',
    emailNotifications: true,
    smsAlerts: false,
    weeklyReports: true,
    maintenanceAlerts: true,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [devices, setDevices] = useState<Device[]>([]);
  const [leakDetectionSettings, setLeakDetectionSettings] = useState<LeakDetectionSetting[]>([]);
  const [globalLeakDetection, setGlobalLeakDetection] = useState({
    enabled: true,
    flowDurationThreshold: 6,
    minFlowRateThreshold: 1.0,
    noFlowEnabled: true,
    noFlowDurationThreshold: 1,
    maxFlowRateThreshold: 0.1
  });
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deviceThresholdEdits, setDeviceThresholdEdits] = useState<Record<string, {
    flowDurationThreshold: number;
    minFlowRateThreshold: number;
    noFlowDurationThreshold: number;
    maxFlowRateThreshold: number;
  }>>({});

  useEffect(() => {
    loadDevicesAndSettings();
    loadTenantCustomization();
  }, []);

  const loadTenantCustomization = async () => {
    try {
      const user = await getCurrentUser();
      if (!user || user.role !== 'tenant') return;

      const tenant = await TenantService.getTenant(user.id);
      if (tenant?.logo_url) {
        setLogoUrl(tenant.logo_url);
      }
    } catch (error) {
      console.error('Error loading tenant customization:', error);
    }
  };

  const loadDevicesAndSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user || user.role !== 'tenant' || !supabaseServiceRole) return;

      const { data: userDevices } = await supabaseServiceRole
        .rpc('get_devices_with_status', { filter_tenant_id: user.id });

      setDevices(userDevices || []);

      const { data: leakSettings } = await supabaseServiceRole
        .from('leak_detection_settings')
        .select('*')
        .eq('tenant_id', user.id);

      setLeakDetectionSettings(leakSettings || []);

      const globalSetting = leakSettings?.find(s => s.device_id === null);
      if (globalSetting) {
        setGlobalLeakDetection({
          enabled: globalSetting.enabled,
          flowDurationThreshold: globalSetting.flow_duration_threshold,
          minFlowRateThreshold: Number(globalSetting.min_flow_rate_threshold),
          noFlowEnabled: globalSetting.no_flow_enabled,
          noFlowDurationThreshold: globalSetting.no_flow_duration_threshold,
          maxFlowRateThreshold: Number(globalSetting.max_flow_rate_threshold)
        });
      }
    } catch (error) {
      console.error('Error loading devices and settings:', error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    try {
      setUploadingLogo(true);
      console.log('Getting current user...');
      const user = await getCurrentUser();
      console.log('Current user:', user);

      if (!user) {
        alert('Authentication error: No user found. Please log in again.');
        return;
      }

      if (user.role !== 'tenant') {
        alert('Authentication error: Only tenants can upload logos.');
        return;
      }

      if (!supabaseServiceRole) {
        alert('Storage service not available. Please contact support.');
        return;
      }

      const tenantId = user.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/logo.${fileExt}`;
      console.log('Uploading file:', fileName);

      const { data: uploadData, error: uploadError } = await supabaseServiceRole.storage
        .from('tenant-logos')
        .upload(fileName, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        alert('Failed to upload logo: ' + uploadError.message);
        return;
      }

      console.log('Upload successful:', uploadData);

      const { data: publicUrlData } = supabaseServiceRole.storage
        .from('tenant-logos')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData.publicUrl;
      console.log('Public URL:', publicUrl);

      const { error: updateError } = await supabaseServiceRole
        .from('tenants')
        .update({ logo_url: publicUrl })
        .eq('id', tenantId);

      if (updateError) {
        console.error('Update error:', updateError);
        alert('Failed to update logo URL: ' + updateError.message);
        return;
      }

      console.log('Tenant updated successfully');
      setLogoUrl(publicUrl);
      alert('Logo uploaded successfully!');

      window.location.reload();
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo: ' + (error as Error).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoRemove = async () => {
    try {
      setUploadingLogo(true);
      const user = await getCurrentUser();
      if (!user || user.role !== 'tenant') {
        alert('Authentication error');
        return;
      }

      if (!supabaseServiceRole) {
        alert('Storage service not available');
        return;
      }

      const tenantId = user.id;

      const { error: updateError } = await supabaseServiceRole
        .from('tenants')
        .update({ logo_url: null })
        .eq('id', tenantId);

      if (updateError) {
        console.error('Update error:', updateError);
        alert('Failed to remove logo');
        return;
      }

      setLogoUrl(null);
      alert('Logo removed successfully!');

      window.location.reload();
    } catch (error) {
      console.error('Error removing logo:', error);
      alert('Failed to remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'company', label: 'Company Info', icon: Building },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'advanced', label: 'Advanced', icon: Settings },
  ];

  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => handleSettingChange('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={settings.email}
            onChange={(e) => handleSettingChange('email', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          <input
            type="tel"
            value={settings.phone}
            onChange={(e) => handleSettingChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
          <select
            value={settings.timezone}
            onChange={(e) => handleSettingChange('timezone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="EST">Eastern Time (EST)</option>
            <option value="CST">Central Time (CST)</option>
            <option value="MST">Mountain Time (MST)</option>
            <option value="PST">Pacific Time (PST)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
          <User className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm">
            Upload Photo
          </button>
          <p className="text-sm text-gray-500 mt-1">JPG, PNG up to 2MB</p>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Mail className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Email Notifications</p>
            <p className="text-sm text-gray-500">Receive alerts and updates via email</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.emailNotifications}
            onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Phone className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">SMS Alerts</p>
            <p className="text-sm text-gray-500">Receive critical alerts via SMS</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings.smsAlerts}
            onChange={(e) => handleSettingChange('smsAlerts', e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      
      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-3">Notification Preferences</h4>
        <div className="space-y-2">
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={settings.weeklyReports}
              onChange={(e) => handleSettingChange('weeklyReports', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
            />
            <span className="ml-2 text-sm text-blue-700">Weekly usage reports</span>
          </label>
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={settings.maintenanceAlerts}
              onChange={(e) => handleSettingChange('maintenanceAlerts', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
            />
            <span className="ml-2 text-sm text-blue-700">Maintenance reminders</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="ml-2 text-sm text-blue-700">Device offline alerts</span>
          </label>
          <label className="flex items-center">
            <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            <span className="ml-2 text-sm text-blue-700">Low battery warnings</span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-4">Change Password</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              value={settings.currentPassword}
              onChange={(e) => handleSettingChange('currentPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              value={settings.newPassword}
              onChange={(e) => handleSettingChange('newPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={settings.confirmPassword}
              onChange={(e) => handleSettingChange('confirmPassword', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-yellow-50 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <Key className="h-4 w-4 text-yellow-600" />
          <h4 className="text-sm font-medium text-yellow-900">Two-Factor Authentication</h4>
        </div>
        <p className="text-sm text-yellow-700 mb-3">Add an extra layer of security to your account</p>
        <button className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors text-sm">
          Enable 2FA
        </button>
      </div>
      
      <div className="p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Active Sessions</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Current Session</p>
              <p className="text-xs text-gray-500">Chrome on Windows • New York, NY</p>
            </div>
            <span className="text-xs text-green-600 font-medium">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">Mobile App</p>
              <p className="text-xs text-gray-500">iOS App • Last seen 2 hours ago</p>
            </div>
            <button className="text-xs text-red-600 hover:text-red-700">Revoke</button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCompanySettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
        <input
          type="text"
          value={settings.company}
          onChange={(e) => handleSettingChange('company', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
        <input
          type="text"
          value={settings.address}
          onChange={(e) => handleSettingChange('address', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
          <input
            type="text"
            value={settings.city}
            onChange={(e) => handleSettingChange('city', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
          <input
            type="text"
            value={settings.state}
            onChange={(e) => handleSettingChange('state', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
          <input
            type="text"
            value={settings.zipCode}
            onChange={(e) => handleSettingChange('zipCode', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Account Information</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-blue-700">Account ID</p>
            <p className="font-mono text-blue-900">ACM-2024-001</p>
          </div>
          <div>
            <p className="text-blue-700">Plan</p>
            <p className="text-blue-900">Professional</p>
          </div>
          <div>
            <p className="text-blue-700">Devices Limit</p>
            <p className="text-blue-900">50 devices</p>
          </div>
          <div>
            <p className="text-blue-700">Data Retention</p>
            <p className="text-blue-900">24 months</p>
          </div>
        </div>
      </div>
    </div>
  );

  const toggleDeviceLeakDetection = async (deviceId: string, enabled: boolean) => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseServiceRole) return;

      const existingSetting = leakDetectionSettings.find(s => s.device_id === deviceId);

      if (existingSetting) {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .update({ enabled })
          .eq('id', existingSetting.id);
      } else {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .insert({
            tenant_id: user.id,
            device_id: deviceId,
            enabled,
            flow_duration_threshold: globalLeakDetection.flowDurationThreshold,
            min_flow_rate_threshold: globalLeakDetection.minFlowRateThreshold
          });
      }

      await loadDevicesAndSettings();
    } catch (error) {
      console.error('Error updating device leak detection:', error);
    }
  };

  const toggleDeviceNoFlowDetection = async (deviceId: string, noFlowEnabled: boolean) => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseServiceRole) return;

      const existingSetting = leakDetectionSettings.find(s => s.device_id === deviceId);

      if (existingSetting) {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .update({ no_flow_enabled: noFlowEnabled })
          .eq('id', existingSetting.id);
      } else {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .insert({
            tenant_id: user.id,
            device_id: deviceId,
            enabled: globalLeakDetection.enabled,
            flow_duration_threshold: globalLeakDetection.flowDurationThreshold,
            min_flow_rate_threshold: globalLeakDetection.minFlowRateThreshold,
            no_flow_enabled: noFlowEnabled,
            no_flow_duration_threshold: globalLeakDetection.noFlowDurationThreshold,
            max_flow_rate_threshold: globalLeakDetection.maxFlowRateThreshold
          });
      }

      await loadDevicesAndSettings();
    } catch (error) {
      console.error('Error updating device no-flow detection:', error);
    }
  };

  const saveDeviceLeakThresholds = async (deviceId: string) => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseServiceRole) return;

      const edit = deviceThresholdEdits[deviceId];
      if (!edit) return;

      const existingSetting = leakDetectionSettings.find(s => s.device_id === deviceId);

      if (existingSetting) {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .update({
            flow_duration_threshold: edit.flowDurationThreshold,
            min_flow_rate_threshold: edit.minFlowRateThreshold,
            no_flow_duration_threshold: edit.noFlowDurationThreshold,
            max_flow_rate_threshold: edit.maxFlowRateThreshold
          })
          .eq('id', existingSetting.id);
      } else {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .insert({
            tenant_id: user.id,
            device_id: deviceId,
            enabled: globalLeakDetection.enabled,
            flow_duration_threshold: edit.flowDurationThreshold,
            min_flow_rate_threshold: edit.minFlowRateThreshold,
            no_flow_enabled: globalLeakDetection.noFlowEnabled,
            no_flow_duration_threshold: edit.noFlowDurationThreshold,
            max_flow_rate_threshold: edit.maxFlowRateThreshold
          });
      }

      await loadDevicesAndSettings();
    } catch (error) {
      console.error('Error saving device leak thresholds:', error);
      alert('Failed to save device thresholds');
    }
  };

  const saveGlobalLeakDetection = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user || !supabaseServiceRole) return;

      const globalSetting = leakDetectionSettings.find(s => s.device_id === null);

      if (globalSetting) {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .update({
            enabled: globalLeakDetection.enabled,
            flow_duration_threshold: globalLeakDetection.flowDurationThreshold,
            min_flow_rate_threshold: globalLeakDetection.minFlowRateThreshold,
            no_flow_enabled: globalLeakDetection.noFlowEnabled,
            no_flow_duration_threshold: globalLeakDetection.noFlowDurationThreshold,
            max_flow_rate_threshold: globalLeakDetection.maxFlowRateThreshold
          })
          .eq('id', globalSetting.id);
      } else {
        await supabaseServiceRole
          .from('leak_detection_settings')
          .insert({
            tenant_id: user.id,
            device_id: null,
            enabled: globalLeakDetection.enabled,
            flow_duration_threshold: globalLeakDetection.flowDurationThreshold,
            min_flow_rate_threshold: globalLeakDetection.minFlowRateThreshold,
            no_flow_enabled: globalLeakDetection.noFlowEnabled,
            no_flow_duration_threshold: globalLeakDetection.noFlowDurationThreshold,
            max_flow_rate_threshold: globalLeakDetection.maxFlowRateThreshold
          });
      }

      await loadDevicesAndSettings();
      alert('Leak detection settings saved successfully!');
    } catch (error) {
      console.error('Error saving global leak detection:', error);
      alert('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const renderBrandingSettings = () => (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Company Branding</h3>
        <p className="text-sm text-blue-700">
          Customize your dashboard with your company logo to create a personalized experience.
        </p>
      </div>

      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Company Logo</h4>
        <p className="text-sm text-gray-600 mb-6">
          Upload your company logo. It will appear in the header when you're logged in.
        </p>

        <div className="flex items-start space-x-6">
          <div className="flex-shrink-0">
            {logoUrl ? (
              <div className="relative">
                <img
                  src={logoUrl}
                  alt="Company Logo"
                  className="h-24 w-auto max-w-[200px] object-contain border border-gray-200 rounded-lg p-2"
                />
              </div>
            ) : (
              <div className="h-24 w-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                <Image className="h-12 w-12 text-gray-400" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                onChange={handleLogoUpload}
                disabled={uploadingLogo}
                className="hidden"
              />
              <label
                htmlFor="logo-upload"
                className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                  uploadingLogo
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                <Upload className="h-4 w-4" />
                <span>{uploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
              </label>
            </div>

            {logoUrl && (
              <button
                onClick={handleLogoRemove}
                disabled={uploadingLogo}
                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                Remove Logo
              </button>
            )}

            <div className="text-sm text-gray-500">
              <p>• Recommended: PNG or JPG format</p>
              <p>• Maximum file size: 2MB</p>
              <p>• Optimal dimensions: 200x50 pixels</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-center space-x-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-amber-900">Leak Detection Settings</h3>
        </div>
        <p className="text-sm text-amber-700">
          Configure how the system detects potential water leaks. These settings help prevent false alarms in industrial environments with continuous water flow.
        </p>
      </div>

      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Global Settings</h4>
        <p className="text-sm text-gray-600 mb-4">These settings apply to all devices unless overridden individually.</p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable Leak Detection</p>
              <p className="text-sm text-gray-500">Turn on automatic leak detection for all devices</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={globalLeakDetection.enabled}
                onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, enabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Flow Duration Threshold (hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={globalLeakDetection.flowDurationThreshold}
              onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, flowDurationThreshold: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Alert after continuous flow for this many hours</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Flow Rate (L/min)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={globalLeakDetection.minFlowRateThreshold}
              onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, minFlowRateThreshold: parseFloat(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Only consider flow rates above this threshold</p>
          </div>

          <div className="border-t border-gray-200 pt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Enable No-Flow Alert</p>
              <p className="text-sm text-gray-500">Alert when flow drops out for devices that should always be running</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={globalLeakDetection.noFlowEnabled}
                onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, noFlowEnabled: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              No-Flow Duration Threshold (hours)
            </label>
            <input
              type="number"
              min="1"
              max="168"
              value={globalLeakDetection.noFlowDurationThreshold}
              onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, noFlowDurationThreshold: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Alert after flow stays at or below the floor for this many hours</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Flow Rate for "No Flow" (L/min)
            </label>
            <input
              type="number"
              min="0"
              step="0.1"
              value={globalLeakDetection.maxFlowRateThreshold}
              onChange={(e) => setGlobalLeakDetection(prev => ({ ...prev, maxFlowRateThreshold: parseFloat(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Flow at or below this counts as "no flow"</p>
          </div>

          <button
            onClick={saveGlobalLeakDetection}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Global Settings'}
          </button>
        </div>
      </div>

      <div className="p-6 bg-white border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Per-Device Settings</h4>
        <p className="text-sm text-gray-600 mb-4">Override leak detection for individual devices.</p>

        {devices.length === 0 ? (
          <p className="text-sm text-gray-500">No devices found.</p>
        ) : (
          <div className="space-y-3">
            {devices.map(device => {
              const deviceSetting = leakDetectionSettings.find(s => s.device_id === device.id);
              const isEnabled = deviceSetting ? deviceSetting.enabled : globalLeakDetection.enabled;
              const isNoFlowEnabled = deviceSetting ? deviceSetting.no_flow_enabled : globalLeakDetection.noFlowEnabled;
              const edit = deviceThresholdEdits[device.id];
              const effectiveThreshold = edit?.flowDurationThreshold ?? deviceSetting?.flow_duration_threshold ?? globalLeakDetection.flowDurationThreshold;
              const effectiveMinRate = edit?.minFlowRateThreshold ?? (deviceSetting ? Number(deviceSetting.min_flow_rate_threshold) : globalLeakDetection.minFlowRateThreshold);
              const effectiveNoFlowThreshold = edit?.noFlowDurationThreshold ?? deviceSetting?.no_flow_duration_threshold ?? globalLeakDetection.noFlowDurationThreshold;
              const effectiveMaxFlowRate = edit?.maxFlowRateThreshold ?? (deviceSetting ? Number(deviceSetting.max_flow_rate_threshold) : globalLeakDetection.maxFlowRateThreshold);

              const setEdit = (updates: Partial<{
                flowDurationThreshold: number;
                minFlowRateThreshold: number;
                noFlowDurationThreshold: number;
                maxFlowRateThreshold: number;
              }>) => {
                setDeviceThresholdEdits(prev => ({
                  ...prev,
                  [device.id]: {
                    flowDurationThreshold: effectiveThreshold,
                    minFlowRateThreshold: effectiveMinRate,
                    noFlowDurationThreshold: effectiveNoFlowThreshold,
                    maxFlowRateThreshold: effectiveMaxFlowRate,
                    ...updates
                  }
                }));
              };

              return (
                <div key={device.id} className="p-3 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{device.name}</p>
                    <p className="text-xs text-gray-500">{device.location}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Leak (Continuous Flow) Alert</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) => toggleDeviceLeakDetection(device.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Flow Duration Threshold (hours)</label>
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={effectiveThreshold}
                        onChange={(e) => setEdit({ flowDurationThreshold: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Minimum Flow Rate (L/min)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={effectiveMinRate}
                        onChange={(e) => setEdit({ minFlowRateThreshold: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-xs font-medium text-gray-600">No-Flow Alert</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isNoFlowEnabled}
                        onChange={(e) => toggleDeviceNoFlowDetection(device.id, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">No-Flow Duration Threshold (hours)</label>
                      <input
                        type="number"
                        min="1"
                        max="168"
                        value={effectiveNoFlowThreshold}
                        onChange={(e) => setEdit({ noFlowDurationThreshold: parseInt(e.target.value) || 1 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Max Flow Rate for "No Flow" (L/min)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={effectiveMaxFlowRate}
                        onChange={(e) => setEdit({ maxFlowRateThreshold: parseFloat(e.target.value) || 0 })}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {edit && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          saveDeviceLeakThresholds(device.id);
                          setDeviceThresholdEdits(prev => {
                            const next = { ...prev };
                            delete next[device.id];
                            return next;
                          });
                        }}
                        className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Save Thresholds
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileSettings();
      case 'notifications': return renderNotificationSettings();
      case 'security': return renderSecuritySettings();
      case 'company': return renderCompanySettings();
      case 'branding': return renderBrandingSettings();
      case 'advanced': return renderAdvancedSettings();
      default: return renderProfileSettings();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h2>
        <p className="text-gray-600">Manage your account preferences and security settings</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {renderTabContent()}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}