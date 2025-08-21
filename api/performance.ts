import { VercelRequest, VercelResponse } from '@vercel/node';
import { intelligentCache } from '../src/services/intelligent-cache-service';
import { optimizedDB } from '../src/services/optimized-database-service';
import { rateLimiter } from '../src/services/rate-limiting-service';
import { supabase } from '../src/lib/supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { action } = req.query;

      switch (action) {
        case 'stats':
          // Get all performance statistics
          const cacheStats = intelligentCache.getStats();
          const dbStats = optimizedDB.getPoolStats();
          const rateLimitStats = rateLimiter.getStatistics();
          
          // Get recent performance metrics
          const { data: recentMetrics } = await supabase
            .from('performance_metrics')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);
          
          return res.status(200).json({
            cache: cacheStats,
            database: dbStats,
            rateLimit: rateLimitStats,
            metrics: recentMetrics
          });

        case 'cache-details':
          // Get detailed cache information
          const cacheExport = intelligentCache.exportCache();
          return res.status(200).json(cacheExport);

        case 'dashboard':
          // Return performance dashboard HTML
          return res.status(200).send(generatePerformanceDashboard());

        default:
          // Real-time metrics
          const metrics = await collectRealTimeMetrics();
          return res.status(200).json(metrics);
      }
    }

    if (req.method === 'POST') {
      const { action, params } = req.body;

      switch (action) {
        case 'clear-cache':
          intelligentCache.clear();
          return res.status(200).json({ success: true, message: 'Cache cleared' });

        case 'invalidate-cache':
          const invalidated = await intelligentCache.invalidateRelated(params.pattern);
          return res.status(200).json({ success: true, invalidated });

        case 'optimize-db':
          await optimizedDB.createIndexes();
          return res.status(200).json({ success: true, message: 'Database optimized' });

        case 'reset-rate-limits':
          rateLimiter.reset();
          return res.status(200).json({ success: true, message: 'Rate limits reset' });

        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[Performance API] Error:', error);
    return res.status(500).json({ 
      error: 'Performance monitoring error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

async function collectRealTimeMetrics() {
  const startTime = Date.now();
  
  // Cache performance
  const cacheStats = intelligentCache.getStats();
  
  // Database performance
  const dbStats = optimizedDB.getPoolStats();
  
  // Test database response time
  const dbStart = Date.now();
  await supabase.from('system_settings').select('key').limit(1);
  const dbResponseTime = Date.now() - dbStart;
  
  // API rate limits
  const rateLimitStats = rateLimiter.getStatistics();
  
  // Queue size
  const { count: queueSize } = await supabase
    .from('content_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  
  // Recent errors
  const { count: errorCount } = await supabase
    .from('error_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', new Date(Date.now() - 300000).toISOString());
  
  // Processing speed (items per minute)
  const { data: recentProcessing } = await supabase
    .from('scheduler_history')
    .select('items_processed, duration_seconds')
    .order('created_at', { ascending: false })
    .limit(5);
  
  const avgProcessingSpeed = recentProcessing && recentProcessing.length > 0
    ? recentProcessing.reduce((sum, r) => sum + (r.items_processed || 0) / (r.duration_seconds || 1) * 60, 0) / recentProcessing.length
    : 0;
  
  const totalTime = Date.now() - startTime;
  
  return {
    timestamp: new Date().toISOString(),
    performance: {
      responseTime: totalTime,
      dbResponseTime,
      cacheHitRate: cacheStats.hitRate,
      processingSpeed: Math.round(avgProcessingSpeed)
    },
    cache: {
      hits: cacheStats.hits,
      misses: cacheStats.misses,
      entries: cacheStats.entries,
      size: cacheStats.size,
      hitRate: cacheStats.hitRate
    },
    database: {
      poolSize: dbStats.poolSize,
      connectionsActive: dbStats.connectionsActive,
      responseTime: dbResponseTime
    },
    system: {
      queueSize: queueSize || 0,
      errorCount: errorCount || 0,
      blockedClients: rateLimitStats.blockedClients,
      activeClients: rateLimitStats.totalClients
    }
  };
}

function generatePerformanceDashboard(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚡ Performance Dashboard - Accelerate Platform</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        
        .container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            border-radius: 15px;
            padding: 30px;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            color: #667eea;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            transition: transform 0.3s;
        }
        
        .metric-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        }
        
        .metric-card.highlight {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .metric-label {
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.8;
            margin-bottom: 10px;
        }
        
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .metric-change {
            font-size: 0.9em;
            opacity: 0.8;
        }
        
        .positive { color: #10b981; }
        .negative { color: #ef4444; }
        
        .charts-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .chart-card {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .chart-title {
            font-size: 1.3em;
            font-weight: 600;
            margin-bottom: 20px;
            color: #667eea;
        }
        
        .cache-details {
            background: white;
            border-radius: 15px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .cache-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .cache-table th {
            background: #f3f4f6;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .cache-table td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .cache-table tr:hover {
            background: #f9fafb;
        }
        
        .controls {
            background: white;
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .btn {
            padding: 12px 30px;
            margin: 10px;
            border: none;
            border-radius: 8px;
            font-size: 1em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        
        .btn-warning {
            background: #f59e0b;
            color: white;
        }
        
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        .status-healthy { background: #10b981; }
        .status-warning { background: #f59e0b; }
        .status-critical { background: #ef4444; }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .real-time-indicator {
            display: inline-block;
            padding: 5px 15px;
            background: #10b981;
            color: white;
            border-radius: 20px;
            font-size: 0.85em;
            animation: blink 2s infinite;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ Performance Dashboard</h1>
            <p>Real-time monitoring of system performance and optimizations</p>
            <span class="real-time-indicator">LIVE</span>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card highlight">
                <div class="metric-label">Cache Hit Rate</div>
                <div class="metric-value" id="cacheHitRate">-</div>
                <div class="metric-change positive">Optimized</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">DB Response Time</div>
                <div class="metric-value" id="dbResponseTime">-</div>
                <div class="metric-change">ms</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Processing Speed</div>
                <div class="metric-value" id="processingSpeed">-</div>
                <div class="metric-change">items/min</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Cache Entries</div>
                <div class="metric-value" id="cacheEntries">-</div>
                <div class="metric-change" id="cacheSize">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Active Connections</div>
                <div class="metric-value" id="dbConnections">-</div>
                <div class="metric-change">pooled</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Queue Size</div>
                <div class="metric-value" id="queueSize">-</div>
                <div class="metric-change">pending</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Active Clients</div>
                <div class="metric-value" id="activeClients">-</div>
                <div class="metric-change" id="blockedClients">-</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-label">Error Rate</div>
                <div class="metric-value" id="errorCount">-</div>
                <div class="metric-change">last 5 min</div>
            </div>
        </div>
        
        <div class="charts-grid">
            <div class="chart-card">
                <h3 class="chart-title">Cache Performance</h3>
                <canvas id="cacheChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h3 class="chart-title">Response Times</h3>
                <canvas id="responseChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h3 class="chart-title">Processing Speed</h3>
                <canvas id="speedChart"></canvas>
            </div>
            
            <div class="chart-card">
                <h3 class="chart-title">Rate Limit Usage</h3>
                <canvas id="rateLimitChart"></canvas>
            </div>
        </div>
        
        <div class="cache-details">
            <h3 class="chart-title">Cache Details</h3>
            <table class="cache-table">
                <thead>
                    <tr>
                        <th>Key Pattern</th>
                        <th>Entries</th>
                        <th>Hit Rate</th>
                        <th>Size</th>
                        <th>Priority</th>
                    </tr>
                </thead>
                <tbody id="cacheDetailsTable">
                    <tr>
                        <td colspan="5" style="text-align: center; color: #999;">Loading...</td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <div class="controls">
            <h3 class="chart-title">Performance Controls</h3>
            <button class="btn btn-primary" onclick="refreshMetrics()">🔄 Refresh</button>
            <button class="btn btn-warning" onclick="clearCache()">🗑️ Clear Cache</button>
            <button class="btn btn-primary" onclick="optimizeDB()">⚡ Optimize DB</button>
            <button class="btn btn-danger" onclick="resetRateLimits()">🔓 Reset Limits</button>
            <button class="btn btn-primary" onclick="exportData()">📊 Export Data</button>
        </div>
    </div>
    
    <script>
        // Chart setup
        const cacheChartCtx = document.getElementById('cacheChart').getContext('2d');
        const responseChartCtx = document.getElementById('responseChart').getContext('2d');
        const speedChartCtx = document.getElementById('speedChart').getContext('2d');
        const rateLimitChartCtx = document.getElementById('rateLimitChart').getContext('2d');
        
        const cacheChart = new Chart(cacheChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Hit Rate (%)',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
        
        const responseChart = new Chart(responseChartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'API Response (ms)',
                    data: [],
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }, {
                    label: 'DB Response (ms)',
                    data: [],
                    borderColor: '#764ba2',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        const speedChart = new Chart(speedChartCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Items/min',
                    data: [],
                    backgroundColor: '#f59e0b'
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        const rateLimitChart = new Chart(rateLimitChartCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#667eea',
                        '#764ba2'
                    ]
                }]
            },
            options: {
                responsive: true
            }
        });
        
        // Data management
        const maxDataPoints = 20;
        let metricsHistory = [];
        
        async function loadMetrics() {
            try {
                const response = await fetch('/api/performance');
                const data = await response.json();
                updateDashboard(data);
                
                // Store history
                metricsHistory.push(data);
                if (metricsHistory.length > maxDataPoints) {
                    metricsHistory.shift();
                }
                
                updateCharts();
            } catch (error) {
                console.error('Failed to load metrics:', error);
            }
        }
        
        function updateDashboard(data) {
            // Update metric cards
            document.getElementById('cacheHitRate').textContent = 
                data.cache?.hitRate ? data.cache.hitRate.toFixed(1) + '%' : '0%';
            document.getElementById('dbResponseTime').textContent = 
                data.database?.responseTime || '-';
            document.getElementById('processingSpeed').textContent = 
                data.performance?.processingSpeed || '0';
            document.getElementById('cacheEntries').textContent = 
                data.cache?.entries || '0';
            document.getElementById('cacheSize').textContent = 
                formatBytes(data.cache?.size || 0);
            document.getElementById('dbConnections').textContent = 
                data.database?.connectionsActive || '0';
            document.getElementById('queueSize').textContent = 
                data.system?.queueSize || '0';
            document.getElementById('activeClients').textContent = 
                data.system?.activeClients || '0';
            document.getElementById('blockedClients').textContent = 
                data.system?.blockedClients + ' blocked' || '0 blocked';
            document.getElementById('errorCount').textContent = 
                data.system?.errorCount || '0';
        }
        
        function updateCharts() {
            const labels = metricsHistory.map((_, i) => 
                new Date(Date.now() - (maxDataPoints - i) * 5000).toLocaleTimeString()
            );
            
            // Update cache chart
            cacheChart.data.labels = labels;
            cacheChart.data.datasets[0].data = metricsHistory.map(m => m.cache?.hitRate || 0);
            cacheChart.update();
            
            // Update response chart
            responseChart.data.labels = labels;
            responseChart.data.datasets[0].data = metricsHistory.map(m => m.performance?.responseTime || 0);
            responseChart.data.datasets[1].data = metricsHistory.map(m => m.database?.responseTime || 0);
            responseChart.update();
            
            // Update speed chart
            speedChart.data.labels = labels.slice(-5);
            speedChart.data.datasets[0].data = metricsHistory.slice(-5).map(m => 
                m.performance?.processingSpeed || 0
            );
            speedChart.update();
        }
        
        async function loadCacheDetails() {
            try {
                const response = await fetch('/api/performance?action=cache-details');
                const data = await response.json();
                updateCacheTable(data);
            } catch (error) {
                console.error('Failed to load cache details:', error);
            }
        }
        
        function updateCacheTable(data) {
            const tbody = document.getElementById('cacheDetailsTable');
            
            if (!data.entries || data.entries.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">No cache entries</td></tr>';
                return;
            }
            
            // Group by key pattern
            const patterns = {};
            data.entries.forEach(entry => {
                const pattern = entry.key.split(':')[0];
                if (!patterns[pattern]) {
                    patterns[pattern] = {
                        count: 0,
                        size: 0,
                        accessCount: 0,
                        priority: entry.priority
                    };
                }
                patterns[pattern].count++;
                patterns[pattern].size += entry.size;
                patterns[pattern].accessCount += entry.accessCount;
            });
            
            tbody.innerHTML = Object.entries(patterns).map(([pattern, stats]) => \`
                <tr>
                    <td>\${pattern}</td>
                    <td>\${stats.count}</td>
                    <td>\${((stats.accessCount / stats.count) * 10).toFixed(1)}%</td>
                    <td>\${formatBytes(stats.size)}</td>
                    <td><span class="status-indicator status-\${stats.priority === 'high' ? 'healthy' : 'warning'}"></span>\${stats.priority}</td>
                </tr>
            \`).join('');
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        async function clearCache() {
            if (!confirm('Clear all cache entries?')) return;
            
            const response = await fetch('/api/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear-cache' })
            });
            
            if (response.ok) {
                alert('Cache cleared successfully');
                loadMetrics();
                loadCacheDetails();
            }
        }
        
        async function optimizeDB() {
            const response = await fetch('/api/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'optimize-db' })
            });
            
            if (response.ok) {
                alert('Database optimized with indexes');
                loadMetrics();
            }
        }
        
        async function resetRateLimits() {
            if (!confirm('Reset all rate limits?')) return;
            
            const response = await fetch('/api/performance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset-rate-limits' })
            });
            
            if (response.ok) {
                alert('Rate limits reset');
                loadMetrics();
            }
        }
        
        function refreshMetrics() {
            loadMetrics();
            loadCacheDetails();
        }
        
        function exportData() {
            const data = {
                timestamp: new Date().toISOString(),
                metrics: metricsHistory,
                stats: {
                    averageCacheHitRate: metricsHistory.reduce((sum, m) => sum + (m.cache?.hitRate || 0), 0) / metricsHistory.length,
                    averageResponseTime: metricsHistory.reduce((sum, m) => sum + (m.performance?.responseTime || 0), 0) / metricsHistory.length
                }
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'performance-data-' + Date.now() + '.json';
            a.click();
        }
        
        // Load initial data
        loadMetrics();
        loadCacheDetails();
        
        // Auto-refresh every 5 seconds
        setInterval(() => {
            loadMetrics();
        }, 5000);
        
        // Refresh cache details every 30 seconds
        setInterval(() => {
            loadCacheDetails();
        }, 30000);
    </script>
</body>
</html>
  `;
}