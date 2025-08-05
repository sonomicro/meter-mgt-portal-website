import { WaterUsage, Alert, Device } from '../types';

export const mockTenants = [
  {
    id: '1',
    name: 'Acme Corporation',
    email: 'admin@acme.com',
    company: 'Acme Corporation',
    phone: '+1-555-0123',
    address: '123 Business St, City, State 12345',
    plan: 'enterprise',
    status: 'active',
    created_at: '2024-01-15T08:00:00Z',
    last_login: '2024-12-19T10:30:00Z',
    devicesCount: 5,
    totalUsage: 12500,
    dataUsage: 850,
    monthlyDataUsage: 120
  },
  {
    id: '2',
    name: 'Tech Solutions Inc',
    email: 'contact@techsolutions.com',
    company: 'Tech Solutions Inc',
    phone: '+1-555-0456',
    address: '456 Innovation Ave, Tech City, TC 67890',
    plan: 'professional',
    status: 'active',
    created_at: '2024-02-20T09:15:00Z',
    last_login: '2024-12-18T14:45:00Z',
    devicesCount: 3,
    totalUsage: 8750,
    dataUsage: 620,
    monthlyDataUsage: 95
  },
  {
    id: '3',
    name: 'Green Energy Co',
    email: 'info@greenenergy.com',
    company: 'Green Energy Co',
    phone: '+1-555-0789',
    address: '789 Eco Blvd, Green Valley, GV 13579',
    plan: 'basic',
    status: 'active',
    created_at: '2024-03-10T11:20:00Z',
    last_login: '2024-12-17T16:00:00Z',
    devicesCount: 2,
    totalUsage: 4200,
    dataUsage: 280,
    monthlyDataUsage: 45
  }
];

export const mockDevices: Device[] = [
  {
    id: '1',
    device_id: 'WM-001',
    serial_number: 'SN123456789',
    name: 'Main Building Meter',
    location: 'Building A - Basement',
    coordinates: { lat: 40.7128, lng: -74.0060 },
    tenant_id: '1',
    status: 'online',
    firmware_version: '2.1.0',
    last_seen: '2024-12-19T12:00:00Z',
    battery_level: 85,
    flow_rate: 12.5,
    total_usage: 3456.78,
    install_date: '2024-01-15',
    notehub_device_uid: 'dev:123456789',
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    id: '2',
    device_id: 'WM-002',
    serial_number: 'SN987654321',
    name: 'Secondary Meter',
    location: 'Building B - Utility Room',
    coordinates: { lat: 40.7589, lng: -73.9851 },
    tenant_id: '1',
    status: 'offline',
    firmware_version: '2.0.5',
    last_seen: '2024-12-17T08:30:00Z',
    battery_level: 23,
    flow_rate: 0,
    total_usage: 2134.56,
    install_date: '2024-02-01',
    notehub_device_uid: 'dev:987654321',
    created_at: '2024-02-01T10:00:00Z'
  },
  {
    id: '3',
    device_id: 'WM-003',
    serial_number: 'SN456789123',
    name: 'Irrigation Monitor',
    location: 'Garden Area - Zone 1',
    coordinates: { lat: 40.7831, lng: -73.9712 },
    tenant_id: '2',
    status: 'online',
    firmware_version: '2.1.0',
    last_seen: '2024-12-19T11:45:00Z',
    battery_level: 92,
    flow_rate: 8.7,
    total_usage: 1876.43,
    install_date: '2024-03-15',
    notehub_device_uid: 'dev:456789123',
    created_at: '2024-03-15T14:30:00Z'
  },
  {
    id: '4',
    device_id: 'WM-004',
    serial_number: 'SN789123456',
    name: 'Emergency Backup',
    location: 'Building C - Emergency Systems',
    coordinates: { lat: 40.7505, lng: -73.9934 },
    tenant_id: '3',
    status: 'maintenance',
    firmware_version: '1.9.8',
    last_seen: '2024-12-18T16:20:00Z',
    battery_level: 67,
    flow_rate: 0,
    total_usage: 987.65,
    install_date: '2024-04-01',
    notehub_device_uid: 'dev:789123456',
    created_at: '2024-04-01T09:15:00Z'
  }
];

export const mockWaterUsage: WaterUsage[] = [
  { id: '1', deviceId: '1', timestamp: '2024-12-19T00:00:00Z', flowRate: 0, totalVolume: 3456 },
  { id: '2', deviceId: '1', timestamp: '2024-12-19T06:00:00Z', flowRate: 15.2, totalVolume: 3471 },
  { id: '3', deviceId: '1', timestamp: '2024-12-19T12:00:00Z', flowRate: 12.5, totalVolume: 3483 },
  { id: '4', deviceId: '1', timestamp: '2024-12-19T18:00:00Z', flowRate: 8.7, totalVolume: 3492 },
];

export const mockAlerts: Alert[] = [
  {
    id: '1',
    deviceId: '1',
    type: 'low_battery',
    message: 'Battery level below 25%',
    severity: 'high',
    timestamp: '2024-12-19T08:30:00Z',
    resolved: false
  },
  {
    id: '2',
    deviceId: '2',
    type: 'offline',
    message: 'Device has been offline for 2 days',
    severity: 'high',
    timestamp: '2024-12-17T09:15:00Z',
    resolved: false
  },
  {
    id: '3',
    deviceId: '1',
    type: 'maintenance',
    message: 'Scheduled maintenance due',
    severity: 'medium',
    timestamp: '2024-12-19T10:00:00Z',
    resolved: true
  }
]