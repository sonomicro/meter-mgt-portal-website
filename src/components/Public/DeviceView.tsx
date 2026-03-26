import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Clock, Activity, LogIn, AlertCircle } from 'lucide-react';

interface DeviceInfo {
  device_id: string;
  device_name: string;
  serial_number: string;
  tenant_id: string;
  tenant_name: string;
  tenant_company: string;
  tenant_logo: string | null;
  tenant_primary_color: string | null;
  tenant_secondary_color: string | null;
  nfc_enabled: boolean;
  public_view_enabled: boolean;
  last_nfc_tap: string | null;
}

interface DeviceViewProps {
  deviceId: string;
  flowValue?: string;
  flowUnit?: string;
  timestamp?: string;
}

export default function DeviceView({ deviceId, flowValue, flowUnit, timestamp }: DeviceViewProps) {
  const navigate = useNavigate();
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapRecorded, setTapRecorded] = useState(false);

  useEffect(() => {
    loadDeviceInfo();
  }, [deviceId]);

  useEffect(() => {
    if (deviceInfo && flowValue && !tapRecorded) {
      recordTap();
    }
  }, [deviceInfo, flowValue, tapRecorded]);

  const loadDeviceInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/public-device-info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId }),
      });

      if (!response.ok) {
        throw new Error('Device not found or not available for public viewing');
      }

      const data = await response.json();
      setDeviceInfo(data.device_info);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load device information');
    } finally {
      setLoading(false);
    }
  };

  const recordTap = async () => {
    if (!deviceInfo || !flowValue) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/record-nfc-tap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device_id: deviceId,
          flow_value: parseFloat(flowValue),
          flow_unit: flowUnit || 'L/min',
          measurement_timestamp: timestamp || new Date().toISOString(),
          user_agent: navigator.userAgent,
        }),
      });

      setTapRecorded(true);
    } catch (err) {
      console.error('Failed to record tap:', err);
    }
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-center text-gray-600 mt-4">Loading device information...</p>
        </div>
      </div>
    );
  }

  if (error || !deviceInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-red-100 rounded-full p-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Device Not Available</h2>
          <p className="text-gray-600 text-center mb-6">
            {error || 'This device is not available for public viewing.'}
          </p>
          <button
            onClick={handleLoginClick}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <LogIn className="h-5 w-5" />
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = deviceInfo.tenant_primary_color || '#2563eb';
  const secondaryColor = deviceInfo.tenant_secondary_color || '#0891b2';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `linear-gradient(135deg, ${primaryColor}15 0%, ${secondaryColor}15 100%)`
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          {deviceInfo.tenant_logo ? (
            <img
              src={deviceInfo.tenant_logo}
              alt={deviceInfo.tenant_company}
              className="h-16 mx-auto mb-4 object-contain"
            />
          ) : (
            <div
              className="h-16 w-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Droplets className="h-8 w-8" style={{ color: primaryColor }} />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {deviceInfo.tenant_company || deviceInfo.tenant_name}
          </h1>
          <p className="text-sm text-gray-500">Water Flow Monitor</p>
        </div>

        {/* Device Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Device:</span>
            <span className="text-sm font-semibold text-gray-900">{deviceInfo.device_name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Serial:</span>
            <span className="text-sm font-mono text-gray-700">{deviceInfo.serial_number}</span>
          </div>
        </div>

        {/* Flow Data */}
        {flowValue ? (
          <div
            className="rounded-xl p-6 mb-6 text-white"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">Current Flow Rate</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-bold">{flowValue}</span>
              <span className="text-2xl font-medium opacity-90">{flowUnit || 'L/min'}</span>
            </div>
            {timestamp && (
              <div className="flex items-center gap-2 mt-4 text-sm opacity-75">
                <Clock className="h-4 w-4" />
                <span>
                  Measured: {new Date(timestamp).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <Droplets className="h-6 w-6 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">No Flow Data Available</p>
                <p className="text-sm text-blue-700">Tap the device to see current readings</p>
              </div>
            </div>
          </div>
        )}

        {/* Information */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> This is a public view of your device. For detailed analytics,
            history, and configuration, please log in to the full portal.
          </p>
        </div>

        {/* Login Button */}
        <button
          onClick={handleLoginClick}
          className="w-full py-3 px-6 rounded-lg text-white font-medium transition-all hover:shadow-lg flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`
          }}
        >
          <LogIn className="h-5 w-5" />
          Access Full Portal
        </button>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Powered by {deviceInfo.tenant_company || deviceInfo.tenant_name}
        </p>
      </div>
    </div>
  );
}
