import { supabase } from '../lib/supabase-client';
import { notifications } from './realtime-notifications-service';
import { EventEmitter } from 'events';

/**
 * Comprehensive Monitoring and Alerting Service
 * Tracks system health, performance, and alerts on issues
 */

interface MetricPoint {
  timestamp: Date;
  value: number;
  metadata?: any;
}

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  condition: string;
  currentValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
}

interface AlertRule {
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'change';
  threshold: number;
  duration?: number; // milliseconds
  level: Alert['level'];
  message: string;
  cooldown?: number; // milliseconds
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  diskUsage: number;
  networkLatency: number;
  errorRate: number;
  responseTime: number;
  throughput: number;
  queueSize: number;
  cacheHitRate: number;
  dbConnections: number;
}

export class MonitoringAlertingService extends EventEmitter {
  private metrics: Map<string, MetricPoint[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private alertRules: AlertRule[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastAlertTimes: Map<string, number> = new Map();
  
  // Default alert rules
  private readonly defaultRules: AlertRule[] = [
    {
      metric: 'errorRate',
      condition: 'above',
      threshold: 0.05, // 5% error rate
      duration: 300000, // 5 minutes
      level: 'warning',
      message: 'Error rate exceeds 5%',
      cooldown: 3600000 // 1 hour
    },
    {
      metric: 'errorRate',
      condition: 'above',
      threshold: 0.1, // 10% error rate
      duration: 60000, // 1 minute
      level: 'critical',
      message: 'CRITICAL: Error rate exceeds 10%',
      cooldown: 1800000 // 30 minutes
    },
    {
      metric: 'responseTime',
      condition: 'above',
      threshold: 5000, // 5 seconds
      duration: 600000, // 10 minutes
      level: 'warning',
      message: 'Response time exceeds 5 seconds',
      cooldown: 3600000
    },
    {
      metric: 'memory',
      condition: 'above',
      threshold: 0.9, // 90% memory usage
      duration: 300000,
      level: 'error',
      message: 'Memory usage critical (>90%)',
      cooldown: 1800000
    },
    {
      metric: 'queueSize',
      condition: 'above',
      threshold: 1000,
      duration: 900000, // 15 minutes
      level: 'warning',
      message: 'Queue backlog exceeds 1000 items',
      cooldown: 3600000
    },
    {
      metric: 'cacheHitRate',
      condition: 'below',
      threshold: 0.5, // 50% hit rate
      duration: 1800000, // 30 minutes
      level: 'info',
      message: 'Cache hit rate below 50%',
      cooldown: 7200000 // 2 hours
    },
    {
      metric: 'dbConnections',
      condition: 'above',
      threshold: 90, // Near connection limit
      duration: 60000,
      level: 'error',
      message: 'Database connection pool near limit',
      cooldown: 900000
    },
    {
      metric: 'throughput',
      condition: 'below',
      threshold: 10, // items per minute
      duration: 1800000,
      level: 'warning',
      message: 'Processing throughput below expected',
      cooldown: 3600000
    }
  ];
  
  constructor() {
    super();
    this.initializeRules();
    this.startMonitoring();
  }
  
  /**
   * Initialize alert rules
   */
  private initializeRules(): void {
    this.alertRules = [...this.defaultRules];
    this.loadCustomRules();
  }
  
  /**
   * Start continuous monitoring
   */
  private startMonitoring(intervalMs: number = 60000): void {
    console.log('[Monitoring] Starting system monitoring...');
    
    // Initial collection
    this.collectMetrics();
    
    // Set up interval
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.evaluateAlertRules();
      await this.cleanupOldData();
    }, intervalMs);
  }
  
  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      
      // Store each metric
      for (const [key, value] of Object.entries(metrics)) {
        this.recordMetric(key, value);
      }
      
      // Store in database for historical analysis
      await this.storeMetrics(metrics);
      
      // Emit metrics event
      this.emit('metrics', metrics);
      
    } catch (error) {
      console.error('[Monitoring] Failed to collect metrics:', error);
      this.recordMetric('monitoringErrors', 1);
    }
  }
  
  /**
   * Gather all system metrics
   */
  private async gatherSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      cpu: 0,
      memory: 0,
      diskUsage: 0,
      networkLatency: 0,
      errorRate: 0,
      responseTime: 0,
      throughput: 0,
      queueSize: 0,
      cacheHitRate: 0,
      dbConnections: 0
    };
    
    // CPU and Memory (would use actual system monitoring in production)
    metrics.cpu = Math.random() * 0.8; // Mock: 0-80%
    metrics.memory = Math.random() * 0.9; // Mock: 0-90%
    metrics.diskUsage = Math.random() * 0.7; // Mock: 0-70%
    
    // Network latency
    const pingStart = Date.now();
    try {
      await supabase.from('system_settings').select('key').limit(1).single();
      metrics.networkLatency = Date.now() - pingStart;
    } catch {
      metrics.networkLatency = 999999; // Failed
    }
    
    // Error rate from recent logs
    try {
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString();
      const { data: errorLogs } = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('timestamp', fiveMinutesAgo);
      
      const { data: totalLogs } = await supabase
        .from('operation_metrics')
        .select('id', { count: 'exact', head: true })
        .gte('timestamp', fiveMinutesAgo);
      
      if (totalLogs && errorLogs) {
        metrics.errorRate = totalLogs > 0 ? errorLogs / totalLogs : 0;
      }
    } catch (error) {
      console.error('[Monitoring] Failed to calculate error rate:', error);
    }
    
    // Response time from recent operations
    try {
      const { data: recentOps } = await supabase
        .from('operation_metrics')
        .select('duration')
        .gte('timestamp', new Date(Date.now() - 300000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (recentOps && recentOps.length > 0) {
        const avgDuration = recentOps.reduce((sum, op) => sum + (op.duration || 0), 0) / recentOps.length;
        metrics.responseTime = avgDuration;
      }
    } catch (error) {
      console.error('[Monitoring] Failed to calculate response time:', error);
    }
    
    // Throughput
    try {
      const { data: processed } = await supabase
        .from('content_queue')
        .select('id', { count: 'exact', head: true })
        .in('status', ['approved', 'rejected'])
        .gte('processed_at', new Date(Date.now() - 60000).toISOString());
      
      metrics.throughput = processed || 0;
    } catch (error) {
      console.error('[Monitoring] Failed to calculate throughput:', error);
    }
    
    // Queue size
    try {
      const { count } = await supabase
        .from('content_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      metrics.queueSize = count || 0;
    } catch (error) {
      console.error('[Monitoring] Failed to get queue size:', error);
    }
    
    // Cache hit rate (would get from cache service in production)
    metrics.cacheHitRate = 0.75 + Math.random() * 0.2; // Mock: 75-95%
    
    // Database connections (would get from connection pool in production)
    metrics.dbConnections = Math.floor(Math.random() * 100); // Mock: 0-100
    
    return metrics;
  }
  
  /**
   * Record a metric point
   */
  recordMetric(name: string, value: number, metadata?: any): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const points = this.metrics.get(name)!;
    points.push({
      timestamp: new Date(),
      value,
      metadata
    });
    
    // Keep only last 1000 points per metric
    if (points.length > 1000) {
      points.shift();
    }
  }
  
  /**
   * Evaluate alert rules
   */
  private async evaluateAlertRules(): Promise<void> {
    for (const rule of this.alertRules) {
      await this.evaluateRule(rule);
    }
  }
  
  /**
   * Evaluate a single alert rule
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const metricData = this.metrics.get(rule.metric);
    if (!metricData || metricData.length === 0) return;
    
    // Check cooldown
    const lastAlertTime = this.lastAlertTimes.get(rule.metric) || 0;
    if (rule.cooldown && Date.now() - lastAlertTime < rule.cooldown) {
      return; // Still in cooldown period
    }
    
    // Get recent values based on duration
    const duration = rule.duration || 60000; // Default 1 minute
    const cutoff = new Date(Date.now() - duration);
    const recentValues = metricData.filter(p => p.timestamp > cutoff);
    
    if (recentValues.length === 0) return;
    
    // Calculate average value
    const avgValue = recentValues.reduce((sum, p) => sum + p.value, 0) / recentValues.length;
    
    // Check condition
    let shouldAlert = false;
    
    switch (rule.condition) {
      case 'above':
        shouldAlert = avgValue > rule.threshold;
        break;
      case 'below':
        shouldAlert = avgValue < rule.threshold;
        break;
      case 'equals':
        shouldAlert = Math.abs(avgValue - rule.threshold) < 0.001;
        break;
      case 'change':
        // Check for rapid change
        if (recentValues.length >= 2) {
          const change = Math.abs(
            recentValues[recentValues.length - 1].value - recentValues[0].value
          );
          shouldAlert = change > rule.threshold;
        }
        break;
    }
    
    if (shouldAlert) {
      await this.triggerAlert(rule, avgValue);
    } else {
      // Check if we should resolve an existing alert
      await this.checkAlertResolution(rule.metric);
    }
  }
  
  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const alertId = `${rule.metric}-${rule.condition}-${rule.threshold}`;
    
    // Check if alert already exists
    if (this.alerts.has(alertId)) {
      const existingAlert = this.alerts.get(alertId)!;
      if (!existingAlert.resolvedAt) {
        return; // Alert already active
      }
    }
    
    const alert: Alert = {
      id: alertId,
      level: rule.level,
      metric: rule.metric,
      condition: `${rule.condition} ${rule.threshold}`,
      currentValue,
      threshold: rule.threshold,
      message: rule.message,
      timestamp: new Date(),
      acknowledged: false
    };
    
    // Store alert
    this.alerts.set(alertId, alert);
    this.lastAlertTimes.set(rule.metric, Date.now());
    
    // Send notification
    await this.sendAlertNotification(alert);
    
    // Store in database
    await this.storeAlert(alert);
    
    // Emit alert event
    this.emit('alert', alert);
    
    console.log(`[Alert] ${rule.level.toUpperCase()}: ${rule.message} (${currentValue})`);
  }
  
  /**
   * Check if an alert should be resolved
   */
  private async checkAlertResolution(metric: string): Promise<void> {
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.metric === metric && !alert.resolvedAt) {
        // Alert condition no longer met, resolve it
        alert.resolvedAt = new Date();
        
        // Update in database
        await supabase
          .from('alerts')
          .update({ resolved_at: alert.resolvedAt.toISOString() })
          .eq('id', alertId);
        
        // Send resolution notification
        await notifications.send(
          'system_alert',
          `Alert resolved: ${alert.message}`,
          {
            severity: 'info',
            metadata: { alert }
          }
        );
        
        // Emit resolution event
        this.emit('alert-resolved', alert);
        
        console.log(`[Alert] RESOLVED: ${alert.message}`);
      }
    }
  }
  
  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: Alert): Promise<void> {
    const notificationType = alert.level === 'critical' ? 'system_alert' : 'performance_warning';
    
    await notifications.send(
      notificationType,
      alert.message,
      {
        severity: alert.level === 'critical' ? 'error' : alert.level,
        actionUrl: '/api/monitoring?alert=' + alert.id,
        actionLabel: 'View Details',
        metadata: {
          metric: alert.metric,
          value: alert.currentValue,
          threshold: alert.threshold
        }
      }
    );
    
    // For critical alerts, also try to send email/SMS
    if (alert.level === 'critical') {
      await this.sendCriticalAlertExternal(alert);
    }
  }
  
  /**
   * Send critical alert via external channels
   */
  private async sendCriticalAlertExternal(alert: Alert): Promise<void> {
    try {
      // Store in urgent queue for external notification service
      await supabase.from('urgent_alerts').insert({
        alert_id: alert.id,
        level: alert.level,
        message: alert.message,
        metric: alert.metric,
        value: alert.currentValue,
        created_at: alert.timestamp.toISOString()
      });
      
      // In production, this would trigger SMS/email/Slack/PagerDuty
      console.error(`[CRITICAL ALERT] ${alert.message}`);
    } catch (error) {
      console.error('[Monitoring] Failed to send critical alert:', error);
    }
  }
  
  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await supabase.from('system_metrics').insert({
        ...metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Monitoring] Failed to store metrics:', error);
    }
  }
  
  /**
   * Store alert in database
   */
  private async storeAlert(alert: Alert): Promise<void> {
    try {
      await supabase.from('alerts').insert({
        id: alert.id,
        level: alert.level,
        metric: alert.metric,
        condition: alert.condition,
        current_value: alert.currentValue,
        threshold: alert.threshold,
        message: alert.message,
        acknowledged: alert.acknowledged,
        created_at: alert.timestamp.toISOString()
      });
    } catch (error) {
      console.error('[Monitoring] Failed to store alert:', error);
    }
  }
  
  /**
   * Clean up old data
   */
  private async cleanupOldData(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Clean up old metrics in memory
    for (const [metric, points] of this.metrics.entries()) {
      const filtered = points.filter(p => p.timestamp > cutoff);
      this.metrics.set(metric, filtered);
    }
    
    // Clean up old resolved alerts
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolvedAt && alert.resolvedAt < cutoff) {
        this.alerts.delete(alertId);
      }
    }
  }
  
  /**
   * Load custom alert rules from database
   */
  private async loadCustomRules(): Promise<void> {
    try {
      const { data: customRules } = await supabase
        .from('alert_rules')
        .select('*')
        .eq('active', true);
      
      if (customRules) {
        this.alertRules.push(...customRules.map(r => ({
          metric: r.metric,
          condition: r.condition,
          threshold: r.threshold,
          duration: r.duration,
          level: r.level,
          message: r.message,
          cooldown: r.cooldown
        })));
      }
    } catch (error) {
      console.error('[Monitoring] Failed to load custom rules:', error);
    }
  }
  
  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    console.log(`[Monitoring] Added alert rule for ${rule.metric}`);
  }
  
  /**
   * Remove alert rule
   */
  removeAlertRule(metric: string, condition: string): void {
    this.alertRules = this.alertRules.filter(
      r => !(r.metric === metric && r.condition === condition)
    );
  }
  
  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      
      await supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('id', alertId);
      
      this.emit('alert-acknowledged', alert);
    }
  }
  
  /**
   * Get current metrics
   */
  getCurrentMetrics(): Map<string, MetricPoint[]> {
    return new Map(this.metrics);
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(a => !a.resolvedAt)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  /**
   * Get metric history
   */
  getMetricHistory(
    metric: string,
    duration: number = 3600000 // 1 hour default
  ): MetricPoint[] {
    const points = this.metrics.get(metric) || [];
    const cutoff = new Date(Date.now() - duration);
    return points.filter(p => p.timestamp > cutoff);
  }
  
  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: 'healthy' | 'degraded' | 'critical';
    activeAlerts: number;
    criticalAlerts: number;
    metrics: Partial<SystemMetrics>;
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical');
    
    // Get latest metrics
    const latestMetrics: Partial<SystemMetrics> = {};
    for (const [key, points] of this.metrics.entries()) {
      if (points.length > 0) {
        latestMetrics[key as keyof SystemMetrics] = points[points.length - 1].value;
      }
    }
    
    // Determine overall status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (activeAlerts.length > 2) {
      status = 'degraded';
    }
    
    return {
      status,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      metrics: latestMetrics
    };
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Monitoring] Monitoring stopped');
    }
  }
}

// Export singleton instance
export const monitoring = new MonitoringAlertingService();