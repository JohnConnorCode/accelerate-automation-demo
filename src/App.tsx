import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ContentQueueV2 from './pages/ContentQueueV2'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'
import SystemTest from './pages/SystemTest'
import { AdminSettings } from './pages/AdminSettings'
import ApiConfig from './pages/ApiConfig'
import { SystemDiagnostics } from './pages/SystemDiagnostics'
import { DataSources } from './pages/DataSources'

function App() {
  const { user, loading } = useAuth()
  
  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      
      {/* Root redirect based on auth status */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />
      
      {/* Protected routes (logged in users) */}
      <Route element={
        <ProtectedRoute adminOnly={false}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="api-config" element={<ApiConfig />} />
        <Route path="queue" element={<ContentQueueV2 />} />
        <Route path="settings" element={<Settings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="test" element={<SystemTest />} />
        <Route path="sources" element={<DataSources />} />
        
        {/* Admin only routes */}
        <Route path="admin" element={
          <ProtectedRoute adminOnly={true}>
            <AdminSettings />
          </ProtectedRoute>
        } />
        <Route path="diagnostics" element={
          <ProtectedRoute adminOnly={true}>
            <SystemDiagnostics />
          </ProtectedRoute>
        } />
      </Route>
      
      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App