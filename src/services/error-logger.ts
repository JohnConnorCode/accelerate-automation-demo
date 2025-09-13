/**
 * Error Logging Service
 * Simple error tracking for internal tool
 */

import { supabase } from '../lib/supabase-client';

export interface ErrorLog {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  service: string;
  error?: any;
  metadata?: any;
}

class ErrorLogger {
  private logs: ErrorLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Flush logs every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);
  }

  /**
   * Log an error
   */
  async log(level: ErrorLog['level'], message: string, service: string, error?: any, metadata?: any) {
    const log: ErrorLog = {
      level,
      message,
      service,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : undefined,
      metadata
    };

    // Add to local buffer
    this.logs.push(log);
    
    // Also console log for immediate visibility
    const icon = level === 'error' || level === 'critical' ? '❌' : 
                 level === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${icon} [${service}] ${message}`, error || '');

    // Flush if critical or buffer is large
    if (level === 'critical' || this.logs.length > 50) {
      await this.flush();
    }
  }

  /**
   * Flush logs to database
   */
  async flush() {
    if (this.logs.length === 0) {return;}

    const logsToSend = [...this.logs];
    this.logs = [];

    try {
      // Try to create table if it doesn't exist
      await this.ensureTable();
      
      // Insert logs
      const { error } = await supabase
        .from('error_logs')
        .insert(logsToSend.map(log => ({
          error_level: log.level,
          message: log.message,
          service: log.service,
          error_code: log.error?.code,
          stack_trace: log.error?.stack,
          metadata: { ...log.metadata, error: log.error },
          created_at: new Date().toISOString()
        })));

      if (error) {
        console.error('Failed to flush logs:', error);
        // Re-add logs to buffer on failure
        this.logs = [...logsToSend, ...this.logs];
      }
    } catch (err) {
      console.error('Error logger flush failed:', err);
    }
  }

  /**
   * Ensure error_logs table exists
   */
  private async ensureTable() {
    // Check if table exists by trying to query it
    const { error } = await supabase
      .from('error_logs')
      .select('id')
      .limit(1);
    
    if (error && error.message.includes('does not exist')) {
      // Table doesn't exist, create it via raw SQL
      console.log('Creating error_logs table...');
      // Note: This would need admin access, so we'll just log for now
      console.log('⚠️ error_logs table missing - errors will be console-only');
    }
  }

  /**
   * Track a metric
   */
  async metric(name: string, value: number, service: string, tags?: any) {
    try {
      await supabase
        .from('system_metrics')
        .insert({
          metric_name: name,
          metric_value: value,
          service,
          tags: tags || {},
          created_at: new Date().toISOString()
        });
    } catch (err) {
      // Silently fail metrics (not critical)
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Convenience methods
export const logError = (message: string, service: string, error?: any, metadata?: any) => 
  errorLogger.log('error', message, service, error, metadata);

export const logWarning = (message: string, service: string, metadata?: any) => 
  errorLogger.log('warning', message, service, undefined, metadata);

export const logInfo = (message: string, service: string, metadata?: any) => 
  errorLogger.log('info', message, service, undefined, metadata);

export const logCritical = (message: string, service: string, error?: any, metadata?: any) => 
  errorLogger.log('critical', message, service, error, metadata);

export const trackMetric = (name: string, value: number, service: string, tags?: any) =>
  errorLogger.metric(name, value, service, tags);

// Graceful shutdown
process.on('SIGINT', async () => {
  await errorLogger.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await errorLogger.shutdown();
  process.exit(0);
});