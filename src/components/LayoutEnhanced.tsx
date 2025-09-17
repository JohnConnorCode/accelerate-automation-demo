import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Layers, Settings, BarChart3, Zap, LogOut, 
  Database, Key, Clock, CheckSquare, TrendingUp,
  Bell, HelpCircle, ChevronRight, Menu, X, 
  RefreshCw, Play, Pause, AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { toast, Toaster } from 'sonner';

export default function LayoutEnhanced() {
  const { user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [notifications, setNotifications] = useState(0);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Navigation structure with better organization
  const mainNavItems = [
    { 
      path: '/dashboard', 
      icon: Home, 
      label: 'Dashboard',
      badge: null,
      description: 'Overview & metrics'
    },
    { 
      path: '/queue', 
      icon: Layers, 
      label: 'Content Queue',
      badge: notifications > 0 ? notifications : null,
      description: 'Review & approve content',
      isHighlight: true
    },
    { 
      path: '/analytics', 
      icon: TrendingUp, 
      label: 'Analytics',
      badge: null,
      description: 'Performance insights'
    }
  ];

  const configNavItems = [
    { 
      path: '/sources', 
      icon: Database, 
      label: 'Data Sources',
      badge: null,
      description: 'Manage sources'
    },
    { 
      path: '/api-config', 
      icon: Key, 
      label: 'API Config',
      badge: null,
      description: 'API keys & settings'
    },
    { 
      path: '/settings', 
      icon: Settings, 
      label: 'Settings',
      badge: null,
      description: 'System configuration'
    }
  ];

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLatestData();
      }, 30000); // 30 seconds
      setRefreshInterval(interval);
      toast.success('Auto-refresh enabled (30s)');
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
        toast.info('Auto-refresh disabled');
      }
    }
    return () => {
      if (refreshInterval) {clearInterval(refreshInterval);}
    };
  }, [autoRefresh]);

  // Fetch latest data
  const fetchLatestData = async () => {
    try {
      const response = await fetch('/api/scheduler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: 'content-fetch' })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.result?.inserted > 0) {
          setNotifications(prev => prev + data.result.inserted);
          toast.success(`${data.result.inserted} new items fetched`);
        }
        setLastFetch(new Date());
      }
    } catch (error) {
      console.error('Fetch failed:', error);
    }
  };

  // Manual refresh
  const handleManualRefresh = () => {
    toast.promise(fetchLatestData(), {
      loading: 'Fetching latest content...',
      success: 'Content updated',
      error: 'Fetch failed'
    });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K for quick navigation
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Could open a command palette here
      }
      
      // Alt + Q for queue
      if (e.altKey && e.key === 'q') {
        e.preventDefault();
        navigate('/queue');
      }
      
      // Alt + D for dashboard
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        navigate('/dashboard');
      }
      
      // Alt + R for refresh
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        handleManualRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);

  const handleSignOut = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (confirmed) {
      await signOut();
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Toaster position="top-right" richColors />
      
      {/* Sidebar */}
      <aside className={`${
        sidebarOpen ? 'w-72' : 'w-20'
      } min-h-screen bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shadow-lg`}>
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${!sidebarOpen && 'justify-center'}`}>
              <Zap className="w-8 h-8 text-blue-600" />
              {sidebarOpen && (
                <div>
                  <h1 className="text-xl font-bold text-gray-900">ACCELERATE</h1>
                  <p className="text-xs text-gray-500">Content Automation</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {sidebarOpen && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex gap-2">
              <button
                onClick={handleManualRefresh}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Fetch
              </button>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-2 text-sm ${
                  autoRefresh 
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                Auto
              </button>
            </div>
            {lastFetch && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Last fetch: {lastFetch.toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
        
        {/* Main Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarOpen && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Main
            </p>
          )}
          
          {mainNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                } ${item.isHighlight && !location.pathname.includes(item.path) ? 'ring-2 ring-blue-200' : ''}`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {item.label}
                      {item.badge && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
              {!sidebarOpen && item.badge && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
          
          {sidebarOpen && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">
              Configuration
            </p>
          )}
          
          {configNavItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <>
                  <div className="flex-1">
                    <div>{item.label}</div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </NavLink>
          ))}
        </nav>
        
        {/* User Section */}
        <div className="p-4 border-t border-gray-200">
          {sidebarOpen ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isAdmin ? 'Admin' : 'User'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => window.open('https://docs.accelerate.com', '_blank')}
                  className="flex-1 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-2"
                >
                  <HelpCircle className="w-4 h-4" />
                  Help
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Home</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="text-gray-900 font-medium">
                  {mainNavItems.find(item => item.path === location.pathname)?.label ||
                   configNavItems.find(item => item.path === location.pathname)?.label ||
                   'Page'}
                </span>
              </nav>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Indicators */}
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-600">System Online</span>
                </div>
                {autoRefresh && (
                  <div className="flex items-center gap-1.5 ml-3">
                    <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                    <span className="text-gray-600">Auto-refresh</span>
                  </div>
                )}
              </div>
              
              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <Bell className="w-5 h-5" />
                {notifications > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {notifications}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <div className="p-6">
          <Outlet />
        </div>
        
        {/* Keyboard Shortcuts Help */}
        <div className="fixed bottom-4 right-4">
          <button
            className="p-3 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 group"
            title="Keyboard Shortcuts"
          >
            <HelpCircle className="w-5 h-5" />
            <div className="absolute bottom-full right-0 mb-2 p-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <p className="font-semibold mb-2">Keyboard Shortcuts</p>
              <div className="space-y-1">
                <div>Alt + Q → Queue</div>
                <div>Alt + D → Dashboard</div>
                <div>Alt + R → Refresh</div>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}