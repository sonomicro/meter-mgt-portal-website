import React, { useState } from 'react';
import { useEffect } from 'react';
import LoginForm from './components/Login/LoginForm';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import AdminDashboard from './components/Admin/AdminDashboard';
import TenantManagement from './components/Admin/TenantManagement';
import DeviceOverview from './components/Admin/DeviceOverview';
import SystemAnalytics from './components/Admin/SystemAnalytics';
import Settings from './components/Admin/Settings';
import TenantDashboard from './components/Tenant/TenantDashboard';
import WaterUsage from './components/Tenant/WaterUsage';
import FleetManagement from './components/Tenant/FleetManagement';
import Alerts from './components/Tenant/Alerts';
import TenantSettings from './components/Tenant/TenantSettings';
import { AuthService } from './services/auth';
import { User } from './types';

// Expose AuthService globally for debugging
if (typeof window !== 'undefined') {
  (window as any).AuthService = AuthService;
  console.log('🔧 AuthService exposed to window for debugging');
  console.log('Available methods:', Object.getOwnPropertyNames(AuthService));
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing session on app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check for stored demo session first
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setLoading(false);
          return;
        }

        // Only check Supabase if configured
        if (AuthService.isSupabaseConfigured()) {
          const currentUser = await AuthService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    try {
      // Clear demo session
      localStorage.removeItem('currentUser');
      await AuthService.signOut();
      setUser(null);
      setActiveTab('dashboard');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      setUser(null);
      setActiveTab('dashboard');
    }
  };

  const renderContent = () => {
    if (!user) return null;

    if (user.role === 'admin') {
      switch (activeTab) {
        case 'dashboard':
          return <AdminDashboard />;
        case 'tenants':
          return <TenantManagement user={user} />;
        case 'devices':
          return <DeviceOverview />;
        case 'analytics':
          return <SystemAnalytics />;
        case 'settings':
          return <Settings />;
        default:
          return <AdminDashboard />;
      }
    } else {
      switch (activeTab) {
        case 'dashboard':
          return <TenantDashboard />;
        case 'usage':
          return <WaterUsage />;
        case 'devices':
          return <FleetManagement user={user} />;
        case 'alerts':
          return <Alerts />;
        case 'settings':
          return <TenantSettings />;
        default:
          return <TenantDashboard />;
      }
    }
  };

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar 
        userRole={user.role}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isOpen={sidebarOpen}
      />
      
      <div className="flex-1 flex flex-col min-h-screen">
        <Header 
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 p-6 overflow-hidden max-w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;