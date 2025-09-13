import { supabase } from '../lib/supabase-client';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Comprehensive Error Logging Service
 * Captures, analyzes, and stores all system errors with context
 */

interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  operation?: string;
  component?: string;
  metadata?: Record<string, any>;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
}

interface ErrorEntry {
  id: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack?: string;
  code?: string;
  context: ErrorContext;
  fingerprint: string;
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  resolvedAt?: Date;
  tags: string[];
}

interface ErrorPattern {
  pattern: RegExp;
  category: string;
  severity: ErrorEntry['level'];
  autoResolve?: boolean;
  notificationThreshold?: number;
  customHandler?: (error: Error) => void;
}

export class ErrorLoggingService extends EventEmitter {
  private errors: Map<string, ErrorEntry> = new Map();
  private errorPatterns: ErrorPattern[] = [];
  private logBuffer: ErrorEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private sessionId: string;
  private requestCounter: number = 0;
  
  // Configuration
  private readonly config = {
    maxBufferSize: 100,
    flushIntervalMs: 5000,
    maxErrorsInMemory: 1000,
    logFilePath: path.join(process.cwd(), 'logs'),
    enableFileLogging: true,
    enableDatabaseLogging: true,
    enableConsoleLogging: true,
    contextEnrichment: true,
    errorGrouping: true,
    autoAnalysis: true
  };
  
  // Common error patterns
  private readonly commonPatterns: ErrorPattern[] = [
    {
      pattern: /rate limit/i,
      category: 'rate-limiting',
      severity: 'warning',
      autoResolve: true,
      notificationThreshold: 10
    },
    {
      pattern: /network|timeout|ECONNREFUSED/i,
      category: 'network',
      severity: 'error',
      autoResolve: false,
      notificationThreshold: 5
    },
    {
      pattern: /database|connection|pool/i,
      category: 'database',
      severity: 'error',
      autoResolve: false,
      notificationThreshold: 3
    },
    {
      pattern: /memory|heap|stack/i,
      category: 'memory',
      severity: 'critical',
      autoResolve: false,
      notificationThreshold: 1
    },
    {
      pattern: /authentication|unauthorized|forbidden/i,
      category: 'auth',
      severity: 'warning',
      autoResolve: false,
      notificationThreshold: 20
    },
    {
      pattern: /validation|invalid|missing required/i,
      category: 'validation',
      severity: 'info',
      autoResolve: true,
      notificationThreshold: 50
    },
    {
      pattern: /api.*failed|external.*error/i,
      category: 'external-api',
      severity: 'error',
      autoResolve: false,
      notificationThreshold: 5
    }
  ];
  
  constructor() {
    super();
    this.sessionId = this.generateSessionId();
    this.errorPatterns = [...this.commonPatterns];
    this.initializeLogging();
    this.setupErrorHandlers();
  }
  
  /**
   * Initialize logging infrastructure
   */
  private async initializeLogging(): Promise<void> {
    // Create log directory if needed
    if (this.config.enableFileLogging) {
      try {
        await fs.mkdir(this.config.logFilePath, { recursive: true });
      } catch (error) {

      }
    }
    
    // Start flush interval
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, this.config.flushIntervalMs);

  }
  
  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Catch unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logError(
        new Error(`Unhandled Rejection: ${reason}`),
        'critical',
        {
          component: 'global',
          operation: 'unhandledRejection',
          metadata: { promise: String(promise) }
        }
      );
    });
    
    // Catch uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logError(error, 'critical', {
        component: 'global',
        operation: 'uncaughtException'
      });
      
      // Give time to flush logs before exit
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
    
    // Catch warnings
    process.on('warning', (warning) => {
      this.logError(warning, 'warning', {
        component: 'global',
        operation: 'warning'
      });
    });
  }
  
  /**
   * Log an error with full context
   */
  async logError(
    error: Error | string,
    level: ErrorEntry['level'] = 'error',
    context?: Partial<ErrorContext>
  ): Promise<string> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorId = this.generateErrorId();
    
    // Create error context
    const fullContext: ErrorContext = {
      ...context,
      timestamp: new Date(),
      sessionId: this.sessionId,
      requestId: this.generateRequestId()
    };
    
    // Enrich context if enabled
    if (this.config.contextEnrichment) {
      await this.enrichContext(fullContext);
    }
    
    // Generate fingerprint for grouping
    const fingerprint = this.generateFingerprint(errorObj, fullContext);
    
    // Check if error already exists (for grouping)
    let errorEntry: ErrorEntry;
    if (this.config.errorGrouping && this.errors.has(fingerprint)) {
      errorEntry = this.errors.get(fingerprint)!;
      errorEntry.count++;
      errorEntry.lastSeen = new Date();
    } else {
      // Analyze error
      const analysis = this.analyzeError(errorObj);
      
      errorEntry = {
        id: errorId,
        level: analysis.severity || level,
        message: errorObj.message,
        stack: errorObj.stack,
        code: (errorObj as any).code,
        context: fullContext,
        fingerprint,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        resolved: false,
        tags: analysis.tags
      };
      
      this.errors.set(fingerprint, errorEntry);
    }
    
    // Add to buffer
    this.logBuffer.push(errorEntry);
    
    // Log to various outputs
    await this.writeToOutputs(errorEntry);
    
    // Check if immediate flush needed
    if (
      level === 'critical' ||
      this.logBuffer.length >= this.config.maxBufferSize
    ) {
      await this.flushLogs();
    }
    
    // Emit event
    this.emit('error-logged', errorEntry);
    
    // Check notification threshold
    await this.checkNotificationThreshold(errorEntry);
    
    // Limit in-memory storage
    this.pruneOldErrors();
    
    return errorId;
  }
  
  /**
   * Analyze error for patterns and categorization
   */
  private analyzeError(error: Error): {
    category?: string;
    severity?: ErrorEntry['level'];
    tags: string[];
    pattern?: ErrorPattern;
  } {
    const tags: string[] = [];
    let matchedPattern: ErrorPattern | undefined;
    
    // Check against patterns
    for (const pattern of this.errorPatterns) {
      if (pattern.pattern.test(error.message)) {
        matchedPattern = pattern;
        tags.push(pattern.category);
        break;
      }
    }
    
    // Additional analysis
    if (error.stack) {
      // Check for specific modules
      if (error.stack.includes('node_modules')) {
        tags.push('third-party');
      }
      if (error.stack.includes('async')) {
        tags.push('async');
      }
      if (error.stack.includes('Promise')) {
        tags.push('promise');
      }
    }
    
    // Check error properties
    if ((error as any).code) {
      tags.push(`code:${(error as any).code}`);
    }
    
    return {
      category: matchedPattern?.category,
      severity: matchedPattern?.severity,
      tags,
      pattern: matchedPattern
    };
  }
  
  /**
   * Enrich error context with additional information
   */
  private async enrichContext(context: ErrorContext): Promise<void> {
    try {
      // Add system information
      context.metadata = {
        ...context.metadata,
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          rss: process.memoryUsage().rss,
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal
        },
        uptime: process.uptime()
      };
      
      // Add environment info
      context.metadata.environment = process.env.NODE_ENV || 'development';
      
    } catch (error) {
      // Don't fail if enrichment fails

    }
  }
  
  /**
   * Generate error fingerprint for grouping
   */
  private generateFingerprint(error: Error, context: ErrorContext): string {
    const parts = [
      error.name,
      error.message.substring(0, 100), // First 100 chars
      context.component,
      context.operation
    ];
    
    // Add stack trace signature if available
    if (error.stack) {
      const stackLines = error.stack.split('\n').slice(1, 3); // First 2 stack frames
      parts.push(...stackLines.map(line => line.trim().substring(0, 50)));
    }
    
    return parts.filter(Boolean).join('|');
  }
  
  /**
   * Write error to various outputs
   */
  private async writeToOutputs(error: ErrorEntry): Promise<void> {
    const promises: Promise<void>[] = [];
    
    // Console logging
    if (this.config.enableConsoleLogging) {
      promises.push(this.logToConsole(error));
    }
    
    // File logging
    if (this.config.enableFileLogging) {
      promises.push(this.logToFile(error));
    }
    
    // Database logging (don't wait for this)
    if (this.config.enableDatabaseLogging) {
      this.logToDatabase(error).catch(err => {

      });
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Log to console with formatting
   */
  private async logToConsole(error: ErrorEntry): Promise<void> {
    const timestamp = error.context.timestamp.toISOString();
    const level = error.level.toUpperCase();
    const component = error.context.component || 'unknown';
    
    const logMessage = `[${timestamp}] [${level}] [${component}] ${error.message}`;
    
    switch (error.level) {
      case 'debug':

        break;
      case 'info':

        break;
      case 'warning':

        break;
      case 'error':

        if (error.stack) {console.error(error.stack);}
        break;
      case 'critical':

        if (error.stack) {console.error(error.stack);}
        break;
    }
  }
  
  /**
   * Log to file
   */
  private async logToFile(error: ErrorEntry): Promise<void> {
    try {
      const date = new Date();
      const fileName = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}.log`;
      const filePath = path.join(this.config.logFilePath, fileName);
      
      const logEntry = JSON.stringify({
        ...error,
        timestamp: error.context.timestamp.toISOString()
      }) + '\n';
      
      await fs.appendFile(filePath, logEntry, 'utf8');
    } catch (err) {

    }
  }
  
  /**
   * Log to database
   */
  private async logToDatabase(error: ErrorEntry): Promise<void> {
    try {
      await supabase.from('error_logs').insert({
        id: error.id,
        level: error.level,
        message: error.message,
        stack: error.stack,
        code: error.code,
        context: error.context,
        fingerprint: error.fingerprint,
        count: error.count,
        first_seen: error.firstSeen.toISOString(),
        last_seen: error.lastSeen.toISOString(),
        resolved: error.resolved,
        resolved_at: error.resolvedAt?.toISOString(),
        tags: error.tags,
        session_id: this.sessionId,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      // Don't throw, just log

    }
  }
  
  /**
   * Flush buffered logs
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {return;}
    
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];
    
    // Batch insert to database
    if (this.config.enableDatabaseLogging && logsToFlush.length > 0) {
      try {
        const records = logsToFlush.map(log => ({
          id: log.id,
          level: log.level,
          message: log.message,
          fingerprint: log.fingerprint,
          count: log.count,
          context: log.context,
          tags: log.tags,
          session_id: this.sessionId,
          created_at: log.context.timestamp.toISOString()
        }));
        
        await supabase.from('error_logs').insert(records);
      } catch (error) {

      }
    }
    
    this.emit('logs-flushed', logsToFlush.length);
  }
  
  /**
   * Check if notification threshold reached
   */
  private async checkNotificationThreshold(error: ErrorEntry): Promise<void> {
    const analysis = this.analyzeError(new Error(error.message));
    
    if (analysis.pattern?.notificationThreshold) {
      if (error.count >= analysis.pattern.notificationThreshold) {
        this.emit('threshold-reached', {
          error,
          threshold: analysis.pattern.notificationThreshold,
          category: analysis.category
        });
        
        // Send critical notification for patterns
        if (error.level === 'critical') {
          await this.sendCriticalNotification(error);
        }
      }
    }
  }
  
  /**
   * Send critical error notification
   */
  private async sendCriticalNotification(error: ErrorEntry): Promise<void> {
    try {
      await supabase.from('critical_alerts').insert({
        error_id: error.id,
        message: `Critical error: ${error.message}`,
        component: error.context.component,
        count: error.count,
        created_at: new Date().toISOString()
      });
    } catch (err) {

    }
  }
  
  /**
   * Prune old errors from memory
   */
  private pruneOldErrors(): void {
    if (this.errors.size <= this.config.maxErrorsInMemory) {return;}
    
    // Sort by last seen and remove oldest
    const sorted = Array.from(this.errors.entries())
      .sort((a, b) => a[1].lastSeen.getTime() - b[1].lastSeen.getTime());
    
    const toRemove = sorted.slice(0, sorted.length - this.config.maxErrorsInMemory);
    
    for (const [fingerprint] of toRemove) {
      this.errors.delete(fingerprint);
    }
  }
  
  /**
   * Generate unique IDs
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${this.errorCount || 0}`;
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now()}_${process.pid}`;
  }
  
  private generateRequestId(): string {
    return `req_${++this.requestCounter}_${Date.now()}`;
  }
  
  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    recentErrors: ErrorEntry[];
    topErrors: ErrorEntry[];
    unresolvedCount: number;
  } {
    const stats = {
      total: 0,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      recentErrors: [] as ErrorEntry[],
      topErrors: [] as ErrorEntry[],
      unresolvedCount: 0
    };
    
    const errors = Array.from(this.errors.values());
    
    for (const error of errors) {
      stats.total += error.count;
      
      // By level
      stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + error.count;
      
      // By category
      for (const tag of error.tags) {
        stats.byCategory[tag] = (stats.byCategory[tag] || 0) + error.count;
      }
      
      // Unresolved
      if (!error.resolved) {
        stats.unresolvedCount++;
      }
    }
    
    // Recent errors (last 10)
    stats.recentErrors = errors
      .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
      .slice(0, 10);
    
    // Top errors by count
    stats.topErrors = errors
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return stats;
  }
  
  /**
   * Search errors
   */
  searchErrors(criteria: {
    level?: ErrorEntry['level'];
    component?: string;
    dateFrom?: Date;
    dateTo?: Date;
    resolved?: boolean;
    tags?: string[];
  }): ErrorEntry[] {
    let results = Array.from(this.errors.values());
    
    if (criteria.level) {
      results = results.filter(e => e.level === criteria.level);
    }
    
    if (criteria.component) {
      results = results.filter(e => e.context.component === criteria.component);
    }
    
    if (criteria.dateFrom) {
      results = results.filter(e => e.lastSeen >= criteria.dateFrom!);
    }
    
    if (criteria.dateTo) {
      results = results.filter(e => e.firstSeen <= criteria.dateTo!);
    }
    
    if (criteria.resolved !== undefined) {
      results = results.filter(e => e.resolved === criteria.resolved);
    }
    
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(e => 
        criteria.tags!.some(tag => e.tags.includes(tag))
      );
    }
    
    return results;
  }
  
  /**
   * Mark error as resolved
   */
  async resolveError(fingerprint: string): Promise<void> {
    const error = this.errors.get(fingerprint);
    if (error) {
      error.resolved = true;
      error.resolvedAt = new Date();
      
      // Update in database
      await supabase
        .from('error_logs')
        .update({
          resolved: true,
          resolved_at: error.resolvedAt.toISOString()
        })
        .eq('fingerprint', fingerprint);
      
      this.emit('error-resolved', error);
    }
  }
  
  /**
   * Add custom error pattern
   */
  addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.push(pattern);
  }
  
  /**
   * Export logs for analysis
   */
  async exportLogs(options: {
    format: 'json' | 'csv';
    dateFrom?: Date;
    dateTo?: Date;
    outputPath?: string;
  }): Promise<string> {
    const errors = this.searchErrors({
      dateFrom: options.dateFrom,
      dateTo: options.dateTo
    });
    
    let content: string;
    
    if (options.format === 'json') {
      content = JSON.stringify(errors, null, 2);
    } else {
      // CSV format
      const headers = ['id', 'level', 'message', 'count', 'firstSeen', 'lastSeen', 'tags'];
      const rows = errors.map(e => [
        e.id,
        e.level,
        e.message.replace(/,/g, ';'),
        e.count,
        e.firstSeen.toISOString(),
        e.lastSeen.toISOString(),
        e.tags.join(';')
      ]);
      
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    if (options.outputPath) {
      await fs.writeFile(options.outputPath, content, 'utf8');
      return options.outputPath;
    }
    
    return content;
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.errors.clear();
    this.logBuffer = [];

  }
  
  /**
   * Stop logging service
   */
  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Final flush
    this.flushLogs();

  }
}

// Export singleton instance
export const errorLogger = new ErrorLoggingService();

// Helper function for easy logging
export function logError(
  error: Error | string,
  level?: ErrorEntry['level'],
  context?: Partial<ErrorContext>
): Promise<string> {
  return errorLogger.logError(error, level, context);
}