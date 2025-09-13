/**
 * Enhanced fetcher with retry logic and error handling
 */

export interface FetchWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export class FetcherWithRetry {
  private static defaultOptions: FetchWithRetryOptions = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000
  };

  /**
   * Fetch with automatic retry on failure
   */
  static async fetch(
    url: string,
    options?: RequestInit,
    retryOptions?: FetchWithRetryOptions
  ): Promise<Response> {
    const config = { ...this.defaultOptions, ...retryOptions };
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= (config.maxRetries || 3); attempt++) {
      try {
        // Add timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is ok
        if (!response.ok) {
          // Don't retry on 4xx errors (client errors)
          if (response.status >= 400 && response.status < 500) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          // Retry on 5xx errors (server errors)
          throw new Error(`HTTP ${response.status}: ${response.statusText} (will retry)`);
        }
        
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on abort or client errors
        if (error.name === 'AbortError' || 
            (error.message && error.message.includes('HTTP 4'))) {
          throw error;
        }
        
        // If we have retries left, wait and try again
        if (attempt < (config.maxRetries || 3)) {
          if (config.onRetry) {
            config.onRetry(attempt + 1, error);
          }
          console.log(`⚠️ Retry ${attempt + 1}/${config.maxRetries} for ${url}: ${error.message}`);
          await this.delay(config.retryDelay || 1000);
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Batch fetch multiple URLs with retry logic
   */
  static async fetchBatch(
    urls: string[],
    options?: RequestInit,
    retryOptions?: FetchWithRetryOptions
  ): Promise<{ url: string; response?: Response; error?: Error }[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.fetch(url, options, retryOptions))
    );
    
    return results.map((result, index) => ({
      url: urls[index],
      response: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason : undefined
    }));
  }

  /**
   * Helper to delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Wrapper for fetchers to add retry logic
 */
export class RobustFetcher<T> {
  constructor(
    private fetcher: {
      fetch: () => Promise<T[]>;
      transform: (data: T[]) => any[];
    },
    private name: string
  ) {}

  async fetchWithRetry(): Promise<{ items: any[]; errors: string[] }> {
    const errors: string[] = [];
    let items: any[] = [];
    
    try {
      console.log(`🔄 Fetching from ${this.name}...`);
      
      // Try to fetch with timeout
      const fetchPromise = this.fetcher.fetch();
      const timeoutPromise = new Promise<T[]>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 30000)
      );
      
      const data = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Transform the data
      items = this.fetcher.transform(data);
      
      console.log(`✅ ${this.name}: Successfully fetched ${items.length} items`);
      
    } catch (error: any) {
      const errorMessage = `${this.name} failed: ${error.message}`;
      errors.push(errorMessage);
      console.log(`❌ ${errorMessage}`);
      
      // Return empty items but log the error
      items = [];
    }
    
    return { items, errors };
  }

  /**
   * Validate fetched items
   */
  validateItems(items: any[]): any[] {
    return items.filter(item => {
      // Must have title or name
      if (!item.title && !item.name) {return false;}
      
      // Must have URL
      if (!item.url) {return false;}
      
      // Must be a real item (not placeholder)
      if (item.title?.toLowerCase().includes('example') ||
          item.title?.toLowerCase().includes('test')) {
        return false;
      }
      
      // Must have project_needs for project type
      if (item.type === 'project' && !item.metadata?.project_needs) {
        return false;
      }
      
      return true;
    });
  }
}