import { createClient } from '@supabase/supabase-js';
import { monitoring } from '../src/services/monitoring-alerting-service';
import { degradation } from '../src/services/graceful-degradation-service';
import { errorLogger } from '../src/services/error-logging-service';
import { ErrorRecoveryService } from '../src/services/error-recovery-service';
const recovery = new ErrorRecoveryService();
import { intelligentCache } from '../src/services/intelligent-cache-service';
import { rateLimiter } from '../src/services/rate-limiting-service';
import { failSafe } from '../src/services/fail-safe-wrapper';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  
  // API endpoints
  if (path === '/api/dashboard/data') {
    return handleDashboardData(req);
  }
  
  if (path === '/api/dashboard/alerts') {
    return handleAlerts(req);
  }
  
  if (path === '/api/dashboard/metrics') {
    return handleMetrics(req);
  }
  
  if (path === '/api/dashboard/recovery') {
    return handleRecovery(req);
  }
  
  // Main dashboard UI
  return new Response(getDashboardHTML(), {
    headers: { 'Content-Type': 'text/html' }
  });
}

async function handleDashboardData(req: Request): Promise<Response> {
  try {
    // Gather all system data
    const [
      healthSummary,
      degradationStatus,
      errorStats,
      recoveryStatus,
      cacheStats,
      circuitBreakers
    ] = await Promise.all([
      monitoring.getHealthSummary(),
      degradation.getStatus(),
      errorLogger.getStatistics(),
      recovery.getStatus(),
      intelligentCache.getStats(),
      failSafe.getCircuitBreakerStatus()
    ]);
    
    // Get recent metrics from database
    const { data: recentMetrics } = await supabase
      .from('system_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    return new Response(JSON.stringify({
      health: healthSummary,
      degradation: degradationStatus,
      errors: errorStats,
      recovery: recoveryStatus,
      cache: cacheStats,
      circuitBreakers: Array.from(circuitBreakers.entries()).map(([name, state]: [string, any]) => ({
        name,
        ...state
      })),
      metrics: recentMetrics,
      recentErrors
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleAlerts(req: Request): Promise<Response> {
  try {
    const alerts = monitoring.getActiveAlerts();
    return new Response(JSON.stringify({ alerts }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleMetrics(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get('metric') || 'all';
    const duration = parseInt(url.searchParams.get('duration') || '3600000');
    
    const metrics = monitoring.getCurrentMetrics();
    const history = metric !== 'all' 
      ? monitoring.getMetricHistory(metric, duration)
      : Array.from(metrics.entries()).map(([name, points]) => ({
          name,
          points: points.slice(-100) // Last 100 points
        }));
    
    return new Response(JSON.stringify({ history }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleRecovery(req: Request): Promise<Response> {
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { component, strategy } = body;
      
      const result = await recovery.manualRecovery(component, strategy);
      
      return new Response(JSON.stringify({ success: true, result }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return new Response('Method not allowed', { status: 405 });
}

function getDashboardHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accelerate System Health Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header {
      background: white;
      border-radius: 12px;
      padding: 20px 30px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h1 {
      font-size: 28px;
      color: #2d3748;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .status-indicator {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    .status-healthy { background: #48bb78; }
    .status-degraded { background: #f6ad55; }
    .status-critical { background: #f56565; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
    }
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
    }
    
    .card-title {
      font-size: 18px;
      font-weight: 600;
      color: #2d3748;
    }
    
    .metric {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f7fafc;
    }
    
    .metric-label {
      color: #718096;
      font-size: 14px;
    }
    
    .metric-value {
      font-weight: 600;
      color: #2d3748;
    }
    
    .alert-list {
      max-height: 300px;
      overflow-y: auto;
    }
    
    .alert-item {
      padding: 10px;
      margin-bottom: 8px;
      border-radius: 8px;
      font-size: 14px;
    }
    
    .alert-critical {
      background: #fed7d7;
      border-left: 4px solid #f56565;
    }
    
    .alert-error {
      background: #feebc8;
      border-left: 4px solid #ed8936;
    }
    
    .alert-warning {
      background: #fefcbf;
      border-left: 4px solid #ecc94b;
    }
    
    .alert-info {
      background: #bee3f8;
      border-left: 4px solid #4299e1;
    }
    
    .chart-container {
      height: 200px;
      position: relative;
    }
    
    .progress-bar {
      width: 100%;
      height: 20px;
      background: #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #48bb78, #38a169);
      transition: width 0.3s ease;
    }
    
    .button {
      padding: 8px 16px;
      border-radius: 6px;
      border: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .button-primary {
      background: #667eea;
      color: white;
    }
    
    .button-primary:hover {
      background: #5a67d8;
    }
    
    .button-danger {
      background: #f56565;
      color: white;
    }
    
    .button-danger:hover {
      background: #e53e3e;
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    
    .feature-item {
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      text-align: center;
    }
    
    .feature-enabled {
      background: #c6f6d5;
      color: #22543d;
    }
    
    .feature-disabled {
      background: #fed7d7;
      color: #742a2a;
    }
    
    .circuit-breaker {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      margin-bottom: 8px;
      border-radius: 6px;
      background: #f7fafc;
    }
    
    .circuit-state {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .state-closed { background: #c6f6d5; color: #22543d; }
    .state-open { background: #fed7d7; color: #742a2a; }
    .state-half-open { background: #feebc8; color: #744210; }
    
    .refresh-indicator {
      font-size: 12px;
      color: #718096;
    }
    
    .large-card {
      grid-column: span 2;
    }
    
    @media (max-width: 768px) {
      .large-card {
        grid-column: span 1;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span class="status-indicator" id="overall-status"></span>
        System Health Dashboard
      </h1>
      <div>
        <span class="refresh-indicator">Auto-refresh: <span id="refresh-timer">30</span>s</span>
        <button class="button button-primary" onclick="refreshDashboard()">Refresh Now</button>
      </div>
    </div>
    
    <div class="dashboard-grid">
      <!-- System Health Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">System Health</h3>
          <span id="health-status"></span>
        </div>
        <div id="health-metrics">
          <div class="metric">
            <span class="metric-label">CPU Usage</span>
            <span class="metric-value" id="cpu-usage">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Memory Usage</span>
            <span class="metric-value" id="memory-usage">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Error Rate</span>
            <span class="metric-value" id="error-rate">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Response Time</span>
            <span class="metric-value" id="response-time">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Queue Size</span>
            <span class="metric-value" id="queue-size">--</span>
          </div>
        </div>
      </div>
      
      <!-- Degradation Status Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Service Level</h3>
          <span id="degradation-level"></span>
        </div>
        <div id="degradation-info">
          <div class="metric">
            <span class="metric-label">Current Level</span>
            <span class="metric-value" id="current-level">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Enabled Features</span>
            <span class="metric-value" id="enabled-count">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Disabled Features</span>
            <span class="metric-value" id="disabled-count">--</span>
          </div>
        </div>
        <div style="margin-top: 15px;">
          <button class="button button-primary" onclick="showFeatureDetails()">View Features</button>
        </div>
      </div>
      
      <!-- Cache Performance Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Cache Performance</h3>
        </div>
        <div>
          <div class="metric">
            <span class="metric-label">Hit Rate</span>
            <span class="metric-value" id="cache-hit-rate">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Entries</span>
            <span class="metric-value" id="cache-entries">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Cache Size</span>
            <span class="metric-value" id="cache-size">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Evictions</span>
            <span class="metric-value" id="cache-evictions">--</span>
          </div>
        </div>
        <div style="margin-top: 10px;">
          <div class="progress-bar">
            <div class="progress-fill" id="cache-hit-bar" style="width: 0%"></div>
          </div>
        </div>
      </div>
      
      <!-- Error Statistics Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Error Statistics</h3>
        </div>
        <div>
          <div class="metric">
            <span class="metric-label">Total Errors</span>
            <span class="metric-value" id="total-errors">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Critical</span>
            <span class="metric-value" id="critical-errors">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Unresolved</span>
            <span class="metric-value" id="unresolved-errors">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">Top Category</span>
            <span class="metric-value" id="top-error-category">--</span>
          </div>
        </div>
      </div>
      
      <!-- Active Alerts Card -->
      <div class="card large-card">
        <div class="card-header">
          <h3 class="card-title">Active Alerts</h3>
          <span id="alert-count">0</span>
        </div>
        <div class="alert-list" id="alert-list">
          <!-- Alerts will be populated here -->
        </div>
      </div>
      
      <!-- Circuit Breakers Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Circuit Breakers</h3>
        </div>
        <div id="circuit-breakers">
          <!-- Circuit breakers will be populated here -->
        </div>
      </div>
      
      <!-- Recovery Status Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Recovery Status</h3>
        </div>
        <div id="recovery-status">
          <div class="metric">
            <span class="metric-label">Active Recoveries</span>
            <span class="metric-value" id="active-recoveries">--</span>
          </div>
          <div class="metric">
            <span class="metric-label">In Cooldown</span>
            <span class="metric-value" id="cooldown-strategies">--</span>
          </div>
        </div>
        <div style="margin-top: 15px;">
          <button class="button button-danger" onclick="triggerManualRecovery()">Manual Recovery</button>
        </div>
      </div>
      
      <!-- Recent Errors Card -->
      <div class="card large-card">
        <div class="card-header">
          <h3 class="card-title">Recent Errors</h3>
        </div>
        <div class="alert-list" id="error-list">
          <!-- Recent errors will be populated here -->
        </div>
      </div>
    </div>
  </div>
  
  <script>
    let refreshTimer = 30;
    let refreshInterval;
    let countdownInterval;
    
    // Initialize dashboard
    document.addEventListener('DOMContentLoaded', () => {
      refreshDashboard();
      startAutoRefresh();
    });
    
    function startAutoRefresh() {
      // Countdown timer
      countdownInterval = setInterval(() => {
        refreshTimer--;
        document.getElementById('refresh-timer').textContent = refreshTimer;
        if (refreshTimer <= 0) {
          refreshTimer = 30;
          refreshDashboard();
        }
      }, 1000);
      
      // Refresh every 30 seconds
      refreshInterval = setInterval(refreshDashboard, 30000);
    }
    
    async function refreshDashboard() {
      try {
        const response = await fetch('/api/dashboard/data');
        const data = await response.json();
        
        updateSystemHealth(data.health);
        updateDegradation(data.degradation);
        updateCache(data.cache);
        updateErrors(data.errors);
        updateCircuitBreakers(data.circuitBreakers);
        updateRecovery(data.recovery);
        
        // Fetch and update alerts
        const alertsResponse = await fetch('/api/dashboard/alerts');
        const alertsData = await alertsResponse.json();
        updateAlerts(alertsData.alerts);
        
        // Update recent errors
        updateRecentErrors(data.recentErrors);
        
        // Reset countdown
        refreshTimer = 30;
        
      } catch (error) {
        console.error('Failed to refresh dashboard:', error);
      }
    }
    
    function updateSystemHealth(health) {
      const statusEl = document.getElementById('overall-status');
      statusEl.className = 'status-indicator status-' + health.status;
      
      document.getElementById('health-status').textContent = health.status.toUpperCase();
      document.getElementById('health-status').style.color = 
        health.status === 'healthy' ? '#48bb78' : 
        health.status === 'degraded' ? '#f6ad55' : '#f56565';
      
      const metrics = health.metrics || {};
      document.getElementById('cpu-usage').textContent = 
        metrics.cpu ? (metrics.cpu * 100).toFixed(1) + '%' : '--';
      document.getElementById('memory-usage').textContent = 
        metrics.memory ? (metrics.memory * 100).toFixed(1) + '%' : '--';
      document.getElementById('error-rate').textContent = 
        metrics.errorRate ? (metrics.errorRate * 100).toFixed(2) + '%' : '--';
      document.getElementById('response-time').textContent = 
        metrics.responseTime ? metrics.responseTime.toFixed(0) + 'ms' : '--';
      document.getElementById('queue-size').textContent = 
        metrics.queueSize !== undefined ? metrics.queueSize : '--';
    }
    
    function updateDegradation(degradation) {
      const levelEl = document.getElementById('current-level');
      levelEl.textContent = degradation.currentLevel.toUpperCase();
      
      const levelColors = {
        'full': '#48bb78',
        'partial': '#f6ad55',
        'minimal': '#ed8936',
        'emergency': '#f56565'
      };
      
      levelEl.style.color = levelColors[degradation.currentLevel] || '#718096';
      
      document.getElementById('enabled-count').textContent = 
        degradation.enabledFeatures.length;
      document.getElementById('disabled-count').textContent = 
        degradation.disabledFeatures.length;
    }
    
    function updateCache(cache) {
      document.getElementById('cache-hit-rate').textContent = 
        cache.hitRate ? cache.hitRate.toFixed(1) + '%' : '--';
      document.getElementById('cache-entries').textContent = cache.entries || 0;
      document.getElementById('cache-size').textContent = 
        cache.size ? formatBytes(cache.size) : '--';
      document.getElementById('cache-evictions').textContent = cache.evictions || 0;
      
      const hitBar = document.getElementById('cache-hit-bar');
      hitBar.style.width = (cache.hitRate || 0) + '%';
      
      // Color based on hit rate
      if (cache.hitRate >= 80) {
        hitBar.style.background = 'linear-gradient(90deg, #48bb78, #38a169)';
      } else if (cache.hitRate >= 50) {
        hitBar.style.background = 'linear-gradient(90deg, #f6ad55, #ed8936)';
      } else {
        hitBar.style.background = 'linear-gradient(90deg, #f56565, #e53e3e)';
      }
    }
    
    function updateErrors(errors) {
      document.getElementById('total-errors').textContent = errors.total || 0;
      document.getElementById('critical-errors').textContent = 
        errors.byLevel?.critical || 0;
      document.getElementById('unresolved-errors').textContent = 
        errors.unresolvedCount || 0;
      
      // Find top error category
      if (errors.byCategory) {
        const topCategory = Object.entries(errors.byCategory)
          .sort((a, b) => b[1] - a[1])[0];
        document.getElementById('top-error-category').textContent = 
          topCategory ? topCategory[0] : 'None';
      }
    }
    
    function updateAlerts(alerts) {
      const alertList = document.getElementById('alert-list');
      const alertCount = document.getElementById('alert-count');
      
      alertCount.textContent = alerts.length;
      
      if (alerts.length === 0) {
        alertList.innerHTML = '<div style="color: #718096; text-align: center; padding: 20px;">No active alerts</div>';
      } else {
        alertList.innerHTML = alerts.map(alert => \`
          <div class="alert-item alert-\${alert.level}">
            <div style="font-weight: 600;">\${alert.message}</div>
            <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">
              \${alert.metric} - Current: \${alert.currentValue}, Threshold: \${alert.threshold}
            </div>
            <div style="font-size: 11px; color: #718096; margin-top: 2px;">
              \${new Date(alert.timestamp).toLocaleString()}
            </div>
          </div>
        \`).join('');
      }
    }
    
    function updateCircuitBreakers(breakers) {
      const container = document.getElementById('circuit-breakers');
      
      if (!breakers || breakers.length === 0) {
        container.innerHTML = '<div style="color: #718096;">All circuits closed</div>';
      } else {
        container.innerHTML = breakers.map(breaker => \`
          <div class="circuit-breaker">
            <span style="flex: 1; font-size: 13px;">\${breaker.name}</span>
            <span class="circuit-state state-\${breaker.state}">\${breaker.state.toUpperCase()}</span>
            <span style="font-size: 12px; color: #718096;">F: \${breaker.failures}</span>
          </div>
        \`).join('');
      }
    }
    
    function updateRecovery(recovery) {
      document.getElementById('active-recoveries').textContent = 
        recovery.activeRecoveries?.length || 0;
      document.getElementById('cooldown-strategies').textContent = 
        recovery.strategiesInCooldown?.length || 0;
    }
    
    function updateRecentErrors(errors) {
      const errorList = document.getElementById('error-list');
      
      if (!errors || errors.length === 0) {
        errorList.innerHTML = '<div style="color: #718096; text-align: center; padding: 20px;">No recent errors</div>';
      } else {
        errorList.innerHTML = errors.slice(0, 10).map(error => \`
          <div class="alert-item alert-\${error.level || 'error'}">
            <div style="font-weight: 600;">\${error.message}</div>
            <div style="font-size: 12px; color: #4a5568; margin-top: 4px;">
              Component: \${error.context?.component || 'Unknown'} | 
              Count: \${error.count || 1}
            </div>
            <div style="font-size: 11px; color: #718096; margin-top: 2px;">
              \${new Date(error.created_at || error.timestamp).toLocaleString()}
            </div>
          </div>
        \`).join('');
      }
    }
    
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function showFeatureDetails() {
      // This would open a modal or expand section showing feature details
      alert('Feature details view coming soon!');
    }
    
    async function triggerManualRecovery() {
      if (!confirm('Are you sure you want to trigger manual recovery?')) return;
      
      try {
        const response = await fetch('/api/dashboard/recovery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ component: 'system' })
        });
        
        const result = await response.json();
        if (result.success) {
          alert('Recovery initiated successfully');
          refreshDashboard();
        } else {
          alert('Recovery failed: ' + result.error);
        }
      } catch (error) {
        alert('Failed to trigger recovery: ' + (error as Error).message);
      }
    }
  </script>
</body>
</html>
  `;
}