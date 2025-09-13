import { supabase } from '../lib/supabase-client';
import { intelligentCache } from './intelligent-cache-service';

/**
 * Rate Limiting Service for API Protection
 * Prevents abuse and ensures fair usage across all endpoints
 */

interface RateLimitConfig {
  endpoint: string;
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  priority?: 'low' | 'medium' | 'high';
}

interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

interface ClientMetrics {
  requests: number;
  lastRequest: number;
  violations: number;
  blocked: boolean;
  blockExpiry?: number;
}

export class RateLimitingService {
  private limits: Map<string, RateLimitConfig> = new Map();
  private clients: Map<string, ClientMetrics> = new Map();
  
  // Default rate limits per endpoint (requests per minute)
  private readonly defaultLimits: RateLimitConfig[] = [
    // Public endpoints - more restrictive
    { endpoint: '/api/health', maxRequests: 60, windowMs: 60000 },
    { endpoint: '/api/status', maxRequests: 60, windowMs: 60000 },
    
    // Data fetching - moderate limits
    { endpoint: '/api/fetch', maxRequests: 10, windowMs: 60000, burstLimit: 3 },
    { endpoint: '/api/search', maxRequests: 30, windowMs: 60000 },
    { endpoint: '/api/analytics', maxRequests: 20, windowMs: 60000 },
    
    // AI operations - strict limits (expensive)
    { endpoint: '/api/ai-assess', maxRequests: 5, windowMs: 60000, priority: 'high' },
    { endpoint: '/api/quality-check', maxRequests: 10, windowMs: 60000 },
    
    // Admin operations - relaxed for authenticated users
    { endpoint: '/api/admin', maxRequests: 100, windowMs: 60000, priority: 'high' },
    { endpoint: '/api/schedule', maxRequests: 30, windowMs: 60000 },
    
    // Bulk operations - very strict
    { endpoint: '/api/bulk', maxRequests: 2, windowMs: 60000, burstLimit: 1 },
    { endpoint: '/api/enrich', maxRequests: 5, windowMs: 60000 },
    
    // Default for unspecified endpoints
    { endpoint: '*', maxRequests: 20, windowMs: 60000 }
  ];
  
  // IP-based blocking for severe violations
  private blockedIPs: Set<string> = new Set();
  private readonly blockDurationMs = 3600000; // 1 hour
  
  constructor() {
    this.initializeLimits();
    this.startCleanupInterval();
  }
  
  /**
   * Initialize rate limits
   */
  private initializeLimits(): void {
    this.defaultLimits.forEach(limit => {
      this.limits.set(limit.endpoint, limit);
    });

  }
  
  /**
   * Check if request is allowed
   */
  async checkLimit(
    endpoint: string,
    clientId: string,
    options?: {
      weight?: number;  // Some requests count more
      bypassCache?: boolean;
      metadata?: any;
    }
  ): Promise<RateLimitStatus> {
    // Check if IP is blocked
    if (this.blockedIPs.has(clientId)) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + this.blockDurationMs),
        retryAfter: this.blockDurationMs / 1000
      };
    }
    
    // Get rate limit config for endpoint
    const config = this.getLimitConfig(endpoint);
    
    // Get or create client metrics
    const metrics = this.getClientMetrics(clientId);
    
    // Check if window has expired
    const now = Date.now();
    if (now - metrics.lastRequest > config.windowMs) {
      // Reset window
      metrics.requests = 0;
      metrics.lastRequest = now;
    }
    
    // Calculate request weight
    const weight = options?.weight || 1;
    
    // Check burst limit
    if (config.burstLimit) {
      const recentRequests = this.getRecentRequests(clientId, 5000); // Last 5 seconds
      if (recentRequests >= config.burstLimit) {
        this.recordViolation(clientId, endpoint, 'burst_limit');
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(now + 5000),
          retryAfter: 5
        };
      }
    }
    
    // Check rate limit
    if (metrics.requests + weight > config.maxRequests) {
      this.recordViolation(clientId, endpoint, 'rate_limit');
      
      // Check if should block IP
      if (metrics.violations > 10) {
        await this.blockClient(clientId, 'Excessive rate limit violations');
      }
      
      const resetAt = new Date(metrics.lastRequest + config.windowMs);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt.getTime() - now) / 1000)
      };
    }
    
    // Request allowed - update metrics
    metrics.requests += weight;
    metrics.lastRequest = now;
    this.clients.set(clientId, metrics);
    
    // Log high-priority endpoint usage
    if (config.priority === 'high') {
      await this.logUsage(endpoint, clientId, options?.metadata);
    }
    
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - metrics.requests),
      resetAt: new Date(metrics.lastRequest + config.windowMs)
    };
  }
  
  /**
   * Get rate limit configuration for endpoint
   */
  private getLimitConfig(endpoint: string): RateLimitConfig {
    // Check exact match
    if (this.limits.has(endpoint)) {
      return this.limits.get(endpoint)!;
    }
    
    // Check pattern match
    for (const [pattern, config] of this.limits.entries()) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(endpoint)) {
          return config;
        }
      }
    }
    
    // Return default
    return this.limits.get('*')!;
  }
  
  /**
   * Get or create client metrics
   */
  private getClientMetrics(clientId: string): ClientMetrics {
    if (!this.clients.has(clientId)) {
      this.clients.set(clientId, {
        requests: 0,
        lastRequest: Date.now(),
        violations: 0,
        blocked: false
      });
    }
    return this.clients.get(clientId)!;
  }
  
  /**
   * Get recent requests count
   */
  private getRecentRequests(clientId: string, windowMs: number): number {
    const metrics = this.clients.get(clientId);
    if (!metrics) {return 0;}
    
    const now = Date.now();
    if (now - metrics.lastRequest > windowMs) {
      return 0;
    }
    
    // Simple estimation based on current window
    return metrics.requests;
  }
  
  /**
   * Record rate limit violation
   */
  private recordViolation(clientId: string, endpoint: string, type: string): void {
    const metrics = this.getClientMetrics(clientId);
    metrics.violations++;

    // Store violation in database for analysis
    supabase.from('rate_limit_violations').insert({
      client_id: clientId,
      endpoint,
      violation_type: type,
      timestamp: new Date().toISOString()
    }).then(() => {}).then(undefined, console.error);
  }
  
  /**
   * Block client for severe violations
   */
  private async blockClient(clientId: string, reason: string): Promise<void> {

    this.blockedIPs.add(clientId);
    
    const metrics = this.getClientMetrics(clientId);
    metrics.blocked = true;
    metrics.blockExpiry = Date.now() + this.blockDurationMs;
    
    // Store block in database
    await supabase.from('blocked_clients').insert({
      client_id: clientId,
      reason,
      blocked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + this.blockDurationMs).toISOString()
    });
    
    // Schedule unblock
    setTimeout(() => {
      this.blockedIPs.delete(clientId);
      const m = this.clients.get(clientId);
      if (m) {
        m.blocked = false;
        m.violations = 0;
      }

    }, this.blockDurationMs);
  }
  
  /**
   * Log usage for analytics
   */
  private async logUsage(endpoint: string, clientId: string, metadata?: any): Promise<void> {
    try {
      await supabase.from('api_usage').insert({
        endpoint,
        client_id: clientId,
        metadata,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't block on logging errors

    }
  }
  
  /**
   * Apply rate limit middleware
   */
  async middleware(
    req: any,
    res: any,
    next: () => void
  ): Promise<void> {
    const clientId = this.getClientId(req);
    const endpoint = req.path || req.url;
    
    const status = await this.checkLimit(endpoint, clientId, {
      metadata: {
        method: req.method,
        userAgent: req.headers['user-agent']
      }
    });
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', status.remaining + 1);
    res.setHeader('X-RateLimit-Remaining', status.remaining);
    res.setHeader('X-RateLimit-Reset', status.resetAt.toISOString());
    
    if (!status.allowed) {
      res.setHeader('Retry-After', status.retryAfter || 60);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: status.retryAfter,
        resetAt: status.resetAt
      });
      return;
    }
    
    next();
  }
  
  /**
   * Get client identifier from request
   */
  private getClientId(req: any): string {
    // Try to get authenticated user ID
    if (req.user?.id) {
      return `user:${req.user.id}`;
    }
    
    // Try to get API key
    if (req.headers['x-api-key']) {
      return `api:${req.headers['x-api-key']}`;
    }
    
    // Fall back to IP address
    const ip = req.headers['x-forwarded-for'] || 
               req.connection?.remoteAddress || 
               req.ip ||
               'unknown';
    
    return `ip:${ip}`;
  }
  
  /**
   * Update rate limit for endpoint
   */
  updateLimit(endpoint: string, config: Partial<RateLimitConfig>): void {
    const existing = this.limits.get(endpoint) || { 
      endpoint, 
      maxRequests: 20, 
      windowMs: 60000 
    };
    
    this.limits.set(endpoint, { ...existing, ...config });

  }
  
  /**
   * Get current rate limit statistics
   */
  getStatistics(): {
    totalClients: number;
    blockedClients: number;
    endpoints: Array<{
      endpoint: string;
      config: RateLimitConfig;
      currentLoad: number;
    }>;
  } {
    const endpointStats = Array.from(this.limits.entries()).map(([endpoint, config]) => {
      // Calculate current load
      let currentLoad = 0;
      this.clients.forEach(metrics => {
        if (Date.now() - metrics.lastRequest < config.windowMs) {
          currentLoad += metrics.requests;
        }
      });
      
      return {
        endpoint,
        config,
        currentLoad
      };
    });
    
    return {
      totalClients: this.clients.size,
      blockedClients: this.blockedIPs.size,
      endpoints: endpointStats
    };
  }
  
  /**
   * Clean up old client data
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 3600000; // 1 hour
      
      // Clean up stale client metrics
      for (const [clientId, metrics] of this.clients.entries()) {
        if (now - metrics.lastRequest > staleThreshold && !metrics.blocked) {
          this.clients.delete(clientId);
        }
      }
      
      // Clean up expired blocks
      for (const [clientId, metrics] of this.clients.entries()) {
        if (metrics.blocked && metrics.blockExpiry && now > metrics.blockExpiry) {
          this.blockedIPs.delete(clientId);
          metrics.blocked = false;
          metrics.violations = 0;
        }
      }

    }, 300000); // Every 5 minutes
  }
  
  /**
   * Reset all rate limits (for testing)
   */
  reset(): void {
    this.clients.clear();
    this.blockedIPs.clear();

  }
}

// Export singleton instance
export const rateLimiter = new RateLimitingService();