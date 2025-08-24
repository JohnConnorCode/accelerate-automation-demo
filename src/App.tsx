import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ContentQueue from './pages/ContentQueue'
import Settings from './pages/Settings'
import Analytics from './pages/Analytics'
import SystemTest from './pages/SystemTest'
import { AdminSettings } from './pages/AdminSettings'
import { SystemDiagnostics } from './pages/SystemDiagnostics'
import { DataSources } from './pages/DataSources'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute adminOnly={true}>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="queue" element={<ContentQueue />} />
        <Route path="settings" element={<Settings />} />
        <Route path="admin" element={<AdminSettings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="test" element={<SystemTest />} />
        <Route path="diagnostics" element={<SystemDiagnostics />} />
        <Route path="sources" element={<DataSources />} />
      </Route>
    </Routes>
  )
}

export default App