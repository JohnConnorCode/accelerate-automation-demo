import { VercelRequest, VercelResponse } from '@vercel/node';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 100, windowMs = 15 * 60 * 1000) { // 100 requests per 15 minutes
    this.maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || String(maxRequests));
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(windowMs));
    
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private getKey(req: VercelRequest): string {
    // Use IP address as key, fallback to a default for local testing
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
      ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0])
      : req.socket?.remoteAddress || 'unknown';
    
    return ip;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  async checkLimit(req: VercelRequest): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.getKey(req);
    const now = Date.now();

    if (!this.store[key] || this.store[key].resetTime < now) {
      // New window
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: this.store[key].resetTime,
      };
    }

    // Existing window
    const entry = this.store[key];
    
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  middleware() {
    return async (req: VercelRequest, res: VercelResponse, next: () => void) => {
      // Skip rate limiting for internal cron jobs
      if (req.headers.authorization?.startsWith('Bearer ') && 
          req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`) {
        return next();
      }

      const result = await this.checkLimit(req);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.resetTime,
        });
      }

      next();
    };
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export middleware function for use in API routes
export function withRateLimit(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // Skip rate limiting in development
    if (process.env.NODE_ENV === 'development') {
      return handler(req, res);
    }

    // Skip if rate limiting is disabled
    if (process.env.ENABLE_RATE_LIMITING === 'false') {
      return handler(req, res);
    }

    // Check rate limit
    const result = await rateLimiter.checkLimit(req);

    // Set headers
    res.setHeader('X-RateLimit-Limit', rateLimiter['maxRequests']);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.resetTime,
      });
    }

    // Continue with handler
    return handler(req, res);
  };
}

// Advanced rate limiting with different tiers
export class TieredRateLimiter {
  private tiers: Map<string, RateLimiter> = new Map();

  constructor() {
    // Different rate limits for different endpoints
    this.tiers.set('default', new RateLimiter(100, 15 * 60 * 1000)); // 100/15min
    this.tiers.set('search', new RateLimiter(30, 60 * 1000)); // 30/min
    this.tiers.set('export', new RateLimiter(10, 60 * 60 * 1000)); // 10/hour
    this.tiers.set('admin', new RateLimiter(1000, 15 * 60 * 1000)); // 1000/15min
  }

  getTier(endpoint: string): RateLimiter {
    // Determine tier based on endpoint
    if (endpoint.includes('/admin/')) return this.tiers.get('admin')!;
    if (endpoint.includes('/export/')) return this.tiers.get('export')!;
    if (endpoint.includes('/search')) return this.tiers.get('search')!;
    return this.tiers.get('default')!;
  }

  middleware(tier?: string) {
    return async (req: VercelRequest, res: VercelResponse, next: () => void) => {
      const limiter = tier 
        ? this.tiers.get(tier) || this.tiers.get('default')!
        : this.getTier(req.url || '');
      
      const result = await limiter.checkLimit(req);

      res.setHeader('X-RateLimit-Tier', tier || 'auto');
      res.setHeader('X-RateLimit-Limit', limiter['maxRequests']);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (!result.allowed) {
        res.setHeader('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000));
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          tier: tier || 'auto',
          retryAfter: result.resetTime,
        });
      }

      next();
    };
  }
}

export const tieredRateLimiter = new TieredRateLimiter();