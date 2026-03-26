import { useState, useEffect } from 'react';
import { Smartphone, MapPin, Clock, Droplets, Filter, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NFCTap {
  id: string;
  device_id: string;
  device_name: string;
  flow_value: number;
  flow_unit: string;
  timestamp: string;
  tap_timestamp: string;
  ip_address: string;
  user_agent: string;
  location: any;
}

interface NFCTapHistoryProps {
  tenantId: string;
}

export default function NFCTapHistory({ tenantId }: NFCTapHistoryProps) {
  const [taps, setTaps] = useState<NFCTap[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDevice, setFilterDevice] = useState<string>('all');
  const [devices, setDevices] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    loadTaps();
    loadDevices();
  }, [tenantId]);

  const loadDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('nfc_enabled', true)
        .order('name');

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const loadTaps = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('nfc_taps')
        .select(`
          id,
          device_id,
          flow_value,
          flow_unit,
          timestamp,
          tap_timestamp,
          ip_address,
          user_agent,
          location,
          devices (name)
        `)
        .eq('tenant_id', tenantId)
        .order('tap_timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      const formattedTaps = (data || []).map((tap: any) => ({
        id: tap.id,
        device_id: tap.device_id,
        device_name: tap.devices?.name || 'Unknown Device',
        flow_value: tap.flow_value,
        flow_unit: tap.flow_unit,
        timestamp: tap.timestamp,
        tap_timestamp: tap.tap_timestamp,
        ip_address: tap.ip_address,
        user_agent: tap.user_agent,
        location: tap.location,
      }));

      setTaps(formattedTaps);
    } catch (error) {
      console.error('Error loading NFC taps:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Time', 'Device', 'Flow Value', 'Unit', 'IP Address'];
    const rows = filteredTaps.map(tap => [
      new Date(tap.tap_timestamp).toLocaleDateString(),
      new Date(tap.tap_timestamp).toLocaleTimeString(),
      tap.device_name,
      tap.flow_value.toFixed(2),
      tap.flow_unit,
      tap.ip_address || 'N/A',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nfc-taps-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredTaps = filterDevice === 'all'
    ? taps
    : taps.filter(tap => tap.device_id === filterDevice);

  const totalTaps = filteredTaps.length;
  const uniqueUsers = new Set(filteredTaps.map(tap => tap.ip_address)).size;
  const avgFlowRate = filteredTaps.length > 0
    ? filteredTaps.reduce((sum, tap) => sum + tap.flow_value, 0) / filteredTaps.length
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NFC Tap History</h1>
          <p className="text-gray-600 mt-1">Track public device interactions</p>
        </div>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="h-5 w-5" />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Smartphone className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Taps</p>
              <p className="text-2xl font-bold text-gray-900">{totalTaps}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <MapPin className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unique Users</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-cyan-100 p-2 rounded-lg">
              <Droplets className="h-6 w-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Flow Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {avgFlowRate.toFixed(1)} <span className="text-sm font-normal">L/min</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterDevice}
            onChange={(e) => setFilterDevice(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Devices</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>{device.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tap List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Flow Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device Info
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTaps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    <Smartphone className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">No NFC taps recorded yet</p>
                    <p className="text-sm">Taps will appear here when users scan your devices</p>
                  </td>
                </tr>
              ) : (
                filteredTaps.map(tap => (
                  <tr key={tap.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {new Date(tap.tap_timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(tap.tap_timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">{tap.device_name}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-cyan-600" />
                        <span className="text-sm font-semibold text-gray-900">
                          {tap.flow_value.toFixed(2)} {tap.flow_unit}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm text-gray-600">{tap.ip_address || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-500 max-w-xs truncate" title={tap.user_agent}>
                        {tap.user_agent ? tap.user_agent.split(' ')[0] : 'N/A'}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How NFC Taps Work</h3>
        <p className="text-sm text-blue-800">
          When users tap their phone on an NFC-enabled device, they're directed to a public landing page
          showing real-time flow data. Each tap is recorded here for your analytics. Users can then
          access the full portal by logging in.
        </p>
      </div>
    </div>
  );
}
