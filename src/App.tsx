import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LayoutEnhanced from './components/LayoutEnhanced';
import Navigation from './components/Navigation';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ContentQueueV2 from './pages/ContentQueueV2';
import ContentQueueEnhanced from './pages/ContentQueueEnhanced';
import Settings from './pages/Settings';
import Analytics from './pages/Analytics';
import SystemTest from './pages/SystemTest';
import { AdminSettings } from './pages/AdminSettings';
import ApiConfig from './pages/ApiConfig';
import { SystemDiagnostics } from './pages/SystemDiagnostics';
import { DataSources } from './pages/DataSources';

import { Link } from 'react-router-dom';

// Landing page component
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-indigo-600">🚀 Accelerate Content Automation</h1>
            </div>
            <Navigation className="flex items-center space-x-4" />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
            Intelligent Content Pipeline for Accelerate
          </h2>
          <p className="mt-4 text-xl text-gray-600">
            Automated fetching, scoring, and curation of startup content from 30+ sources
          </p>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Automated Fetching</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Continuously pulls content from HackerNews, ProductHunt, GitHub, and 30+ other sources
              </p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">AI Scoring</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Uses ACCELERATE criteria to score and filter content for quality and relevance
              </p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Manual Review</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Queue-based approval workflow ensures only quality content reaches production
              </p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Deduplication</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Smart deduplication prevents duplicate content across all data sources
              </p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Configurable Pipeline</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Customize scoring criteria, data sources, and approval thresholds
              </p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-gray-900">Real-time Analytics</h3>
                </div>
              </div>
              <p className="mt-2 text-gray-600">
                Track pipeline performance, content quality, and approval metrics
              </p>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Current Pipeline Status</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-indigo-50 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-600">Data Sources</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">30+</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm font-medium text-green-600">Items Processed</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">10K+</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm font-medium text-yellow-600">Pending Review</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">156</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm font-medium text-purple-600">Approved Today</p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">42</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Link to="/dashboard" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700">
            Go to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  // For demo/production, skip auth and show the app
  const skipAuth = true; // Enable public access for demo

  // Show loading state while checking auth (but keep it brief)
  if (loading && !skipAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Landing page - always accessible */}
      <Route path="/" element={<LandingPage />} />

      {/* Public routes - no auth required for demo */}
      <Route path="/login" element={<Login />} />

      {/* Main app routes - accessible without login for demo */}
      <Route element={<LayoutEnhanced />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/content-queue" element={<ContentQueueEnhanced />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/api-config" element={<ApiConfig />} />
        <Route path="/system-test" element={<SystemTest />} />
        <Route path="/admin-settings" element={<AdminSettings />} />
        <Route path="/diagnostics" element={<SystemDiagnostics />} />
        <Route path="/data-sources" element={<DataSources />} />

        {/* Alternative content queue */}
        <Route path="/queue-v2" element={<ContentQueueV2 />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;