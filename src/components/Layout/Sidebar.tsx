import React from 'react';
import { 
  BarChart3, 
  Users, 
  Settings, 
  Droplets, 
  Wifi, 
  AlertTriangle,
  Home,
  Database
} from 'lucide-react';

interface SidebarProps {
  userRole: 'admin' | 'tenant';
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpen: boolean;
}

export default function Sidebar({ userRole, activeTab, onTabChange, isOpen }: SidebarProps) {
  const adminMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'tenants', label: 'Tenant Management', icon: Users },
    { id: 'devices', label: 'Device Overview', icon: Database },
    { id: 'analytics', label: 'System Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const tenantMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'usage', label: 'Water Usage', icon: Droplets },
    { id: 'devices', label: 'Fleet Management', icon: Wifi },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : tenantMenuItems;

  return (
    <aside className={`
      bg-white shadow-sm border-r border-gray-200 transition-all duration-300 ease-in-out
      ${isOpen ? 'w-64' : 'w-0 lg:w-64'}
      fixed lg:relative h-full z-30 overflow-hidden
    `}>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Droplets className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">SonoMicro</h2>
            <p className="text-xs text-gray-500">Flow Monitoring</p>
          </div>
        </div>
        
        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors
                  ${activeTab === item.id
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}