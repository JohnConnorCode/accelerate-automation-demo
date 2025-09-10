/**
 * Input validation middleware to prevent crashes
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Schema for manual fetch request
const ManualFetchSchema = z.object({
  sources: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(1000).optional()
});

// Schema for approval request
const ApprovalSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  feedback: z.string().optional()
});

// Schema for API key configuration
const ApiKeySchema = z.object({
  apiKeyType: z.string(),
  apiKey: z.string().min(1)
});

// Generic validation middleware factory
export function validateRequest(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate request body
      const validated = await schema.parseAsync(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      
      return res.status(500).json({
        error: 'Internal validation error'
      });
    }
  };
}

// Specific validators
export const validateManualFetch = validateRequest(ManualFetchSchema);
export const validateApproval = validateRequest(ApprovalSchema);
export const validateApiKey = validateRequest(ApiKeySchema);

// Query parameter validation
export function validateQueryParams(schema: z.ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req.query);
      req.query = validated as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        });
      }
      
      return res.status(500).json({
        error: 'Query validation error'
      });
    }
  };
}

// Sanitize user input to prevent injection
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove potential SQL injection attempts
    return input
      .replace(/[';\\]/g, '')
      .replace(/--/g, '')
      .trim()
      .slice(0, 10000); // Limit string length
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(input)) {
      // Skip suspicious keys
      if (!key.match(/^[a-zA-Z0-9_-]+$/)) continue;
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return input;
}

// Rate limiting helper
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    const record = requestCounts.get(key);
    
    if (!record || record.resetTime < now) {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    
    record.count++;
    next();
  };
}

// Error boundary middleware
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack })
  });
}
