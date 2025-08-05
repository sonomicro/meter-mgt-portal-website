export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'tenant';
  company?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface Device {
  id: string;
  name: string;
  serialNumber: string;
  location: string;
  coordinates?: { lat: number; lon: number };
  tenantId?: string;
  status: 'online' | 'offline' | 'maintenance';
  firmwareVersion: string;
  lastSeen: string;
  batteryLevel: number;
  flowRate: number;
  totalUsage: number;
  installDate: string;
}

export interface WaterUsage {
  id: string;
  deviceId: string;
  timestamp: string;
  flowRate: number;
  totalVolume: number;
  temperature?: number;
  pressure?: number;
}

export interface Tenant {
  id: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  address?: string;
  devicesCount: number;
  totalUsage: number;
  dataUsage: number; // in MB
  monthlyDataUsage: number; // in MB
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  plan: 'basic' | 'professional' | 'enterprise';
}

export interface Alert {
  id: string;
  deviceId: string;
  type: 'leak' | 'low_battery' | 'offline' | 'maintenance';
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
  resolved: boolean;
}