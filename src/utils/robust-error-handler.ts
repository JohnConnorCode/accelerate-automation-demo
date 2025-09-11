/**
 * Robust Error Handler with retry logic and proper logging
 */

import { logger } from '../services/logger';

export enum ErrorSeverity {
  LOW = 'low',      // Continue operation
  MEDIUM = 'medium', // Retry operation
  HIGH = 'high',    // Fail operation
  CRITICAL = 'critical' // Stop everything
}

export interface ErrorContext {
  operation: string;
  source?: string;
  item?: any;
  attempt?: number;
  maxAttempts?: number;
}

export class RobustErrorHandler {
  /**
   * Handle error with appropriate action based on severity
   */
  static handle(error: any, context: ErrorContext, severity: ErrorSeverity = ErrorSeverity.MEDIUM): void {
    // Log the error with full context
    logger.error(`Error in ${context.operation}`, {
      error: error.message || error,
      stack: error.stack,
      severity,
      context
    });

    // Take action based on severity
    switch (severity) {
      case ErrorSeverity.LOW:
        // Just log and continue
        logger.debug(`Continuing despite error in ${context.operation}`);
        break;
        
      case ErrorSeverity.MEDIUM:
        // Will retry if attempts remaining
        if (context.attempt && context.maxAttempts && context.attempt < context.maxAttempts) {
          logger.info(`Will retry ${context.operation} (attempt ${context.attempt}/${context.maxAttempts})`);
        }
        break;
        
      case ErrorSeverity.HIGH:
        // Operation failed
        logger.warn(`Operation failed: ${context.operation}`);
        break;
        
      case ErrorSeverity.CRITICAL:
        // System failure
        logger.error(`CRITICAL ERROR in ${context.operation} - system may be unstable`);
        // Could trigger alerts here
        break;
    }
  }

  /**
   * Wrap async operation with error handling and retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    maxAttempts: number = 3,
    backoffMs: number = 1000
  ): Promise<T | null> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        context.attempt = attempt;
        context.maxAttempts = maxAttempts;
        
        const result = await operation();
        
        // Success - log if it was a retry
        if (attempt > 1) {
          logger.info(`${context.operation} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        // Determine if we should retry
        const shouldRetry = attempt < maxAttempts && this.isRetryable(error);
        
        if (shouldRetry) {
          this.handle(error, context, ErrorSeverity.MEDIUM);
          
          // Exponential backoff
          const delay = backoffMs * Math.pow(2, attempt - 1);
          logger.debug(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Final failure
          this.handle(error, context, ErrorSeverity.HIGH);
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * Determine if error is retryable
   */
  private static isRetryable(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Network errors - retry
    if (message.includes('network') || 
        message.includes('timeout') || 
        message.includes('econnrefused') ||
        message.includes('enotfound')) {
      return true;
    }
    
    // Rate limiting - retry with backoff
    if (message.includes('rate limit') || 
        message.includes('too many requests') ||
        error.status === 429) {
      return true;
    }
    
    // Server errors - retry
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Database errors - don't retry
    if (message.includes('duplicate key') || 
        message.includes('constraint') ||
        message.includes('schema')) {
      return false;
    }
    
    // Default - retry for unknown errors
    return true;
  }

  /**
   * Safe JSON parse with error handling
   */
  static safeJsonParse(text: string, context: string): any {
    try {
      return JSON.parse(text);
    } catch (error) {
      logger.warn(`Failed to parse JSON in ${context}`, {
        error: error.message,
        sample: text.substring(0, 100)
      });
      return null;
    }
  }

  /**
   * Safe property access with default
   */
  static safeGet<T>(obj: any, path: string, defaultValue: T): T {
    try {
      const keys = path.split('.');
      let result = obj;
      
      for (const key of keys) {
        if (result == null) {
          return defaultValue;
        }
        result = result[key];
      }
      
      return result ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Wrap operation in try-catch with logging
   */
  static trySync<T>(operation: () => T, context: string, defaultValue: T): T {
    try {
      return operation();
    } catch (error) {
      logger.warn(`Error in ${context}`, { error: error.message });
      return defaultValue;
    }
  }

  /**
   * Validate required fields exist
   */
  static validateRequired(obj: any, fields: string[], context: string): boolean {
    const missing = fields.filter(field => !obj[field]);
    
    if (missing.length > 0) {
      logger.warn(`Missing required fields in ${context}`, { missing });
      return false;
    }
    
    return true;
  }

  /**
   * Sanitize user input to prevent injection
   */
  static sanitize(input: any): string {
    if (typeof input !== 'string') {
      return String(input);
    }
    
    // Remove SQL injection attempts
    let sanitized = input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
    
    // Limit length
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
    }
    
    return sanitized;
  }
}

export default RobustErrorHandler;