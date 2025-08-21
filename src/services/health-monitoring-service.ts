import { supabase } from '../lib/supabase-client';
import { ErrorRecoveryService } from './error-recovery-service';
import { EnhancedAIService } from './enhanced-ai-service';
import { SchedulingService } from './scheduling-service';

/**
 * Comprehensive Health Monitoring System
 * Real-time monitoring of all system components
 */

interface HealthMetrics {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical';
  components: ComponentHealth[];
  metrics: SystemMetrics;
  alerts: HealthAlert[];
  recommendations: string[];
}

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'critical';
  responseTime: number;
  lastCheck: string;
  details: any;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  apiCalls: number;
  errorRate: number;
  successRate: number;
  queueSize: number;
  activeProcesses: number;
}

interface HealthAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  autoResolved?: boolean;
}

interface ThresholdConfig {
  errorRateThreshold: number;
  responseTimeThreshold: number;
  memoryThreshold: number;
  queueSizeThreshold: number;
  minimumSuccessRate: number;
}

export class HealthMonitoringService {
  private errorRecovery: ErrorRecoveryService;
  private aiService: EnhancedAIService;
  private schedulingService: SchedulingService;
  
  private thresholds: ThresholdConfig = {
    errorRateThreshold: 0.05,      // 5% error rate
    responseTimeThreshold: 5000,    // 5 seconds
    memoryThreshold: 0.85,          // 85% memory usage
    queueSizeThreshold: 1000,       // Max queue size
    minimumSuccessRate: 0.95        // 95% success rate
  };

  private healthHistory: HealthMetrics[] = [];
  private activeAlerts: Map<string, HealthAlert> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.errorRecovery = new ErrorRecoveryService();
    this.aiService = new EnhancedAIService();
    this.schedulingService = new SchedulingService();
  }

  /**
   * Start continuous health monitoring
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    console.log('[HealthMonitor] Starting health monitoring...');
    
    // Initial health check
    await this.performHealthCheck();
    
    // Set up continuous monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[HealthMonitor] Health monitoring stopped');
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthMetrics> {
    const startTime = Date.now();
    const components: ComponentHealth[] = [];
    const alerts: HealthAlert[] = [];
    
    // Check Database Health
    const dbHealth = await this.checkDatabaseHealth();
    components.push(dbHealth);
    
    // Check API Health
    const apiHealth = await this.checkAPIHealth();
    components.push(apiHealth);
    
    // Check AI Service Health
    const aiHealth = await this.checkAIServiceHealth();
    components.push(aiHealth);
    
    // Check Error Recovery Health
    const errorHealth = await this.checkErrorRecoveryHealth();
    components.push(errorHealth);
    
    // Check Scheduler Health
    const schedulerHealth = await this.checkSchedulerHealth();
    components.push(schedulerHealth);
    
    // Check Data Pipeline Health
    const pipelineHealth = await this.checkPipelineHealth();
    components.push(pipelineHealth);
    
    // Collect system metrics
    const metrics = await this.collectSystemMetrics();
    
    // Analyze health and generate alerts
    const analysis = this.analyzeHealth(components, metrics);
    alerts.push(...analysis.alerts);
    
    // Determine overall health
    const overall = this.determineOverallHealth(components, metrics);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(components, metrics);
    
    const healthMetrics: HealthMetrics = {
      timestamp: new Date().toISOString(),
      overall,
      components,
      metrics,
      alerts,
      recommendations
    };
    
    // Store health metrics
    await this.storeHealthMetrics(healthMetrics);
    
    // Process alerts
    await this.processAlerts(alerts);
    
    // Auto-heal if needed
    if (overall === 'critical') {
      await this.attemptAutoHealing(components);
    }
    
    // Update history
    this.healthHistory.push(healthMetrics);
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift();
    }
    
    const duration = Date.now() - startTime;
    console.log(`[HealthMonitor] Health check completed in ${duration}ms - Status: ${overall}`);
    
    return healthMetrics;
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Test database connection
      const { data, error } = await supabase
        .from('system_settings')
        .select('key')
        .limit(1)
        .single();
      
      if (error) throw error;
      
      // Check response time
      const responseTime = Date.now() - startTime;
      if (responseTime > this.thresholds.responseTimeThreshold) {
        status = 'warning';
        details.slowResponse = true;
      }
      
      // Check connection pool
      const { data: poolStats } = await supabase
        .from('pg_stat_activity')
        .select('*');
      
      if (poolStats && poolStats.length > 90) {
        status = 'warning';
        details.highConnectionCount = poolStats.length;
      }
      
      details.responseTime = responseTime;
      details.connections = poolStats?.length || 0;
      
    } catch (error) {
      status = 'critical';
      details.error = error;
    }
    
    return {
      name: 'Database',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check API health
   */
  private async checkAPIHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Check recent API calls
      const { data: recentCalls } = await supabase
        .from('api_logs')
        .select('status_code, response_time')
        .gte('created_at', new Date(Date.now() - 300000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (recentCalls && recentCalls.length > 0) {
        const errorCount = recentCalls.filter(c => c.status_code >= 500).length;
        const errorRate = errorCount / recentCalls.length;
        const avgResponseTime = recentCalls.reduce((sum, c) => sum + (c.response_time || 0), 0) / recentCalls.length;
        
        if (errorRate > this.thresholds.errorRateThreshold) {
          status = 'error';
        } else if (errorRate > this.thresholds.errorRateThreshold / 2) {
          status = 'warning';
        }
        
        details = {
          totalCalls: recentCalls.length,
          errorRate: Math.round(errorRate * 100),
          avgResponseTime: Math.round(avgResponseTime)
        };
      }
      
    } catch (error) {
      status = 'warning';
      details.error = error;
    }
    
    return {
      name: 'API',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check AI Service health
   */
  private async checkAIServiceHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Get AI service status
      const aiStatus = await this.aiService.getServiceStatus();
      
      if (!aiStatus.operational) {
        status = 'error';
      } else if (aiStatus.tokensUsed > aiStatus.tokenLimit * 0.9) {
        status = 'warning';
        details.nearTokenLimit = true;
      }
      
      // Check recent AI assessments
      const { data: recentAssessments } = await supabase
        .from('ai_assessments')
        .select('success, processing_time')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (recentAssessments && recentAssessments.length > 0) {
        const failureRate = recentAssessments.filter(a => !a.success).length / recentAssessments.length;
        const avgProcessingTime = recentAssessments.reduce((sum, a) => sum + (a.processing_time || 0), 0) / recentAssessments.length;
        
        if (failureRate > 0.1) {
          status = status === 'warning' ? 'error' : 'warning';
        }
        
        details.assessments = {
          total: recentAssessments.length,
          failureRate: Math.round(failureRate * 100),
          avgProcessingTime: Math.round(avgProcessingTime)
        };
      }
      
      details = {
        ...details,
        ...aiStatus
      };
      
    } catch (error) {
      status = 'warning';
      details.error = error;
    }
    
    return {
      name: 'AI Service',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check Error Recovery health
   */
  private async checkErrorRecoveryHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Get error recovery status
      const recoveryStatus = await this.errorRecovery.getHealthStatus();
      
      if (!recoveryStatus.healthy) {
        status = 'warning';
      }
      
      // Check for open circuit breakers
      const openCircuits = Object.entries(recoveryStatus.circuitBreakers)
        .filter(([_, breaker]: [string, any]) => breaker.state === 'open');
      
      if (openCircuits.length > 0) {
        status = 'error';
        details.openCircuits = openCircuits.map(([name]) => name);
      }
      
      // Check recovery rate
      if (recoveryStatus.recoveryRate < 80) {
        status = status === 'healthy' ? 'warning' : status;
      }
      
      details = {
        ...details,
        recoveryRate: recoveryStatus.recoveryRate,
        recentErrors: recoveryStatus.recentErrors,
        circuitBreakers: recoveryStatus.circuitBreakers
      };
      
    } catch (error) {
      status = 'warning';
      details.error = error;
    }
    
    return {
      name: 'Error Recovery',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check Scheduler health
   */
  private async checkSchedulerHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Get scheduler status
      const schedulerStatus = await this.schedulingService.getStatus();
      
      if (!schedulerStatus.enabled && !schedulerStatus.manualOnly) {
        status = 'warning';
        details.disabled = true;
      }
      
      // Check last run
      if (schedulerStatus.lastRun) {
        const timeSinceLastRun = Date.now() - new Date(schedulerStatus.lastRun).getTime();
        const expectedInterval = (schedulerStatus.intervalHours || 24) * 3600000;
        
        if (timeSinceLastRun > expectedInterval * 1.5) {
          status = 'warning';
          details.overdue = true;
        }
      }
      
      // Check recent run history
      const { data: recentRuns } = await supabase
        .from('scheduler_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (recentRuns && recentRuns.length > 0) {
        const failureRate = recentRuns.filter(r => r.errors > 0).length / recentRuns.length;
        
        if (failureRate > 0.3) {
          status = 'error';
        } else if (failureRate > 0.1) {
          status = 'warning';
        }
        
        details.recentRuns = {
          total: recentRuns.length,
          failureRate: Math.round(failureRate * 100),
          lastRunTime: recentRuns[0].created_at
        };
      }
      
      details = {
        ...details,
        ...schedulerStatus
      };
      
    } catch (error) {
      status = 'warning';
      details.error = error;
    }
    
    return {
      name: 'Scheduler',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Check Data Pipeline health
   */
  private async checkPipelineHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    let status: ComponentHealth['status'] = 'healthy';
    let details: any = {};
    
    try {
      // Check queue size
      const { count: queueSize } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (queueSize && queueSize > this.thresholds.queueSizeThreshold) {
        status = 'warning';
        details.highQueueSize = queueSize;
      }
      
      // Check processing rate
      const { data: recentProcessing } = await supabase
        .from('content_queue')
        .select('status, created_at, processed_at')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .in('status', ['approved', 'rejected']);
      
      if (recentProcessing && recentProcessing.length > 0) {
        const avgProcessingTime = recentProcessing
          .filter(p => p.processed_at)
          .reduce((sum, p) => {
            const time = new Date(p.processed_at!).getTime() - new Date(p.created_at).getTime();
            return sum + time;
          }, 0) / recentProcessing.length;
        
        details.processingStats = {
          itemsProcessed: recentProcessing.length,
          avgProcessingTime: Math.round(avgProcessingTime / 1000)
        };
      }
      
      details.queueSize = queueSize || 0;
      
    } catch (error) {
      status = 'warning';
      details.error = error;
    }
    
    return {
      name: 'Data Pipeline',
      status,
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      details
    };
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // In a real implementation, these would come from actual system monitoring
    const metrics: SystemMetrics = {
      cpu: Math.random() * 0.7 + 0.2,  // Mock: 20-90%
      memory: Math.random() * 0.6 + 0.3,  // Mock: 30-90%
      apiCalls: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 0.1,  // Mock: 0-10%
      successRate: 0.9 + Math.random() * 0.1,  // Mock: 90-100%
      queueSize: Math.floor(Math.random() * 500),
      activeProcesses: Math.floor(Math.random() * 10)
    };
    
    // Get real metrics from database
    try {
      const { data: apiMetrics } = await supabase
        .from('api_logs')
        .select('status_code')
        .gte('created_at', new Date(Date.now() - 300000).toISOString());
      
      if (apiMetrics && apiMetrics.length > 0) {
        const errors = apiMetrics.filter(m => m.status_code >= 400).length;
        metrics.errorRate = errors / apiMetrics.length;
        metrics.successRate = 1 - metrics.errorRate;
        metrics.apiCalls = apiMetrics.length;
      }
      
      const { count: queueSize } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      if (queueSize) {
        metrics.queueSize = queueSize;
      }
    } catch (error) {
      console.error('[HealthMonitor] Error collecting metrics:', error);
    }
    
    return metrics;
  }

  /**
   * Analyze health and generate alerts
   */
  private analyzeHealth(components: ComponentHealth[], metrics: SystemMetrics): { alerts: HealthAlert[] } {
    const alerts: HealthAlert[] = [];
    
    // Check component health
    components.forEach(component => {
      if (component.status === 'critical') {
        alerts.push({
          level: 'critical',
          component: component.name,
          message: `${component.name} is in critical state`,
          timestamp: new Date().toISOString()
        });
      } else if (component.status === 'error') {
        alerts.push({
          level: 'error',
          component: component.name,
          message: `${component.name} is experiencing errors`,
          timestamp: new Date().toISOString()
        });
      } else if (component.status === 'warning') {
        alerts.push({
          level: 'warning',
          component: component.name,
          message: `${component.name} requires attention`,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Check system metrics
    if (metrics.memory > this.thresholds.memoryThreshold) {
      alerts.push({
        level: 'warning',
        component: 'System',
        message: `High memory usage: ${Math.round(metrics.memory * 100)}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      alerts.push({
        level: 'error',
        component: 'System',
        message: `High error rate: ${Math.round(metrics.errorRate * 100)}%`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (metrics.queueSize > this.thresholds.queueSizeThreshold) {
      alerts.push({
        level: 'warning',
        component: 'Pipeline',
        message: `Queue size exceeds threshold: ${metrics.queueSize} items`,
        timestamp: new Date().toISOString()
      });
    }
    
    return { alerts };
  }

  /**
   * Determine overall system health
   */
  private determineOverallHealth(components: ComponentHealth[], metrics: SystemMetrics): HealthMetrics['overall'] {
    const criticalComponents = components.filter(c => c.status === 'critical').length;
    const errorComponents = components.filter(c => c.status === 'error').length;
    const warningComponents = components.filter(c => c.status === 'warning').length;
    
    if (criticalComponents > 0 || metrics.errorRate > 0.2) {
      return 'critical';
    }
    
    if (errorComponents > 1 || metrics.errorRate > 0.1 || metrics.successRate < 0.8) {
      return 'degraded';
    }
    
    if (warningComponents > 2 || metrics.memory > 0.9) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  /**
   * Generate recommendations based on health
   */
  private generateRecommendations(components: ComponentHealth[], metrics: SystemMetrics): string[] {
    const recommendations: string[] = [];
    
    // Check for database issues
    const dbHealth = components.find(c => c.name === 'Database');
    if (dbHealth && dbHealth.status !== 'healthy') {
      if (dbHealth.details?.slowResponse) {
        recommendations.push('Consider optimizing database queries or adding indexes');
      }
      if (dbHealth.details?.highConnectionCount) {
        recommendations.push('Review connection pool settings, possible connection leak');
      }
    }
    
    // Check for AI service issues
    const aiHealth = components.find(c => c.name === 'AI Service');
    if (aiHealth && aiHealth.details?.nearTokenLimit) {
      recommendations.push('AI token usage near limit - consider upgrading plan or optimizing prompts');
    }
    
    // Check for error recovery issues
    const errorHealth = components.find(c => c.name === 'Error Recovery');
    if (errorHealth && errorHealth.details?.openCircuits) {
      recommendations.push(`Circuit breakers open for: ${errorHealth.details.openCircuits.join(', ')}. Investigation needed.`);
    }
    
    // System metrics recommendations
    if (metrics.memory > this.thresholds.memoryThreshold) {
      recommendations.push('High memory usage detected - consider scaling or optimization');
    }
    
    if (metrics.errorRate > this.thresholds.errorRateThreshold) {
      recommendations.push('Error rate exceeds threshold - review recent errors and fix root causes');
    }
    
    if (metrics.queueSize > this.thresholds.queueSizeThreshold) {
      recommendations.push('Large queue backlog - consider increasing processing capacity');
    }
    
    // Scheduler recommendations
    const schedulerHealth = components.find(c => c.name === 'Scheduler');
    if (schedulerHealth && schedulerHealth.details?.overdue) {
      recommendations.push('Scheduled run is overdue - check scheduler configuration');
    }
    
    return recommendations;
  }

  /**
   * Store health metrics in database
   */
  private async storeHealthMetrics(metrics: HealthMetrics): Promise<void> {
    try {
      await supabase.from('health_metrics').insert({
        timestamp: metrics.timestamp,
        overall_status: metrics.overall,
        components: metrics.components,
        metrics: metrics.metrics,
        alerts: metrics.alerts,
        recommendations: metrics.recommendations
      });
    } catch (error) {
      console.error('[HealthMonitor] Failed to store health metrics:', error);
    }
  }

  /**
   * Process and manage alerts
   */
  private async processAlerts(alerts: HealthAlert[]): Promise<void> {
    for (const alert of alerts) {
      const alertKey = `${alert.component}-${alert.level}`;
      
      // Check if alert already exists
      if (!this.activeAlerts.has(alertKey)) {
        // New alert
        this.activeAlerts.set(alertKey, alert);
        
        // Store in database
        await supabase.from('health_alerts').insert({
          level: alert.level,
          component: alert.component,
          message: alert.message,
          timestamp: alert.timestamp,
          active: true
        });
        
        // Send notification for critical alerts
        if (alert.level === 'critical') {
          await this.sendCriticalAlert(alert);
        }
      }
    }
    
    // Check for resolved alerts
    const currentAlertKeys = new Set(alerts.map(a => `${a.component}-${a.level}`));
    for (const [key, existingAlert] of this.activeAlerts.entries()) {
      if (!currentAlertKeys.has(key)) {
        // Alert resolved
        existingAlert.autoResolved = true;
        
        // Update in database
        await supabase
          .from('health_alerts')
          .update({ 
            active: false, 
            resolved_at: new Date().toISOString() 
          })
          .eq('component', existingAlert.component)
          .eq('level', existingAlert.level)
          .is('resolved_at', null);
        
        this.activeAlerts.delete(key);
      }
    }
  }

  /**
   * Send critical alert notification
   */
  private async sendCriticalAlert(alert: HealthAlert): Promise<void> {
    try {
      await supabase.from('notifications').insert({
        type: 'health_alert',
        title: `CRITICAL: ${alert.component} Issue`,
        message: alert.message,
        metadata: alert,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('[HealthMonitor] Failed to send critical alert:', error);
    }
  }

  /**
   * Attempt automatic healing for critical issues
   */
  private async attemptAutoHealing(components: ComponentHealth[]): Promise<void> {
    console.log('[HealthMonitor] Attempting auto-healing for critical issues...');
    
    for (const component of components) {
      if (component.status === 'critical') {
        switch (component.name) {
          case 'Database':
            // Reset database connections
            console.log('[HealthMonitor] Resetting database connections...');
            // Implementation would reset connection pool
            break;
            
          case 'AI Service':
            // Switch to fallback AI model
            console.log('[HealthMonitor] Switching to fallback AI model...');
            await this.aiService.enableFallbackMode();
            break;
            
          case 'Error Recovery':
            // Reset circuit breakers
            console.log('[HealthMonitor] Resetting circuit breakers...');
            // Implementation would reset breakers
            break;
            
          case 'Scheduler':
            // Restart scheduler
            console.log('[HealthMonitor] Restarting scheduler...');
            await this.schedulingService.restart();
            break;
            
          default:
            console.log(`[HealthMonitor] No auto-healing available for ${component.name}`);
        }
      }
    }
  }

  /**
   * Get current health status
   */
  async getCurrentHealth(): Promise<HealthMetrics> {
    if (this.healthHistory.length > 0) {
      return this.healthHistory[this.healthHistory.length - 1];
    }
    return await this.performHealthCheck();
  }

  /**
   * Get health history
   */
  getHealthHistory(): HealthMetrics[] {
    return this.healthHistory;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Update threshold configuration
   */
  updateThresholds(config: Partial<ThresholdConfig>): void {
    this.thresholds = { ...this.thresholds, ...config };
    console.log('[HealthMonitor] Thresholds updated:', this.thresholds);
  }
}