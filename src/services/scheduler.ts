/**
 * Scheduler service for automated content fetching
 */
import * as cron from 'node-cron';
// Using UNIFIED orchestrator - the ONLY orchestrator in the system
import { UnifiedOrchestrator } from '../core/unified-orchestrator';
import { notificationService } from '../lib/notification-service';
import { logger } from './logger';

export class Scheduler {
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private orchestrator = new UnifiedOrchestrator(); // Single source of truth!

  /**
   * Initialize default scheduled tasks
   */
  initialize() {
    // Every 6 hours - fetch content
    this.scheduleTask('content-fetch', '0 */6 * * *', async () => {
      logger.info('Starting scheduled content fetch...');
      try {
        const result = await this.orchestrator.run();
        
        logger.info('Content fetch completed', result);
        
        // Send notification
        await notificationService.notifyNewContent({
          total: result.fetched,
          unique: result.stored,
          duplicates: result.fetched - result.stored,
          errors: result.errors.length
        });
      } catch (error) {
        logger.error('Scheduled fetch failed', error);
        await notificationService.notifyError(error, 'Scheduled Content Fetch');
      }
    });

    // Daily at 9 AM - send summary report
    this.scheduleTask('daily-report', '0 9 * * *', async () => {
      logger.info('Generating daily report...');
      try {
        const stats = await this.getDailyStats();
        await this.sendDailyReport(stats);
      } catch (error) {
        logger.error('Daily report failed', error);
      }
    });

    // Every hour - health check
    this.scheduleTask('health-check', '0 * * * *', async () => {
      try {
        const health = await this.performHealthCheck();
        if (!health.healthy) {
          await notificationService.sendSlack(
            `Health check failed: ${health.issues.join(', ')}`,
            'warning'
          );
        }
      } catch (error) {
        logger.error('Health check failed', error);
      }
    });

    logger.info('Scheduler initialized with 3 tasks');
  }

  /**
   * Schedule a new task
   */
  scheduleTask(name: string, schedule: string, handler: () => Promise<void>) {
    if (this.tasks.has(name)) {
      this.tasks.get(name)?.stop();
    }

    const task = cron.schedule(schedule, handler, {
      timezone: process.env.TZ || 'UTC'
    });

    this.tasks.set(name, task);
    logger.info(`Task scheduled: ${name} (${schedule})`);
  }

  /**
   * Stop a scheduled task
   */
  stopTask(name: string) {
    const task = this.tasks.get(name);
    if (task) {
      task.stop();
      this.tasks.delete(name);
      logger.info(`Task stopped: ${name}`);
    }
  }

  /**
   * Stop all tasks
   */
  stopAll() {
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Task stopped: ${name}`);
    }
    this.tasks.clear();
  }

  /**
   * Get list of active tasks
   */
  getActiveTasks() {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get daily statistics
   */
  private async getDailyStats() {
    const { supabase } = await import('../lib/supabase');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: content } = await supabase
      .from('content_curated')
      .select('*')
      .gte('created_at', yesterday.toISOString());

    const { data: queue } = await supabase
      .from('content_queue')
      .select('*')
      .gte('created_at', yesterday.toISOString());

    return {
      newContent: content?.length || 0,
      queuedItems: queue?.length || 0,
      sources: [...new Set(content?.map(c => c.source) || [])],
      avgScore: content?.reduce((acc, c) => acc + (c.score || 0), 0) / (content?.length || 1)
    };
  }

  /**
   * Send daily report
   */
  private async sendDailyReport(stats: any) {
    const subject = `📊 Daily Content Report - ${new Date().toLocaleDateString()}`;
    const content = `
Daily Content Summary
=====================

New Content: ${stats.newContent} items
Queued Items: ${stats.queuedItems} items
Active Sources: ${stats.sources.join(', ')}
Average Score: ${stats.avgScore.toFixed(2)}

View full analytics: ${process.env.VERCEL_URL || 'http://localhost:3000'}/analytics
    `.trim();

    await notificationService.sendNotification({
      type: 'email',
      subject,
      content,
      metadata: stats
    });
  }

  /**
   * Perform health check
   */
  private async performHealthCheck() {
    const issues = [];
    
    try {
      // Check database connection
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.from('content_curated').select('count').limit(1);
      if (error) {issues.push('Database connection failed');}
    } catch (error) {
      issues.push('Database unreachable');
    }

    // Check API endpoints
    try {
      const response = await fetch('http://localhost:3000/api/health');
      if (!response.ok) {issues.push('API unhealthy');}
    } catch (error) {
      issues.push('API unreachable');
    }

    return {
      healthy: issues.length === 0,
      issues,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run task immediately
   */
  async runTaskNow(name: string) {
    switch (name) {
      case 'content-fetch':
        return await this.orchestrator.run();
      case 'daily-report':
        const stats = await this.getDailyStats();
        await this.sendDailyReport(stats);
        return stats;
      case 'health-check':
        return await this.performHealthCheck();
      default:
        throw new Error(`Unknown task: ${name}`);
    }
  }
}

// Export singleton
export const scheduler = new Scheduler();