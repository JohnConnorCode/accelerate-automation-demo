/**
 * Retry Fetcher - Adds retry logic to fetch operations
 * Implements exponential backoff and circuit breaker pattern
 */

import { logError, logInfo } from '../services/error-logger';

interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: any) => void;
}

interface CircuitBreakerState {
  failures: number;
  lastFailTime: number;
  state: 'closed' | 'open' | 'half-open';
}

class RetryFetcher {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute
  
  /**
   * Fetch with retry logic
   */
  async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Response> {
    const {
      maxRetries = 3,
      initialDelay = 1000,
      maxDelay = 10000,
      backoffMultiplier = 2,
      timeout = 30000,
      onRetry
    } = retryOptions;
    
    // Check circuit breaker
    const domain = new URL(url).hostname;
    if (this.isCircuitOpen(domain)) {
      throw new Error(`Circuit breaker open for ${domain}`);
    }
    
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Add timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Reset circuit breaker on success
        this.resetCircuitBreaker(domain);
        
        if (!response.ok && attempt < maxRetries) {
          // Retry on 5xx errors or rate limiting
          if (response.status >= 500 || response.status === 429) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        }
        
        return response;
        
      } catch (error) {
        lastError = error;
        
        // Record failure for circuit breaker
        this.recordFailure(domain);
        
        if (attempt < maxRetries) {
          const delay = Math.min(
            initialDelay * Math.pow(backoffMultiplier, attempt),
            maxDelay
          );
          
          logInfo(`Retry attempt ${attempt + 1}/${maxRetries} for ${url}`, 'retry-fetcher', {
            error: error instanceof Error ? error.message : String(error),
            delay
          });
          
          if (onRetry) {
            onRetry(attempt + 1, error);
          }
          
          await this.sleep(delay);
        }
      }
    }
    
    logError(`All retries failed for ${url}`, 'retry-fetcher', lastError);
    throw lastError;
  }
  
  /**
   * Batch fetch with retry
   */
  async fetchBatchWithRetry(
    urls: string[],
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<Array<{ url: string; response?: Response; error?: any }>> {
    const results = await Promise.allSettled(
      urls.map(url => this.fetchWithRetry(url, options, retryOptions))
    );
    
    return results.map((result, index) => ({
      url: urls[index],
      response: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason : undefined
    }));
  }
  
  /**
   * Circuit breaker management
   */
  private isCircuitOpen(domain: string): boolean {
    const state = this.circuitBreakers.get(domain);
    if (!state) {return false;}
    
    if (state.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - state.lastFailTime > this.CIRCUIT_BREAKER_TIMEOUT) {
        // Move to half-open state
        state.state = 'half-open';
        state.failures = Math.floor(state.failures / 2); // Reduce failure count
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  private recordFailure(domain: string) {
    const state = this.circuitBreakers.get(domain) || {
      failures: 0,
      lastFailTime: 0,
      state: 'closed' as const
    };
    
    state.failures++;
    state.lastFailTime = Date.now();
    
    if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      state.state = 'open';
      logError(`Circuit breaker opened for ${domain}`, 'retry-fetcher', {
        failures: state.failures
      });
    }
    
    this.circuitBreakers.set(domain, state);
  }
  
  private resetCircuitBreaker(domain: string) {
    const state = this.circuitBreakers.get(domain);
    if (state) {
      state.failures = 0;
      state.state = 'closed';
    }
  }
  
  /**
   * Helper to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers() {
    this.circuitBreakers.clear();
  }
}

export const retryFetcher = new RetryFetcher();