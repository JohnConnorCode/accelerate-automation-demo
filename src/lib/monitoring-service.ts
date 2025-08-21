import { supabase } from './supabase';
import { notificationService } from './notification-service';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  metrics?: Record<string, any>;
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  details?: any;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

interface Metric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: Date;
}

export class MonitoringService {
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private metrics: Metric[] = [];
  private thresholds: Map<string, { warning: number; critical: number }> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupThresholds();
    this.startMonitoring();
  }

  private setupThresholds() {
    // Response time thresholds (ms)
    this.thresholds.set('api_response_time', { warning: 1000, critical: 3000 });
    
    // Queue size thresholds
    this.thresholds.set('queue_size', { warning: 1000, critical: 5000 });
    
    // Error rate thresholds (percentage)
    this.thresholds.set('error_rate', { warning: 5, critical: 10 });
    
    // Memory usage thresholds (MB)
    this.thresholds.set('memory_usage', { warning: 400, critical: 450 });
    
    // Token usage thresholds (per hour)
    this.thresholds.set('token_usage', { warning: 90000, critical: 95000 });
    
    // Duplicate rate thresholds (percentage)
    this.thresholds.set('duplicate_rate', { warning: 30, critical: 50 });
  }

  private startMonitoring() {
    // Run health checks every minute
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, 60000);

    // Initial check
    this.runHealthChecks();
  }

  private async runHealthChecks() {
    await Promise.all([
      this.checkDatabase(),
      this.checkAPIEndpoints(),
      this.checkQueueHealth(),
      this.checkAIService(),
      this.checkMemoryUsage(),
      this.checkErrorRates(),
      this.checkFetcherHealth(),
    ]);

    // Check for threshold violations
    this.checkThresholds();
  }

  private async checkDatabase(): Promise<void> {
    try {
      const start = Date.now();
      const { error } = await supabase
        .from('content_queue')
        .select('count', { count: 'exact', head: true });

      const responseTime = Date.now() - start;

      if (error) {
        this.updateHealthCheck('database', 'unhealthy', error.message);
        this.createAlert('critical', 'database', 'Database connection failed', error);
      } else if (responseTime > 1000) {
        this.updateHealthCheck('database', 'degraded', `Slow response: ${responseTime}ms`);
        this.createAlert('warning', 'database', `Database response time degraded: ${responseTime}ms`);
      } else {
        this.updateHealthCheck('database', 'healthy', `Response time: ${responseTime}ms`);
        this.resolveAlert('database');
      }

      this.recordMetric('database_response_time', responseTime, 'ms');
    } catch (error: any) {
      this.updateHealthCheck('database', 'unhealthy', error.message);
      this.createAlert('critical', 'database', 'Database check failed', error);
    }
  }

  private async checkAPIEndpoints(): Promise<void> {
    const endpoints = [
      '/api/health',
      '/api/cron/fetch-content',
      '/api/admin/queue',
    ];

    for (const endpoint of endpoints) {
      try {
        const start = Date.now();
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        const responseTime = Date.now() - start;
        const serviceName = `api_${endpoint.replace(/\//g, '_')}`;

        if (!response.ok) {
          this.updateHealthCheck(serviceName, 'unhealthy', `HTTP ${response.status}`);
          this.createAlert('error', serviceName, `API endpoint ${endpoint} returned ${response.status}`);
        } else if (responseTime > 2000) {
          this.updateHealthCheck(serviceName, 'degraded', `Slow: ${responseTime}ms`);
        } else {
          this.updateHealthCheck(serviceName, 'healthy');
          this.resolveAlert(serviceName);
        }

        this.recordMetric(`api_response_time_${endpoint}`, responseTime, 'ms');
      } catch (error: any) {
        const serviceName = `api_${endpoint.replace(/\//g, '_')}`;
        this.updateHealthCheck(serviceName, 'unhealthy', error.message);
        this.createAlert('error', serviceName, `API endpoint ${endpoint} failed`, error);
      }
    }
  }

  private async checkQueueHealth(): Promise<void> {
    try {
      const { data: queueStats, error } = await supabase
        .from('content_queue')
        .select('status')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;

      const stats = {
        total: queueStats?.length || 0,
        pending: queueStats?.filter(i => i.status === 'pending').length || 0,
        approved: queueStats?.filter(i => i.status === 'approved').length || 0,
        rejected: queueStats?.filter(i => i.status === 'rejected').length || 0,
        duplicate: queueStats?.filter(i => i.status === 'duplicate').length || 0,
      };

      // Check queue size
      if (stats.pending > 5000) {
        this.updateHealthCheck('queue', 'unhealthy', `Queue backlog: ${stats.pending} items`);
        this.createAlert('critical', 'queue', `Queue backlog critical: ${stats.pending} pending items`);
      } else if (stats.pending > 1000) {
        this.updateHealthCheck('queue', 'degraded', `Queue size: ${stats.pending} items`);
        this.createAlert('warning', 'queue', `Queue size warning: ${stats.pending} pending items`);
      } else {
        this.updateHealthCheck('queue', 'healthy', `Queue size: ${stats.pending} items`);
        this.resolveAlert('queue');
      }

      // Record metrics
      this.recordMetric('queue_size_total', stats.total);
      this.recordMetric('queue_size_pending', stats.pending);
      this.recordMetric('queue_approval_rate', stats.total > 0 ? stats.approved / stats.total : 0);
      this.recordMetric('queue_duplicate_rate', stats.total > 0 ? stats.duplicate / stats.total : 0);

    } catch (error: any) {
      this.updateHealthCheck('queue', 'unhealthy', error.message);
      this.createAlert('error', 'queue', 'Queue health check failed', error);
    }
  }

  private async checkAIService(): Promise<void> {
    try {
      // Check AI processing stats
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: aiLogs, error } = await supabase
        .from('ai_processing_log')
        .select('total_tokens, success, processing_time_ms')
        .gte('created_at', oneHourAgo.toISOString());

      if (error) throw error;

      const stats = {
        totalTokens: aiLogs?.reduce((sum, log) => sum + (log.total_tokens || 0), 0) || 0,
        successRate: aiLogs?.length ? aiLogs.filter(l => l.success).length / aiLogs.length : 0,
        avgProcessingTime: aiLogs?.length ? 
          aiLogs.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / aiLogs.length : 0,
      };

      // Check token usage
      if (stats.totalTokens > 95000) {
        this.updateHealthCheck('ai_service', 'unhealthy', `Token limit critical: ${stats.totalTokens}/100000`);
        this.createAlert('critical', 'ai_service', `AI token usage critical: ${stats.totalTokens} tokens/hour`);
      } else if (stats.totalTokens > 90000) {
        this.updateHealthCheck('ai_service', 'degraded', `Token usage high: ${stats.totalTokens}/100000`);
        this.createAlert('warning', 'ai_service', `AI token usage warning: ${stats.totalTokens} tokens/hour`);
      } else {
        this.updateHealthCheck('ai_service', 'healthy', `Tokens: ${stats.totalTokens}, Success: ${(stats.successRate * 100).toFixed(1)}%`);
        this.resolveAlert('ai_service');
      }

      // Record metrics
      this.recordMetric('ai_tokens_per_hour', stats.totalTokens);
      this.recordMetric('ai_success_rate', stats.successRate * 100, '%');
      this.recordMetric('ai_avg_processing_time', stats.avgProcessingTime, 'ms');

    } catch (error: any) {
      this.updateHealthCheck('ai_service', 'unhealthy', error.message);
      this.createAlert('error', 'ai_service', 'AI service check failed', error);
    }
  }

  private async checkMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;

    if (heapUsedMB > 450) {
      this.updateHealthCheck('memory', 'unhealthy', `Heap: ${heapUsedMB.toFixed(0)}MB`);
      this.createAlert('critical', 'memory', `Memory usage critical: ${heapUsedMB.toFixed(0)}MB`);
    } else if (heapUsedMB > 400) {
      this.updateHealthCheck('memory', 'degraded', `Heap: ${heapUsedMB.toFixed(0)}MB`);
      this.createAlert('warning', 'memory', `Memory usage warning: ${heapUsedMB.toFixed(0)}MB`);
    } else {
      this.updateHealthCheck('memory', 'healthy', `Heap: ${heapUsedMB.toFixed(0)}MB`);
      this.resolveAlert('memory');
    }

    // Record metrics
    this.recordMetric('memory_heap_used', heapUsedMB, 'MB');
    this.recordMetric('memory_heap_total', heapTotalMB, 'MB');
    this.recordMetric('memory_rss', rssMB, 'MB');
  }

  private async checkErrorRates(): Promise<void> {
    try {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      // Check fetch errors
      const { data: fetchHistory, error: fetchError } = await supabase
        .from('fetch_history')
        .select('success')
        .gte('created_at', oneHourAgo.toISOString());

      if (fetchError) throw fetchError;

      const fetchErrorRate = fetchHistory?.length ? 
        (fetchHistory.filter(f => !f.success).length / fetchHistory.length) * 100 : 0;

      // Check webhook delivery errors
      const { data: webhookDeliveries, error: webhookError } = await supabase
        .from('webhook_deliveries')
        .select('status')
        .gte('delivered_at', oneHourAgo.toISOString());

      if (webhookError) throw webhookError;

      const webhookErrorRate = webhookDeliveries?.length ?
        (webhookDeliveries.filter(d => d.status === 'failed').length / webhookDeliveries.length) * 100 : 0;

      const overallErrorRate = Math.max(fetchErrorRate, webhookErrorRate);

      if (overallErrorRate > 10) {
        this.updateHealthCheck('error_rates', 'unhealthy', `Error rate: ${overallErrorRate.toFixed(1)}%`);
        this.createAlert('critical', 'error_rates', `Error rate critical: ${overallErrorRate.toFixed(1)}%`);
      } else if (overallErrorRate > 5) {
        this.updateHealthCheck('error_rates', 'degraded', `Error rate: ${overallErrorRate.toFixed(1)}%`);
        this.createAlert('warning', 'error_rates', `Error rate warning: ${overallErrorRate.toFixed(1)}%`);
      } else {
        this.updateHealthCheck('error_rates', 'healthy', `Error rate: ${overallErrorRate.toFixed(1)}%`);
        this.resolveAlert('error_rates');
      }

      // Record metrics
      this.recordMetric('fetch_error_rate', fetchErrorRate, '%');
      this.recordMetric('webhook_error_rate', webhookErrorRate, '%');
      this.recordMetric('overall_error_rate', overallErrorRate, '%');

    } catch (error: any) {
      this.updateHealthCheck('error_rates', 'unhealthy', error.message);
      this.createAlert('error', 'error_rates', 'Error rate check failed', error);
    }
  }

  private async checkFetcherHealth(): Promise<void> {
    try {
      const { data: recentFetches, error } = await supabase
        .from('fetch_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Check if fetchers are running
      const lastFetch = recentFetches?.[0];
      if (lastFetch) {
        const hoursSinceLastFetch = (Date.now() - new Date(lastFetch.created_at).getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastFetch > 24) {
          this.updateHealthCheck('fetchers', 'unhealthy', `No fetches in ${hoursSinceLastFetch.toFixed(0)} hours`);
          this.createAlert('critical', 'fetchers', `Fetchers not running for ${hoursSinceLastFetch.toFixed(0)} hours`);
        } else if (hoursSinceLastFetch > 12) {
          this.updateHealthCheck('fetchers', 'degraded', `Last fetch ${hoursSinceLastFetch.toFixed(1)} hours ago`);
          this.createAlert('warning', 'fetchers', `No recent fetches for ${hoursSinceLastFetch.toFixed(1)} hours`);
        } else {
          this.updateHealthCheck('fetchers', 'healthy', `Last fetch ${hoursSinceLastFetch.toFixed(1)} hours ago`);
          this.resolveAlert('fetchers');
        }
      }

      // Check individual fetcher performance
      const fetcherStats = new Map<string, { success: number; total: number }>();
      recentFetches?.forEach(fetch => {
        const stats = fetcherStats.get(fetch.fetcher_name) || { success: 0, total: 0 };
        stats.total++;
        if (fetch.success) stats.success++;
        fetcherStats.set(fetch.fetcher_name, stats);
      });

      fetcherStats.forEach((stats, fetcher) => {
        const successRate = stats.total > 0 ? stats.success / stats.total : 0;
        this.recordMetric(`fetcher_success_rate_${fetcher}`, successRate * 100, '%');
      });

    } catch (error: any) {
      this.updateHealthCheck('fetchers', 'unhealthy', error.message);
      this.createAlert('error', 'fetchers', 'Fetcher health check failed', error);
    }
  }

  private checkThresholds() {
    // Check recent metrics against thresholds
    const recentMetrics = this.getRecentMetrics(5); // Last 5 minutes

    this.thresholds.forEach((threshold, metricName) => {
      const metrics = recentMetrics.filter(m => m.name === metricName);
      if (metrics.length === 0) return;

      const avgValue = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;

      if (avgValue > threshold.critical) {
        this.createAlert('critical', metricName, 
          `${metricName} exceeded critical threshold: ${avgValue.toFixed(2)} > ${threshold.critical}`);
      } else if (avgValue > threshold.warning) {
        this.createAlert('warning', metricName,
          `${metricName} exceeded warning threshold: ${avgValue.toFixed(2)} > ${threshold.warning}`);
      } else {
        this.resolveAlert(metricName);
      }
    });
  }

  private updateHealthCheck(service: string, status: 'healthy' | 'degraded' | 'unhealthy', message?: string) {
    this.healthChecks.set(service, {
      service,
      status,
      message,
      lastCheck: new Date(),
    });

    // Log to database
    this.logHealthCheck(service, status, message);
  }

  private async logHealthCheck(service: string, status: string, message?: string) {
    try {
      await supabase
        .from('monitoring_health_checks')
        .insert({
          service,
          status,
          message,
          checked_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('[Monitoring] Failed to log health check:', error);
    }
  }

  private createAlert(
    severity: 'info' | 'warning' | 'error' | 'critical',
    service: string,
    message: string,
    details?: any
  ) {
    const alertId = `${service}_${severity}`;
    
    // Check if alert already exists
    const existingAlert = this.alerts.get(alertId);
    if (existingAlert && !existingAlert.resolved) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: alertId,
      severity,
      service,
      message,
      details,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.set(alertId, alert);

    // Send notification for critical alerts
    if (severity === 'critical' || severity === 'error') {
      this.sendAlertNotification(alert);
    }

    // Log to database
    this.logAlert(alert);
  }

  private resolveAlert(service: string) {
    // Resolve all alerts for this service
    this.alerts.forEach((alert, id) => {
      if (alert.service === service && !alert.resolved) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.logAlertResolution(alert);
      }
    });
  }

  private async sendAlertNotification(alert: Alert) {
    const message = `🚨 ${alert.severity.toUpperCase()}: ${alert.message}\n\nService: ${alert.service}\nTime: ${alert.timestamp.toISOString()}`;

    // Send via multiple channels
    await Promise.all([
      notificationService.sendEmail(
        process.env.ADMIN_EMAIL!,
        `[${alert.severity.toUpperCase()}] ${alert.service} Alert`,
        message
      ),
      notificationService.sendSlack(message, alert.severity as any),
      notificationService.sendDiscord(message, alert.severity === 'critical' ? 'error' : 'warning'),
    ]);
  }

  private async logAlert(alert: Alert) {
    try {
      await supabase
        .from('monitoring_alerts')
        .insert({
          alert_id: alert.id,
          severity: alert.severity,
          service: alert.service,
          message: alert.message,
          details: alert.details,
          created_at: alert.timestamp.toISOString(),
        });
    } catch (error) {
      console.error('[Monitoring] Failed to log alert:', error);
    }
  }

  private async logAlertResolution(alert: Alert) {
    try {
      await supabase
        .from('monitoring_alerts')
        .update({
          resolved: true,
          resolved_at: alert.resolvedAt?.toISOString(),
        })
        .eq('alert_id', alert.id);
    } catch (error) {
      console.error('[Monitoring] Failed to log alert resolution:', error);
    }
  }

  private recordMetric(name: string, value: number, unit?: string, tags?: Record<string, string>) {
    const metric: Metric = {
      name,
      value,
      unit,
      tags,
      timestamp: new Date(),
    };

    this.metrics.push(metric);

    // Keep only last hour of metrics in memory
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    // Log to database
    this.logMetric(metric);
  }

  private async logMetric(metric: Metric) {
    try {
      await supabase
        .from('monitoring_metrics')
        .insert({
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          tags: metric.tags,
          timestamp: metric.timestamp.toISOString(),
        });
    } catch (error) {
      console.error('[Monitoring] Failed to log metric:', error);
    }
  }

  private getRecentMetrics(minutes: number): Metric[] {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - minutes);
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  // Public API
  public getHealthStatus(): { overall: string; services: HealthCheck[] } {
    const services = Array.from(this.healthChecks.values());
    const unhealthy = services.filter(s => s.status === 'unhealthy').length;
    const degraded = services.filter(s => s.status === 'degraded').length;

    let overall = 'healthy';
    if (unhealthy > 0) overall = 'unhealthy';
    else if (degraded > 0) overall = 'degraded';

    return { overall, services };
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(a => !a.resolved);
  }

  public getMetrics(name?: string, minutes = 60): Metric[] {
    const recent = this.getRecentMetrics(minutes);
    return name ? recent.filter(m => m.name === name) : recent;
  }

  public async getSystemReport(): Promise<any> {
    const health = this.getHealthStatus();
    const alerts = this.getActiveAlerts();
    const metrics = this.getRecentMetrics(60);

    // Aggregate metrics
    const metricSummary: Record<string, any> = {};
    const metricGroups = new Map<string, Metric[]>();
    
    metrics.forEach(m => {
      const group = metricGroups.get(m.name) || [];
      group.push(m);
      metricGroups.set(m.name, group);
    });

    metricGroups.forEach((metrics, name) => {
      const values = metrics.map(m => m.value);
      metricSummary[name] = {
        current: values[values.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        unit: metrics[0].unit,
      };
    });

    return {
      timestamp: new Date().toISOString(),
      health,
      alerts: {
        active: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        error: alerts.filter(a => a.severity === 'error').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        details: alerts,
      },
      metrics: metricSummary,
    };
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Export singleton
export const monitoringService = new MonitoringService();