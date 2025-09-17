/**
 * Basic Metrics Tracking Service
 * Tracks key performance indicators for the content pipeline
 */

import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase';

interface PipelineMetrics {
  fetchCount: number;
  successCount: number;
  failureCount: number;
  approvalCount: number;
  rejectionCount: number;
  avgProcessingTime: number;
  lastFetchTime: Date | null;
  errorRate: number;
  successRate: number;
}

class MetricsService {
  private metrics: PipelineMetrics = {
    fetchCount: 0,
    successCount: 0,
    failureCount: 0,
    approvalCount: 0,
    rejectionCount: 0,
    avgProcessingTime: 0,
    lastFetchTime: null,
    errorRate: 0,
    successRate: 0
  };
  
  private processingTimes: number[] = [];
  private readonly MAX_TIMING_SAMPLES = 100;
  
  // Track a fetch operation
  trackFetch(itemCount: number, duration: number) {
    this.metrics.fetchCount++;
    this.metrics.lastFetchTime = new Date();
    
    if (itemCount > 0) {
      this.metrics.successCount++;
    } else {
      this.metrics.failureCount++;
    }
    
    // Track processing time
    this.processingTimes.push(duration);
    if (this.processingTimes.length > this.MAX_TIMING_SAMPLES) {
      this.processingTimes.shift();
    }
    
    this.updateCalculatedMetrics();
    this.persistMetrics();
  }
  
  // Track approval/rejection
  trackApproval(approved: boolean) {
    if (approved) {
      this.metrics.approvalCount++;
    } else {
      this.metrics.rejectionCount++;
    }
    this.persistMetrics();
  }
  
  // Update calculated metrics
  private updateCalculatedMetrics() {
    const total = this.metrics.successCount + this.metrics.failureCount;
    if (total > 0) {
      this.metrics.errorRate = (this.metrics.failureCount / total) * 100;
      this.metrics.successRate = (this.metrics.successCount / total) * 100;
    }
    
    if (this.processingTimes.length > 0) {
      const sum = this.processingTimes.reduce((a, b) => a + b, 0);
      this.metrics.avgProcessingTime = sum / this.processingTimes.length;
    }
  }
  
  // Get current metrics
  async getMetrics(): Promise<PipelineMetrics & { queueDepth: any }> {
    // Get queue depths
    const [projects, news, investors] = await Promise.all([
      supabase.from('queue_projects').select('id', { count: 'exact', head: true }),
      supabase.from('queue_news').select('id', { count: 'exact', head: true }),
      supabase.from('queue_investors').select('id', { count: 'exact', head: true })
    ]);
    
    const queueDepth = {
      projects: projects.count || 0,
      news: news.count || 0,
      investors: investors.count || 0,
      total: (projects.count || 0) + (news.count || 0) + (investors.count || 0)
    };
    
    return {
      ...this.metrics,
      queueDepth
    };
  }
  
  // Get performance summary
  async getPerformanceSummary() {
    const metrics = await this.getMetrics();
    
    return {
      health: metrics.successRate > 80 ? 'healthy' : 
              metrics.successRate > 50 ? 'degraded' : 'critical',
      metrics: {
        successRate: `${metrics.successRate.toFixed(1)}%`,
        errorRate: `${metrics.errorRate.toFixed(1)}%`,
        avgProcessingTime: `${metrics.avgProcessingTime.toFixed(0)}ms`,
        queueDepth: metrics.queueDepth.total,
        approvalRate: metrics.approvalCount > 0 
          ? `${((metrics.approvalCount / (metrics.approvalCount + metrics.rejectionCount)) * 100).toFixed(1)}%`
          : '0%'
      },
      lastFetch: metrics.lastFetchTime,
      totalProcessed: metrics.fetchCount
    };
  }
  
  // Persist metrics to localStorage (in production, use database)
  private persistMetrics() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pipeline_metrics', JSON.stringify(this.metrics));
    }
  }
  
  // Load persisted metrics
  loadMetrics() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pipeline_metrics');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.metrics = {
          ...this.metrics,
          ...parsed,
          lastFetchTime: parsed.lastFetchTime ? new Date(parsed.lastFetchTime) : null
        };
      }
    }
  }
  
  // Reset metrics
  reset() {
    this.metrics = {
      fetchCount: 0,
      successCount: 0,
      failureCount: 0,
      approvalCount: 0,
      rejectionCount: 0,
      avgProcessingTime: 0,
      lastFetchTime: null,
      errorRate: 0,
      successRate: 0
    };
    this.processingTimes = [];
    this.persistMetrics();
  }
}

export const metricsService = new MetricsService();

// Load persisted metrics on initialization
metricsService.loadMetrics();