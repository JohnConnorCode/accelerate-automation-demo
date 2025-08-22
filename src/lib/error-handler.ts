import { VercelRequest, VercelResponse } from '@vercel/node';
import { ZodError } from 'zod';
import { supabase } from './supabase';
import { monitoringService } from './monitoring-service';

export interface ErrorContext {
  request?: VercelRequest;
  user?: any;
  service?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    context?: ErrorContext
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, context?: ErrorContext) {
    super(message, 400, true, context);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', context?: ErrorContext) {
    super(message, 401, true, context);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', context?: ErrorContext) {
    super(message, 403, true, context);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', context?: ErrorContext) {
    super(message, 404, true, context);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', context?: ErrorContext) {
    super(message, 409, true, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', context?: ErrorContext) {
    super(message, 429, true, context);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, context?: ErrorContext) {
    super(`External service error (${service}): ${message}`, 503, true, context);
  }
}

class ErrorHandler {
  private isDevelopment = process.env.NODE_ENV === 'development';

  async handleError(error: Error | AppError, context?: ErrorContext): Promise<void> {
    // Log error
    await this.logError(error, context);

    // Send alerts for critical errors
    if (!this.isOperational(error)) {
      await this.sendAlert(error, context);
    }

    // Track error metrics
    this.trackErrorMetrics(error, context);
  }

  private isOperational(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }
    return false;
  }

  private async logError(error: Error | AppError, context?: ErrorContext): Promise<void> {
    const errorInfo = this.formatError(error, context);

    try {
      await supabase
        .from('error_logs')
        .insert({
          message: error.message,
          stack: error.stack,
          status_code: error instanceof AppError ? error.statusCode : 500,
          context,
          timestamp: new Date().toISOString(),
        });
    } catch (logError) {

    }
  }

  private formatError(error: Error | AppError, context?: ErrorContext): any {
    const formatted: any = {
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof AppError) {
      formatted.statusCode = error.statusCode;
      formatted.isOperational = error.isOperational;
    }

    if (context) {
      formatted.context = {
        service: context.service,
        operation: context.operation,
        metadata: context.metadata,
      };

      if (context.request) {
        formatted.context.request = {
          method: context.request.method,
          url: context.request.url,
          headers: this.sanitizeHeaders(context.request.headers),
        };
      }
    }

    if (this.isDevelopment && error.stack) {
      formatted.stack = error.stack;
    }

    return formatted;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private async sendAlert(error: Error | AppError, context?: ErrorContext): Promise<void> {
    const message = `Critical Error: ${error.message}\n\nContext: ${JSON.stringify(context, null, 2)}`;
    
    // Use monitoring service to send alerts
    // This would integrate with your notification system

  }

  private trackErrorMetrics(error: Error | AppError, context?: ErrorContext): void {
    // Track error metrics for monitoring
    const labels = {
      service: context?.service || 'unknown',
      operation: context?.operation || 'unknown',
      statusCode: error instanceof AppError ? String(error.statusCode) : '500',
    };

    // This would integrate with your metrics system

  }

  public createErrorResponse(error: Error | AppError, req?: VercelRequest): any {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    
    const response: any = {
      error: true,
      message: error.message,
      statusCode,
    };

    // Add request ID for tracking
    if (req) {
      response.requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    }

    // Add validation details for Zod errors
    if (error instanceof ZodError) {
      response.statusCode = 400;
      response.message = 'Validation failed';
      response.details = error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
    }

    // Add debug info in development
    if (this.isDevelopment) {
      response.stack = error.stack;
      if (error instanceof AppError && error.context) {
        response.context = error.context;
      }
    }

    return response;
  }
}

export const errorHandler = new ErrorHandler();

// Express-style error middleware
export function errorMiddleware(
  handler: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res);
    } catch (error: any) {
      const context: ErrorContext = {
        request: req,
        service: 'api',
        operation: req.url,
      };

      await errorHandler.handleError(error, context);
      
      const response = errorHandler.createErrorResponse(error, req);
      res.status(response.statusCode).json(response);
    }
  };
}

// Async error wrapper
export function asyncHandler(
  fn: (req: VercelRequest, res: VercelResponse) => Promise<any>
) {
  return (req: VercelRequest, res: VercelResponse) => {
    Promise.resolve(fn(req, res)).catch(error => {
      errorMiddleware(async () => {
        throw error;
      })(req, res);
    });
  };
}

// Global error handlers
process.on('uncaughtException', (error: Error) => {

  errorHandler.handleError(error, { service: 'process', operation: 'uncaughtException' });
  // Give time to log the error before shutting down
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {

  errorHandler.handleError(
    new Error(`Unhandled Rejection: ${reason}`),
    { service: 'process', operation: 'unhandledRejection' }
  );
});