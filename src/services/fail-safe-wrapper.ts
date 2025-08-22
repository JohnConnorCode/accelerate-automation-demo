import { supabase } from '../lib/supabase-client';
import { intelligentCache } from './intelligent-cache-service';

/**
 * Fail-Safe Wrapper Service
 * Adds multiple layers of protection to ensure system reliability
 */

interface RetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  timeout?: number;
  fallbackValue?: any;
  onError?: (error: Error, attempt: number) => void;
}

interface ValidationOptions {
  required?: string[];
  types?: Record<string, string>;
  ranges?: Record<string, { min?: number; max?: number }>;
  patterns?: Record<string, RegExp>;
  custom?: (data: any) => boolean;
}

interface CircuitBreakerOptions {
  threshold?: number;
  timeout?: number;
  resetTimeout?: number;
}

export class FailSafeWrapper {
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: Date;
    state: 'closed' | 'open' | 'half-open';
  }> = new Map();
  
  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
    timeout: 30000
  };
  
  private readonly defaultCircuitBreakerOptions: CircuitBreakerOptions = {
    threshold: 5,
    timeout: 60000,
    resetTimeout: 30000
  };
  
  /**
   * Execute operation with comprehensive fail-safes
   */
  async safeExecute<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: {
      retry?: RetryOptions;
      validation?: ValidationOptions;
      circuitBreaker?: CircuitBreakerOptions;
      cache?: { key: string; ttl: number };
      monitoring?: boolean;
    }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      // Check circuit breaker
      if (options?.circuitBreaker && typeof options.circuitBreaker === 'object') {
        const breaker = this.checkCircuitBreaker(
          operationName,
          options?.circuitBreaker
        );
        
        if (breaker.state === 'open') {
          throw new Error(`Circuit breaker open for ${operationName}`);
        }
      }
      
      // Try cache first if configured
      if (options?.cache) {
        const cached = await this.tryCache<T>(options.cache.key);
        if (cached !== null) {
          this.recordSuccess(operationName);
          return cached;
        }
      }
      
      // Execute with retry logic
      const result = await this.executeWithRetry(
        operation,
        operationName,
        options?.retry
      );
      
      // Validate result if configured
      if (options?.validation) {
        this.validateResult(result, options.validation);
      }
      
      // Cache result if configured
      if (options?.cache && result !== null && result !== undefined) {
        await this.cacheResult(options.cache.key, result, options.cache.ttl);
      }
      
      // Record success
      this.recordSuccess(operationName);
      
      // Monitor if configured
      if (options?.monitoring) {
        await this.recordMetrics(operationName, 'success', Date.now() - startTime);
      }
      
      return result;
      
    } catch (error) {
      // Record failure
      this.recordFailure(operationName);
      
      // Monitor if configured
      if (options?.monitoring) {
        await this.recordMetrics(operationName, 'failure', Date.now() - startTime, error);
      }
      
      // Try fallback if provided
      if (options?.retry?.fallbackValue !== undefined) {
        console.warn(`[FailSafe] Using fallback for ${operationName}:`, error);
        return options.retry.fallbackValue;
      }
      
      throw error;
    }
  }
  
  /**
   * Execute with retry logic and exponential backoff
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options?: RetryOptions
  ): Promise<T> {
    const config = { ...this.defaultRetryOptions, ...options };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= config.maxRetries!; attempt++) {
      try {
        // Add timeout wrapper
        const result = await this.withTimeout(
          operation(),
          config.timeout!,
          `${operationName} timed out after ${config.timeout}ms`
        );
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Call error handler if provided
        if (config.onError) {
          config.onError(lastError, attempt);
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw lastError;
        }
        
        // Check if we've exhausted retries
        if (attempt >= config.maxRetries!) {
          throw new Error(
            `${operationName} failed after ${config.maxRetries} retries: ${lastError.message}`
          );
        }
        
        // Calculate delay with exponential backoff
        const delay = config.exponentialBackoff
          ? config.retryDelay! * Math.pow(2, attempt)
          : config.retryDelay!;
        
        console.log(
          `[FailSafe] Retry ${attempt + 1}/${config.maxRetries} for ${operationName} after ${delay}ms`
        );
        
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  /**
   * Validate result against schema
   */
  private validateResult(data: any, options: ValidationOptions): void {
    // Check required fields
    if (options.required) {
      for (const field of options.required) {
        if (data[field] === undefined || data[field] === null) {
          throw new Error(`Validation failed: Required field '${field}' is missing`);
        }
      }
    }
    
    // Check types
    if (options.types) {
      for (const [field, expectedType] of Object.entries(options.types)) {
        const actualType = typeof data[field];
        if (actualType !== expectedType) {
          throw new Error(
            `Validation failed: Field '${field}' expected ${expectedType}, got ${actualType}`
          );
        }
      }
    }
    
    // Check ranges
    if (options.ranges) {
      for (const [field, range] of Object.entries(options.ranges)) {
        const value = data[field];
        if (typeof value === 'number') {
          if (range.min !== undefined && value < range.min) {
            throw new Error(
              `Validation failed: Field '${field}' value ${value} is below minimum ${range.min}`
            );
          }
          if (range.max !== undefined && value > range.max) {
            throw new Error(
              `Validation failed: Field '${field}' value ${value} exceeds maximum ${range.max}`
            );
          }
        }
      }
    }
    
    // Check patterns
    if (options.patterns) {
      for (const [field, pattern] of Object.entries(options.patterns)) {
        const value = data[field];
        if (typeof value === 'string' && !pattern.test(value)) {
          throw new Error(
            `Validation failed: Field '${field}' does not match required pattern`
          );
        }
      }
    }
    
    // Custom validation
    if (options.custom && !options.custom(data)) {
      throw new Error('Validation failed: Custom validation check failed');
    }
  }
  
  /**
   * Check circuit breaker state
   */
  private checkCircuitBreaker(
    operationName: string,
    options?: CircuitBreakerOptions
  ): { state: 'closed' | 'open' | 'half-open' } {
    const config = { ...this.defaultCircuitBreakerOptions, ...options };
    
    let breaker = this.circuitBreakers.get(operationName);
    
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailure: new Date(0),
        state: 'closed'
      };
      this.circuitBreakers.set(operationName, breaker);
    }
    
    // Check if circuit should reset to half-open
    if (breaker.state === 'open') {
      const timeSinceLastFailure = Date.now() - breaker.lastFailure.getTime();
      if (timeSinceLastFailure > config.resetTimeout!) {
        breaker.state = 'half-open';
        console.log(`[CircuitBreaker] ${operationName} moved to half-open state`);
      }
    }
    
    return breaker;
  }
  
  /**
   * Record operation success
   */
  private recordSuccess(operationName: string): void {
    const breaker = this.circuitBreakers.get(operationName);
    
    if (breaker) {
      if (breaker.state === 'half-open') {
        // Reset to closed after successful operation
        breaker.state = 'closed';
        breaker.failures = 0;
        console.log(`[CircuitBreaker] ${operationName} circuit closed`);
      } else if (breaker.state === 'closed') {
        // Reset failure count on success
        breaker.failures = 0;
      }
    }
  }
  
  /**
   * Record operation failure
   */
  private recordFailure(operationName: string): void {
    const breaker = this.circuitBreakers.get(operationName) || {
      failures: 0,
      lastFailure: new Date(),
      state: 'closed' as const
    };
    
    breaker.failures++;
    breaker.lastFailure = new Date();
    
    // Open circuit if threshold reached
    if (breaker.failures >= this.defaultCircuitBreakerOptions.threshold!) {
      breaker.state = 'open';
      console.error(
        `[CircuitBreaker] ${operationName} circuit opened after ${breaker.failures} failures`
      );
    }
    
    this.circuitBreakers.set(operationName, breaker);
  }
  
  /**
   * Try to get from cache
   */
  private async tryCache<T>(key: string): Promise<T | null> {
    try {
      return await intelligentCache.get<T>(key);
    } catch (error) {
      console.warn('[FailSafe] Cache read failed:', error);
      return null;
    }
  }
  
  /**
   * Cache result
   */
  private async cacheResult<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      await intelligentCache.set(key, data, { ttl });
    } catch (error) {
      console.warn('[FailSafe] Cache write failed:', error);
      // Don't throw - caching is not critical
    }
  }
  
  /**
   * Record metrics for monitoring
   */
  private async recordMetrics(
    operation: string,
    status: 'success' | 'failure',
    duration: number,
    error?: any
  ): Promise<void> {
    try {
      await supabase.from('operation_metrics').insert({
        operation,
        status,
        duration,
        error: error ? this.serializeError(error) : null,
        timestamp: new Date().toISOString()
      });
    } catch (metricError) {
      console.warn('[FailSafe] Failed to record metrics:', metricError);
      // Don't throw - metrics are not critical
    }
  }
  
  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('etimedout')
    ) {
      return true;
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
    
    // Temporary failures
    if (
      message.includes('temporarily unavailable') ||
      message.includes('service unavailable') ||
      message.includes('gateway timeout')
    ) {
      return true;
    }
    
    // Database connection errors
    if (message.includes('connection') && message.includes('database')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Wrap promise with timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeout: number,
    errorMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(errorMessage)), timeout)
      )
    ]);
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Serialize error for storage
   */
  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }
  
  /**
   * Batch operations with fail-safes
   */
  async safeBatch<T, R>(
    items: T[],
    operation: (item: T) => Promise<R>,
    options?: {
      batchSize?: number;
      stopOnError?: boolean;
      progressCallback?: (completed: number, total: number) => void;
    }
  ): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
    const batchSize = options?.batchSize || 10;
    const results: R[] = [];
    const errors: Array<{ item: T; error: Error }> = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await this.safeExecute(
            () => operation(item),
            'batch-operation',
            {
              retry: { maxRetries: 2, retryDelay: 500 }
            }
          );
          return { success: true, result, item };
        } catch (error) {
          return { success: false, error: error as Error, item };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      for (const res of batchResults) {
        if (res.success) {
          results.push(res.result!);
        } else {
          errors.push({ item: res.item, error: res.error! });
          
          if (options?.stopOnError) {
            return { results, errors };
          }
        }
      }
      
      // Progress callback
      if (options?.progressCallback) {
        options.progressCallback(
          Math.min(i + batchSize, items.length),
          items.length
        );
      }
    }
    
    return { results, errors };
  }
  
  /**
   * Safe database operation with connection pooling
   */
  async safeDbOperation<T>(
    operation: () => Promise<T>,
    tableName: string
  ): Promise<T> {
    return this.safeExecute(
      operation,
      `db:${tableName}`,
      {
        retry: {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          timeout: 30000
        },
        circuitBreaker: {
          threshold: 5,
          timeout: 60000,
          resetTimeout: 30000
        },
        monitoring: true
      }
    );
  }
  
  /**
   * Safe API call with rate limiting awareness
   */
  async safeApiCall<T>(
    operation: () => Promise<T>,
    apiName: string,
    options?: {
      rateLimit?: { maxRetries: number; retryDelay: number };
    }
  ): Promise<T> {
    return this.safeExecute(
      operation,
      `api:${apiName}`,
      {
        retry: {
          maxRetries: options?.rateLimit?.maxRetries || 3,
          retryDelay: options?.rateLimit?.retryDelay || 2000,
          exponentialBackoff: true,
          timeout: 60000,
          onError: (error, attempt) => {
            if (error.message.includes('rate limit')) {
              console.log(
                `[FailSafe] Rate limited on ${apiName}, waiting ${
                  2000 * Math.pow(2, attempt)
                }ms`
              );
            }
          }
        },
        circuitBreaker: {
          threshold: 10,
          timeout: 300000, // 5 minutes for API rate limits
          resetTimeout: 60000
        },
        monitoring: true
      }
    );
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, any> {
    return new Map(this.circuitBreakers);
  }
  
  /**
   * Reset circuit breaker for an operation
   */
  resetCircuitBreaker(operationName: string): void {
    this.circuitBreakers.delete(operationName);
    console.log(`[CircuitBreaker] Reset circuit for ${operationName}`);
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.clear();
    console.log('[CircuitBreaker] All circuits reset');
  }
}

// Export singleton instance
export const failSafe = new FailSafeWrapper();