import { Outlet, NavLink } from 'react-router-dom'
import { Home, Layers, Settings, BarChart3, Zap } from 'lucide-react'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary to-secondary">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen bg-white/10 backdrop-blur-lg border-r border-white/20">
          <div className="p-6">
            <div className="flex items-center gap-2 text-white mb-8">
              <Zap className="w-8 h-8" />
              <h1 className="text-xl font-bold">Content Automation</h1>
            </div>
            
            <nav className="space-y-2">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors ${
                    isActive ? 'bg-white/20 text-white' : ''
                  }`
                }
              >
                <Home className="w-5 h-5" />
                Dashboard
              </NavLink>
              
              <NavLink
                to="/queue"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors ${
                    isActive ? 'bg-white/20 text-white' : ''
                  }`
                }
              >
                <Layers className="w-5 h-5" />
                Content Queue
              </NavLink>
              
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors ${
                    isActive ? 'bg-white/20 text-white' : ''
                  }`
                }
              >
                <BarChart3 className="w-5 h-5" />
                Analytics
              </NavLink>
              
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 transition-colors ${
                    isActive ? 'bg-white/20 text-white' : ''
                  }`
                }
              >
                <Settings className="w-5 h-5" />
                Settings
              </NavLink>
            </nav>
          </div>
        </aside>
        
        {/* Main Content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}