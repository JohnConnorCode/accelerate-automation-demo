import React, { useState } from 'react';
import { CriteriaEditor } from '../components/CriteriaEditor';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export const AdminSettings: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'project' | 'funding' | 'resource'>('project');
  const [saveMessage, setSaveMessage] = useState('');

  // Redirect if not admin
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSave = () => {
    setSaveMessage('Criteria saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const tabs = [
    { id: 'project', label: 'Projects', icon: '🚀' },
    { id: 'funding', label: 'Funding', icon: '💰' },
    { id: 'resource', label: 'Resources', icon: '📚' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure content collection criteria and scoring rules
          </p>
        </div>

        {/* Success Message */}
        {saveMessage && (
          <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
            {saveMessage}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`
                    py-4 px-6 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label} Criteria
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Criteria Editor */}
        <CriteriaEditor type={activeTab} onSave={handleSave} />

        {/* Quick Stats */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Collection Rules</h3>
            <p className="text-3xl font-bold text-blue-600">3</p>
            <p className="text-sm text-gray-600">Active criteria sets</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Last Updated</h3>
            <p className="text-lg font-medium">Today</p>
            <p className="text-sm text-gray-600">By {user?.email}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-2">Auto-Scoring</h3>
            <p className="text-lg font-medium text-green-600">Active</p>
            <p className="text-sm text-gray-600">Using latest criteria</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-3">How to Use</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <p>• <strong>Required Fields:</strong> Fields that must be present for content to be valid</p>
            <p>• <strong>Scoring Weights:</strong> How much each factor contributes to the final score (must sum to 100%)</p>
            <p>• <strong>Validation Rules:</strong> Constraints that content must meet (e.g., max team size, min funding)</p>
            <p>• <strong>Enrichment Priorities:</strong> Order in which to gather additional data</p>
          </div>
          <div className="mt-4 p-3 bg-yellow-100 rounded text-sm">
            <strong>⚠️ Important:</strong> Changes to criteria will affect all future content collection and scoring. 
            Existing content will not be re-scored automatically.
          </div>
        </div>
      </div>
    </div>
  );
};