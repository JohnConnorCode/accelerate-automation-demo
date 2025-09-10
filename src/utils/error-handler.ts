/**
 * Centralized error handling with proper logging and recovery
 */

import { logger } from '../services/logger';

export enum ErrorSeverity {
  LOW = 'low',      // Log and continue
  MEDIUM = 'medium', // Log, alert, continue
  HIGH = 'high',    // Log, alert, may fail
  CRITICAL = 'critical' // Log, alert, must fail
}

export class AppError extends Error {
  constructor(
    message: string,
    public severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    public code?: string,
    public context?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  private static errors: AppError[] = [];
  
  /**
   * Handle error based on severity
   */
  static handle(error: Error | AppError, context?: any): void {
    const appError = error instanceof AppError 
      ? error 
      : new AppError(error.message, ErrorSeverity.MEDIUM, undefined, context);
    
    // Always log
    logger.error(appError.message, {
      severity: appError.severity,
      code: appError.code,
      context: appError.context,
      stack: appError.stack
    });
    
    // Store for reporting
    this.errors.push(appError);
    
    // Handle based on severity
    switch (appError.severity) {
      case ErrorSeverity.CRITICAL:
        // Re-throw critical errors
        throw appError;
        
      case ErrorSeverity.HIGH:
        // Alert but continue
        console.error(`⚠️ HIGH SEVERITY ERROR: ${appError.message}`);
        break;
        
      case ErrorSeverity.MEDIUM:
        // Log with warning
        console.warn(`⚠️ ${appError.message}`);
        break;
        
      case ErrorSeverity.LOW:
        // Just log
        console.log(`ℹ️ ${appError.message}`);
        break;
    }
  }
  
  /**
   * Wrap async function with error handling
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    context: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handle(
        new AppError(
          `Error in ${context}: ${error}`,
          severity,
          'ASYNC_ERROR',
          { context, originalError: error }
        )
      );
      return null;
    }
  }
  
  /**
   * Wrap sync function with error handling
   */
  static wrapSync<T>(
    fn: () => T,
    context: string,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
  ): T | null {
    try {
      return fn();
    } catch (error) {
      this.handle(
        new AppError(
          `Error in ${context}: ${error}`,
          severity,
          'SYNC_ERROR',
          { context, originalError: error }
        )
      );
      return null;
    }
  }
  
  /**
   * Get error summary
   */
  static getSummary(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    recent: string[];
  } {
    const bySeverity = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    this.errors.forEach(error => {
      bySeverity[error.severity]++;
    });
    
    return {
      total: this.errors.length,
      bySeverity,
      recent: this.errors.slice(-5).map(e => e.message)
    };
  }
  
  /**
   * Clear error history
   */
  static clear(): void {
    this.errors = [];
  }
  
  /**
   * Retry function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`⏳ Retry ${attempt}/${maxAttempts} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new AppError(
      `Failed after ${maxAttempts} attempts: ${lastError?.message}`,
      ErrorSeverity.HIGH,
      'RETRY_EXHAUSTED'
    );
  }
}