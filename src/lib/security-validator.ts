/**
 * Security and validation layer for all inputs
 */
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Input validation schemas
const ContentSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(10000).optional(),
  url: z.string().url().optional(),
  source: z.string().min(1).max(100),
  metadata: z.record(z.any()).optional()
});

const ConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  GITHUB_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MAX_CONCURRENT_FETCHERS: z.number().min(1).max(10).default(3),
  BATCH_SIZE: z.number().min(1).max(100).default(50),
  MIN_SCORE_THRESHOLD: z.number().min(0).max(100).default(30)
});

export class SecurityValidator {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
      ALLOWED_ATTR: ['href', 'target']
    });
  }

  /**
   * Validate and sanitize content
   */
  static validateContent(content: any): z.infer<typeof ContentSchema> {
    // Parse and validate
    const validated = ContentSchema.parse(content);
    
    // Sanitize string fields
    return {
      ...validated,
      title: this.sanitizeHtml(validated.title),
      description: validated.description ? this.sanitizeHtml(validated.description) : undefined
    };
  }

  /**
   * Validate environment configuration
   */
  static validateConfig(env: NodeJS.ProcessEnv): z.infer<typeof ConfigSchema> {
    try {
      return ConfigSchema.parse({
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
        GITHUB_TOKEN: env.GITHUB_TOKEN,
        OPENAI_API_KEY: env.OPENAI_API_KEY,
        MAX_CONCURRENT_FETCHERS: env.MAX_CONCURRENT_FETCHERS ? parseInt(env.MAX_CONCURRENT_FETCHERS) : undefined,
        BATCH_SIZE: env.BATCH_SIZE ? parseInt(env.BATCH_SIZE) : undefined,
        MIN_SCORE_THRESHOLD: env.MIN_SCORE_THRESHOLD ? parseInt(env.MIN_SCORE_THRESHOLD) : undefined
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Configuration validation failed: ${error.errors.map(e => `${e.path}: ${e.message}`).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate URL to prevent SSRF attacks
   */
  static validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Block local/internal addresses
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      if (blockedHosts.includes(parsed.hostname)) {
        return false;
      }
      
      // Only allow HTTP(S)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return false;
      }
      
      // Block private IP ranges
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(parsed.hostname)) {
        const octets = parsed.hostname.split('.').map(Number);
        // Check for private IP ranges
        if (
          octets[0] === 10 || // 10.0.0.0/8
          (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || // 172.16.0.0/12
          (octets[0] === 192 && octets[1] === 168) // 192.168.0.0/16
        ) {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rate limit check
   */
  private static rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  static checkRateLimit(key: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(key);
    
    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return true;
    }
    
    if (limit.count >= maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }

  /**
   * Validate API response
   */
  static validateApiResponse(response: any, expectedShape?: z.ZodSchema): any {
    // Remove any potential script tags
    const cleaned = JSON.parse(JSON.stringify(response, (key, value) => {
      if (typeof value === 'string') {
        return this.sanitizeHtml(value);
      }
      return value;
    }));
    
    // Validate against schema if provided
    if (expectedShape) {
      return expectedShape.parse(cleaned);
    }
    
    return cleaned;
  }

  /**
   * Create safe database query parameters
   */
  static sanitizeDbParams(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Remove SQL injection attempts
        sanitized[key] = value
          .replace(/'/g, "''") // Escape single quotes
          .replace(/;/g, '') // Remove semicolons
          .replace(/--/g, '') // Remove SQL comments
          .replace(/\/\*/g, '') // Remove multi-line comments
          .replace(/\*\//g, '');
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}