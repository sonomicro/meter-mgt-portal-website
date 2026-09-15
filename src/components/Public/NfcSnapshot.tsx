import { useEffect } from 'react';
import { Droplets, Activity, BatteryFull, BatteryLow, AlertTriangle, Power, Gauge } from 'lucide-react';
import { supabase } from '../../lib/supabase';

/**
 * Public, unauthenticated landing page opened by tapping a phone on a
 * meter's NFC tag. The meter rewrites the tag's URL with a fresh snapshot
 * on every tap (see sono_board's nfc_controller.c), so everything shown
 * here comes straight from the query string — no login, no backend call
 * needed to render it. It does fire a background call to the
 * `record-nfc-tap` edge function so the tap shows up in the backend, using
 * the anon key (never the service-role key) since the tapper isn't logged
 * in — the function itself holds the service role server-side.
 *
 * Query keys (kept short to fit the NFC tag's ~100-byte URI budget):
 *   t = capture time in seconds — real epoch time once the meter's Notecard
 *       has synced with the cloud, otherwise device uptime as a fallback.
 *       Told apart by magnitude: device uptime can't realistically reach
 *       epoch-scale values (see EPOCH_THRESHOLD below).
 *   d = device hash — 24-bit crc32 of the Notecard UID, as 6 lowercase hex
 *       chars. Computed once on-device (settings_controller.c) and stored
 *       verbatim on the matching devices row by the notehub-webhook, so
 *       record-nfc-tap can resolve it with no separate hashing logic.
 *       Omitted from the URL if the Notecard hasn't reported its UID yet.
 *   f = flow rate, milli-L/min (integer)
 *   v = totalizer, milli-L (integer)
 *   b = battery percent (0-100)
 *   s = status flags bitmask: bit0 = fault, bit1 = on USB
 */

// Any t value at or above this is treated as a real Unix epoch timestamp
// (this threshold is year 2001 — a device would need 31+ years of
// continuous uptime to collide with it).
const EPOCH_THRESHOLD_S = 1_000_000_000;

interface SnapshotData {
  deviceId: string | null;
  captureTimeS: number | null;
  flowRateLpm: number | null;
  totalUsageL: number | null;
  batteryPct: number | null;
  fault: boolean;
  onUsb: boolean;
}

function parseSnapshot(search: string): SnapshotData {
  const params = new URLSearchParams(search);

  const num = (key: string): number | null => {
    const raw = params.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const milli = (key: string): number | null => {
    const n = num(key);
    return n === null ? null : n / 1000;
  };

  const flags = num('s') ?? 0;

  return {
    deviceId: params.get('d'),
    captureTimeS: num('t'),
    flowRateLpm: milli('f'),
    totalUsageL: milli('v'),
    batteryPct: num('b'),
    fault: (flags & 0x1) !== 0,
    onUsb: (flags & 0x2) !== 0,
  };
}

function formatUsage(liters: number): string {
  if (liters >= 1000) {
    return `${(liters / 1000).toFixed(2)} m³`;
  }
  return `${liters.toFixed(1)} L`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatCaptureTime(captureTimeS: number | null): string {
  if (captureTimeS === null) return 'Snapshot captured on tap';
  if (captureTimeS >= EPOCH_THRESHOLD_S) {
    return `Captured ${new Date(captureTimeS * 1000).toLocaleString()}`;
  }
  return `Captured at ${formatUptime(captureTimeS)} device uptime (clock not yet synced)`;
}

function recordTap(): void {
  const data = parseSnapshot(window.location.search);
  if (!data.deviceId) return;

  const deviceHash = parseInt(data.deviceId, 16);
  if (!Number.isFinite(deviceHash)) return;

  const measurementTimestamp =
    data.captureTimeS !== null && data.captureTimeS >= EPOCH_THRESHOLD_S
      ? new Date(data.captureTimeS * 1000).toISOString()
      : undefined;

  // Analytics only — never let a failure here affect the snapshot view.
  supabase.functions
    .invoke('record-nfc-tap', {
      body: {
        device_hash: deviceHash,
        flow_value: data.flowRateLpm,
        flow_unit: 'L/min',
        measurement_timestamp: measurementTimestamp,
        user_agent: navigator.userAgent,
      },
    })
    .catch((err) => {
      console.warn('nfc tap recording failed', err);
    });
}

function batteryTone(pct: number): { bg: string; text: string } {
  if (pct < 20) return { bg: 'bg-red-50', text: 'text-red-600' };
  if (pct < 50) return { bg: 'bg-amber-50', text: 'text-amber-600' };
  return { bg: 'bg-green-50', text: 'text-green-600' };
}

export default function NfcSnapshot() {
  const data = parseSnapshot(window.location.search);
  const hasAnyReading =
    data.flowRateLpm !== null || data.totalUsageL !== null || data.batteryPct !== null;
  const tone = data.batteryPct !== null ? batteryTone(data.batteryPct) : null;

  useEffect(() => {
    recordTap();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-600 mb-3">
            <Droplets className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Meter Snapshot</h1>
          {data.deviceId && <p className="text-sm text-gray-500">Meter {data.deviceId}</p>}
        </div>

        {!hasAnyReading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-sm text-gray-500">
            This link doesn't contain any reading data. Tap the meter again.
          </div>
        ) : (
          <div className="space-y-3">
            {data.fault && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm font-medium">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                Fault detected — check the meter
              </div>
            )}

            {data.flowRateLpm !== null && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Current Flow</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {data.flowRateLpm.toFixed(2)} L/min
                  </p>
                </div>
              </div>
            )}

            {data.totalUsageL !== null && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                  <Gauge className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Usage</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatUsage(data.totalUsageL)}
                  </p>
                </div>
              </div>
            )}

            {data.batteryPct !== null && tone && (
              <div
                className={`rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between ${tone.bg}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                    {data.batteryPct < 20 ? (
                      <BatteryLow className={`w-5 h-5 ${tone.text}`} />
                    ) : (
                      <BatteryFull className={`w-5 h-5 ${tone.text}`} />
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Battery</p>
                    <p className={`text-lg font-semibold ${tone.text}`}>{data.batteryPct}%</p>
                  </div>
                </div>
                {data.onUsb && (
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Power className="w-4 h-4" /> On USB
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          {formatCaptureTime(data.captureTimeS)}
        </p>
      </div>
    </div>
  );
}
