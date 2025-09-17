/**
 * Comprehensive Monitoring Service
 * Tracks system health, performance, errors, and provides alerting
 */

import type { Database } from '../types/supabase';
import { logger } from './logger';
import { supabase } from '../lib/supabase';
import { performance } from 'perf_hooks';

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  checks: {
    database: boolean;
    api: boolean;
    aiService: boolean;
    cache: boolean;
  };
  timestamp: Date;
}

export interface PerformanceMetrics {
  apiLatency: {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  };
  fetchDuration: {
    avg: number;
    min: number;
    max: number;
  };
  aiProcessing: {
    avgExtraction: number;
    avgScoring: number;
    totalCalls: number;
    failedCalls: number;
  };
  cacheMetrics: {
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
  };
}

export interface ErrorMetrics {
  total: number;
  byType: Record<string, number>;
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recent: Array<{
    timestamp: Date;
    error: string;
    context: any;
    severity: string;
  }>;
}

export interface DataMetrics {
  totalFetched: number;
  totalValidated: number;
  totalUnique: number;
  totalInserted: number;
  bySource: Record<string, {
    fetched: number;
    success: number;
    failed: number;
  }>;
  byCategory: {
    projects: number;
    resources: number;
    funding: number;
  };
  accelerateStats: {
    perfect: number;
    good: number;
    maybe: number;
    rejected: number;
  };
}

class MonitoringService {
  private startTime: Date;
  private apiLatencies: number[] = [];
  private fetchDurations: number[] = [];
  private aiExtractionTimes: number[] = [];
  private aiScoringTimes: number[] = [];
  private errors: Array<{ timestamp: Date; error: string; context: any; severity: string }> = [];
  private sourceMetrics: Record<string, { fetched: number; success: number; failed: number }> = {};
  private cacheHits = 0;
  private cacheMisses = 0;
  private aiCalls = 0;
  private aiFailures = 0;
  
  // Data counters
  private dataMetrics: DataMetrics = {
    totalFetched: 0,
    totalValidated: 0,
    totalUnique: 0,
    totalInserted: 0,
    bySource: {},
    byCategory: {
      projects: 0,
      resources: 0,
      funding: 0
    },
    accelerateStats: {
      perfect: 0,
      good: 0,
      maybe: 0,
      rejected: 0
    }
  };
  
  constructor() {
    this.startTime = new Date();
    logger.info('Monitoring service initialized');
  }
  
  /**
   * Track API request latency
   */
  trackApiLatency(duration: number): void {
    this.apiLatencies.push(duration);
    
    // Keep only last 1000 samples
    if (this.apiLatencies.length > 1000) {
      this.apiLatencies.shift();
    }
  }
  
  /**
   * Track fetch operation duration
   */
  trackFetchDuration(duration: number): void {
    this.fetchDurations.push(duration);
    
    if (this.fetchDurations.length > 100) {
      this.fetchDurations.shift();
    }
  }
  
  /**
   * Track AI extraction time
   */
  trackAiExtraction(duration: number, success: boolean): void {
    this.aiExtractionTimes.push(duration);
    this.aiCalls++;
    
    if (!success) {
      this.aiFailures++;
    }
    
    if (this.aiExtractionTimes.length > 100) {
      this.aiExtractionTimes.shift();
    }
  }
  
  /**
   * Track AI scoring time
   */
  trackAiScoring(duration: number, success: boolean): void {
    this.aiScoringTimes.push(duration);
    this.aiCalls++;
    
    if (!success) {
      this.aiFailures++;
    }
    
    if (this.aiScoringTimes.length > 100) {
      this.aiScoringTimes.shift();
    }
  }
  
  /**
   * Track cache performance
   */
  trackCacheHit(): void {
    this.cacheHits++;
  }
  
  trackCacheMiss(): void {
    this.cacheMisses++;
  }
  
  /**
   * Track source performance
   */
  trackSource(source: string, fetched: number, success: boolean): void {
    if (!this.sourceMetrics[source]) {
      this.sourceMetrics[source] = { fetched: 0, success: 0, failed: 0 };
    }
    
    this.sourceMetrics[source].fetched += fetched;
    
    if (success) {
      this.sourceMetrics[source].success++;
    } else {
      this.sourceMetrics[source].failed++;
    }
  }
  
  /**
   * Track data pipeline metrics
   */
  trackPipeline(metrics: {
    fetched: number;
    validated: number;
    unique: number;
    inserted: number;
    byCategory?: { projects: number; resources: number; funding: number };
    accelerateStats?: { perfect: number; good: number; maybe: number; rejected: number };
  }): void {
    this.dataMetrics.totalFetched += metrics.fetched;
    this.dataMetrics.totalValidated += metrics.validated;
    this.dataMetrics.totalUnique += metrics.unique;
    this.dataMetrics.totalInserted += metrics.inserted;
    
    if (metrics.byCategory) {
      this.dataMetrics.byCategory.projects += metrics.byCategory.projects;
      this.dataMetrics.byCategory.resources += metrics.byCategory.resources;
      this.dataMetrics.byCategory.funding += metrics.byCategory.funding;
    }
    
    if (metrics.accelerateStats) {
      this.dataMetrics.accelerateStats.perfect += metrics.accelerateStats.perfect;
      this.dataMetrics.accelerateStats.good += metrics.accelerateStats.good;
      this.dataMetrics.accelerateStats.maybe += metrics.accelerateStats.maybe;
      this.dataMetrics.accelerateStats.rejected += metrics.accelerateStats.rejected;
    }
  }
  
  /**
   * Track errors
   */
  trackError(error: string, context: any, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    this.errors.push({
      timestamp: new Date(),
      error,
      context,
      severity
    });
    
    // Keep only last 100 errors
    if (this.errors.length > 100) {
      this.errors.shift();
    }
    
    // Alert on critical errors
    if (severity === 'critical') {
      this.sendAlert('CRITICAL ERROR', { error, context });
    }
  }
  
  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime.getTime();
    
    // Check database connection
    let dbHealthy = false;
    try {
      const { error } = await supabase.from('queue_projects').select('id').limit(1);
      dbHealthy = !error;
    } catch {
      dbHealthy = false;
    }
    
    // Check if we have recent successful fetches
    const apiHealthy = this.fetchDurations.length > 0 && 
                      this.fetchDurations[this.fetchDurations.length - 1] < 120000; // Less than 2 minutes
    
    // Check AI service health
    const aiHealthy = this.aiFailures < this.aiCalls * 0.1; // Less than 10% failure rate
    
    // Check cache health
    const cacheHealthy = this.cacheHits + this.cacheMisses === 0 || 
                        (this.cacheHits / (this.cacheHits + this.cacheMisses)) > 0.3; // At least 30% hit rate
    
    // Determine overall status
    const healthyChecks = [dbHealthy, apiHealthy, aiHealthy, cacheHealthy].filter(Boolean).length;
    let status: 'healthy' | 'degraded' | 'critical';
    
    if (healthyChecks === 4) {
      status = 'healthy';
    } else if (healthyChecks >= 2) {
      status = 'degraded';
    } else {
      status = 'critical';
    }
    
    return {
      status,
      uptime,
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to seconds
      },
      checks: {
        database: dbHealthy,
        api: apiHealthy,
        aiService: aiHealthy,
        cache: cacheHealthy
      },
      timestamp: new Date()
    };
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const calculatePercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) {return 0;}
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[index] || 0;
    };
    
    const avg = (arr: number[]): number => {
      if (arr.length === 0) {return 0;}
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    };
    
    return {
      apiLatency: {
        p50: calculatePercentile(this.apiLatencies, 50),
        p95: calculatePercentile(this.apiLatencies, 95),
        p99: calculatePercentile(this.apiLatencies, 99),
        avg: avg(this.apiLatencies)
      },
      fetchDuration: {
        avg: avg(this.fetchDurations),
        min: Math.min(...this.fetchDurations) || 0,
        max: Math.max(...this.fetchDurations) || 0
      },
      aiProcessing: {
        avgExtraction: avg(this.aiExtractionTimes),
        avgScoring: avg(this.aiScoringTimes),
        totalCalls: this.aiCalls,
        failedCalls: this.aiFailures
      },
      cacheMetrics: {
        hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
        missRate: this.cacheMisses / (this.cacheHits + this.cacheMisses) || 0,
        totalHits: this.cacheHits,
        totalMisses: this.cacheMisses
      }
    };
  }
  
  /**
   * Get error metrics
   */
  getErrorMetrics(): ErrorMetrics {
    const byType: Record<string, number> = {};
    const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
    
    this.errors.forEach(error => {
      // Count by type (simplified error classification)
      const errorType = error.error.includes('fetch') ? 'fetch' :
                       error.error.includes('database') ? 'database' :
                       error.error.includes('AI') ? 'ai' :
                       error.error.includes('validation') ? 'validation' : 'other';
      
      byType[errorType] = (byType[errorType] || 0) + 1;
      
      // Count by severity
      bySeverity[error.severity as keyof typeof bySeverity]++;
    });
    
    return {
      total: this.errors.length,
      byType,
      bySeverity,
      recent: this.errors.slice(-10) // Last 10 errors
    };
  }
  
  /**
   * Get data metrics
   */
  getDataMetrics(): DataMetrics {
    return {
      ...this.dataMetrics,
      bySource: { ...this.sourceMetrics }
    };
  }
  
  /**
   * Get comprehensive dashboard data
   */
  async getDashboard(): Promise<{
    health: SystemHealth;
    performance: PerformanceMetrics;
    errors: ErrorMetrics;
    data: DataMetrics;
  }> {
    const health = await this.getSystemHealth();
    const performance = this.getPerformanceMetrics();
    const errors = this.getErrorMetrics();
    const data = this.getDataMetrics();
    
    return {
      health,
      performance,
      errors,
      data
    };
  }
  
  /**
   * Send alert (placeholder - implement actual alerting)
   */
  private sendAlert(type: string, data: any): void {
    logger.error(`ALERT: ${type}`, data);
    
    // For internal tool, console logging is sufficient
    // Could add email/Slack integration if needed
  }
  
  /**
   * Reset metrics (useful for testing)
   */
  reset(): void {
    this.apiLatencies = [];
    this.fetchDurations = [];
    this.aiExtractionTimes = [];
    this.aiScoringTimes = [];
    this.errors = [];
    this.sourceMetrics = {};
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.aiCalls = 0;
    this.aiFailures = 0;
    this.dataMetrics = {
      totalFetched: 0,
      totalValidated: 0,
      totalUnique: 0,
      totalInserted: 0,
      bySource: {},
      byCategory: {
        projects: 0,
        resources: 0,
        funding: 0
      },
      accelerateStats: {
        perfect: 0,
        good: 0,
        maybe: 0,
        rejected: 0
      }
    };
    
    logger.info('Monitoring metrics reset');
  }
}

// Export singleton
export const monitoringService = new MonitoringService();