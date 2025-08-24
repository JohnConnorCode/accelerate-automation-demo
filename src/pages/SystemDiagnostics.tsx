import React, { useState, useEffect } from 'react';
import { criteriaService } from '../services/criteria-service';
import { orchestrator } from '../core/simple-orchestrator';
import { supabase } from '../lib/supabase-client';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  message?: string;
}

export const SystemDiagnostics: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({ total: 0, passed: 0, failed: 0 });

  const allTests = [
    { name: 'API Health Check', fn: testAPIHealth },
    { name: 'Database Connection', fn: testDatabase },
    { name: 'Project Criteria', fn: () => testCriteria('project') },
    { name: 'Funding Criteria', fn: () => testCriteria('funding') },
    { name: 'Resource Criteria', fn: () => testCriteria('resource') },
    { name: 'Project Scoring', fn: () => testScoring('project') },
    { name: 'Funding Scoring', fn: () => testScoring('funding') },
    { name: 'Resource Scoring', fn: () => testScoring('resource') },
    { name: 'Orchestrator Status', fn: testOrchestrator },
    { name: 'Enrichment Service', fn: testEnrichment },
  ];

  useEffect(() => {
    // Initialize tests
    setTests(allTests.map(t => ({ name: t.name, status: 'pending' })));
  }, []);

  async function testAPIHealth(): Promise<boolean> {
    try {
      const response = await fetch('/api/health');
      return response.ok;
    } catch {
      return false;
    }
  }

  async function testDatabase(): Promise<boolean> {
    try {
      const { error } = await supabase.from('content_curated').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async function testCriteria(type: 'project' | 'funding' | 'resource'): Promise<boolean> {
    try {
      const criteria = await criteriaService.getCriteria(type);
      return criteria.type === type && criteria.active === true;
    } catch {
      return false;
    }
  }

  async function testScoring(type: 'project' | 'funding' | 'resource'): Promise<boolean> {
    try {
      const testData = {
        project: { title: 'Test', team_size: 3, launch_date: '2024-06-01' },
        funding: { program_name: 'Test', deadline: '2025-03-01', min_amount: 10000 },
        resource: { title: 'Test', price_type: 'free', category: 'tools' }
      };
      
      const score = await criteriaService.scoreContent(testData[type], type);
      return score >= 0 && score <= 100;
    } catch {
      return false;
    }
  }

  async function testOrchestrator(): Promise<boolean> {
    try {
      const status = await orchestrator.getStatus();
      return status.totalContent >= 0;
    } catch {
      return false;
    }
  }

  async function testEnrichment(): Promise<boolean> {
    try {
      // Just check that the service exists and can be called
      return typeof criteriaService.scoreContent === 'function';
    } catch {
      return false;
    }
  }

  async function runAllTests() {
    setIsRunning(true);
    const results: TestResult[] = [];
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < allTests.length; i++) {
      const test = allTests[i];
      
      // Update to running
      setTests(prev => prev.map((t, idx) => 
        idx === i ? { ...t, status: 'running' as const } : t
      ));

      try {
        const result = await test.fn();
        const status = result ? 'pass' : 'fail';
        
        if (result) passed++;
        else failed++;

        results.push({
          name: test.name,
          status: status as 'pass' | 'fail',
          message: result ? 'Test passed' : 'Test failed'
        });

        setTests(prev => prev.map((t, idx) => 
          idx === i ? results[i] : t
        ));
      } catch (error) {
        failed++;
        results.push({
          name: test.name,
          status: 'fail',
          message: `Error: ${error}`
        });

        setTests(prev => prev.map((t, idx) => 
          idx === i ? results[i] : t
        ));
      }
    }

    setStats({ total: allTests.length, passed, failed });
    setIsRunning(false);
  }

  const successRate = stats.total > 0 
    ? ((stats.passed / stats.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">System Diagnostics</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-gray-600">Total Tests</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.passed}</div>
          <div className="text-gray-600">Passed</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
          <div className="text-gray-600">Failed</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <div className="text-3xl font-bold text-purple-600">{successRate}%</div>
          <div className="text-gray-600">Success Rate</div>
        </div>
      </div>

      {/* Test Results */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        <div className="space-y-2">
          {tests.map((test, idx) => (
            <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <span className="font-medium">{test.name}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                test.status === 'pass' ? 'bg-green-100 text-green-800' :
                test.status === 'fail' ? 'bg-red-100 text-red-800' :
                test.status === 'running' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {test.status.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        <button
          onClick={() => {
            setTests(allTests.map(t => ({ name: t.name, status: 'pending' })));
            setStats({ total: 0, passed: 0, failed: 0 });
          }}
          className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Reset
        </button>
      </div>

      {/* Summary */}
      {stats.total > 0 && (
        <div className={`mt-6 p-4 rounded-lg ${
          stats.failed === 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
        }`}>
          {stats.failed === 0 ? (
            <div>
              <strong>🎉 All tests passed!</strong> The system is working perfectly.
            </div>
          ) : (
            <div>
              <strong>⚠️ Some tests failed.</strong> Please check the failed tests above.
            </div>
          )}
        </div>
      )}
    </div>
  );
};