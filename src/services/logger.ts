// Browser-compatible logger that doesn't use Node.js modules

interface LogLevel {
  error: 0;
  warn: 1;
  info: 2;
  debug: 3;
}

class BrowserLogger {
  private level: keyof LogLevel = 'info';
  private service = 'accelerate-content';

  constructor() {
    // Use environment variable if available
    if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
      this.level = process.env.LOG_LEVEL as keyof LogLevel;
    }
  }

  private shouldLog(level: keyof LogLevel): boolean {
    const levels: LogLevel = { error: 0, warn: 1, info: 2, debug: 3 };
    return levels[level] <= levels[this.level];
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const formatted = {
      timestamp,
      level,
      service: this.service,
      message,
      ...meta
    };
    return JSON.stringify(formatted);
  }

  error(message: string, meta?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }

  warn(message: string, meta?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  info(message: string, meta?: any): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  debug(message: string, meta?: any): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  log(level: keyof LogLevel, message: string, meta?: any): void {
    this[level](message, meta);
  }
}

// Export singleton instances
export const logger = new BrowserLogger();
export const auditLogger = new BrowserLogger();

// Helper function for performance logging
export function logPerformance(operation: string, startTime: number): void {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, { duration: `${duration}ms` });
}

// Helper for error logging with stack traces
export function logError(error: Error | unknown, context?: string): void {
  const errorDetails = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name
  } : { message: String(error) };

  logger.error(context || 'An error occurred', errorDetails);
}

// Export default logger
export default logger;