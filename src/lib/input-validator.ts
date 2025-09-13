import { z, ZodError, ZodSchema } from 'zod';
import { ValidationError } from './error-handler';

// Helper function for HTML sanitization (simplified version without external dependency)
function sanitizeHtml(input: string, allowedTags: string[] = []): string {
  // Remove all HTML tags if no tags are allowed
  if (allowedTags.length === 0) {
    return input.replace(/<[^>]*>/g, '');
  }
  
  // Basic sanitization - remove script tags and event handlers
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
  
  return sanitized;
}

// Common validation schemas
export const EmailSchema = z.string().email().toLowerCase().trim();

export const UrlSchema = z.string().url().refine(
  (url) => {
    try {
      const u = new URL(url);
      return ['http:', 'https:'].includes(u.protocol);
    } catch {
      return false;
    }
  },
  { message: 'Invalid URL format' }
);

export const SafeStringSchema = z.string().transform((val) => {
  return sanitizeHtml(val);
});

export const ContentTypeSchema = z.enum(['resource', 'project', 'funding', 'tool', 'article', 'blockchain', 'analytics', 'social']);

export const TagSchema = z.array(
  z.string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Tags must be alphanumeric with hyphens or underscores')
).max(20);

export const DateSchema = z.string().refine(
  (date) => {
    const d = new Date(date);
    return !isNaN(d.getTime()) && d > new Date('2020-01-01') && d < new Date('2030-01-01');
  },
  { message: 'Invalid date or date out of reasonable range' }
);

export const AmountSchema = z.number()
  .min(0)
  .max(1000000000)
  .refine((val) => Number.isFinite(val), { message: 'Amount must be a valid number' });

// Content validation schemas
export const BaseContentSchema = z.object({
  url: UrlSchema,
  title: z.string().transform(val => sanitizeHtml(val)).pipe(z.string().min(3).max(200)),
  description: z.string().transform(val => sanitizeHtml(val)).pipe(z.string().min(10).max(5000)),
  content_type: ContentTypeSchema,
  tags: TagSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export const ResourceContentSchema = BaseContentSchema.extend({
  content_type: z.literal('resource'),
  resource_source: SafeStringSchema,
  resource_category: SafeStringSchema.optional(),
  author: z.string().transform(val => sanitizeHtml(val)).pipe(z.string().max(100)).optional(),
});

export const ProjectContentSchema = BaseContentSchema.extend({
  content_type: z.literal('project'),
  project_source: SafeStringSchema,
  project_category: SafeStringSchema.optional(),
  github_url: UrlSchema.optional(),
  website_url: UrlSchema.optional(),
  team_size: z.number().min(1).max(10000).optional(),
});

export const FundingContentSchema = BaseContentSchema.extend({
  content_type: z.literal('funding'),
  funding_source: SafeStringSchema,
  funding_category: SafeStringSchema.optional(),
  funding_amount_min: AmountSchema.optional(),
  funding_amount_max: AmountSchema.optional(),
  deadline: DateSchema.optional(),
  organization: z.string().transform(val => sanitizeHtml(val)).pipe(z.string().max(200)),
  application_url: UrlSchema.optional(),
  eligibility_criteria: z.array(SafeStringSchema).max(20).optional(),
});

// API request schemas
export const PaginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const SortSchema = z.object({
  field: z.string(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const FilterSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'duplicate']).optional(),
  content_type: ContentTypeSchema.optional(),
  date_from: DateSchema.optional(),
  date_to: DateSchema.optional(),
  ai_score_min: z.coerce.number().min(0).max(1).optional(),
  ai_score_max: z.coerce.number().min(0).max(1).optional(),
  search: SafeStringSchema.optional(),
});

// Webhook schemas
export const WebhookEventSchema = z.enum([
  'content.created',
  'content.updated',
  'content.approved',
  'content.rejected',
  'fetch.completed',
  'fetch.failed',
  'ai.scoring.completed',
  'threshold.reached',
]);

export const WebhookConfigSchema = z.object({
  url: UrlSchema,
  events: z.array(WebhookEventSchema).min(1).max(10),
  secret: z.string().min(16).optional(),
  headers: z.record(z.string()).optional(),
});

// Input validation class
export class InputValidator {
  static validate<T>(schema: ZodSchema<T>, data: unknown): T {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError(
          `Validation failed: ${details.map(d => `${d.field}: ${d.message}`).join(', ')}`
        );
      }
      throw error;
    }
  }

  static validateWithDefaults<T>(schema: ZodSchema<T>, data: unknown, defaults: Partial<T>): T {
    const merged = { ...defaults, ...(data as any) };
    return this.validate(schema, merged);
  }

  static safeParse<T>(schema: ZodSchema<T>, data: unknown): { success: boolean; data?: T; error?: string } {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        return { 
          success: false, 
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        };
      }
      return { success: false, error: 'Unknown validation error' };
    }
  }

  static sanitizeHtml(html: string, allowedTags?: string[]): string {
    return sanitizeHtml(html, allowedTags);
  }

  static sanitizeText(text: string): string {
    return sanitizeHtml(text, []);
  }

  static validateUrl(url: string): string {
    const validated = UrlSchema.parse(url);
    const u = new URL(validated);
    
    // Remove tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'ref'];
    trackingParams.forEach(param => u.searchParams.delete(param));
    
    return u.toString();
  }

  static validateEmail(email: string): string {
    const validated = EmailSchema.parse(email);
    
    // Check for common typos
    const domain = validated.split('@')[1];
    const typos: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
      'outlok.com': 'outlook.com',
      'hotmial.com': 'hotmail.com',
    };
    
    if (typos[domain]) {

    }
    
    return validated;
  }

  static validateArray<T>(
    items: unknown[],
    itemSchema: ZodSchema<T>,
    maxItems = 100
  ): T[] {
    if (!Array.isArray(items)) {
      throw new ValidationError('Input must be an array');
    }
    
    if (items.length > maxItems) {
      throw new ValidationError(`Array exceeds maximum of ${maxItems} items`);
    }
    
    return items.map((item, index) => {
      try {
        return itemSchema.parse(item);
      } catch (error) {
        throw new ValidationError(`Invalid item at index ${index}: ${error}`);
      }
    });
  }

  static validateJson(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch {
      throw new ValidationError('Invalid JSON format');
    }
  }

  static checkSqlInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
      /(\b(UNION|JOIN|WHERE|HAVING|GROUP BY|ORDER BY)\b.*\b(SELECT|FROM)\b)/gi,
      /(--|\||;|\/\*|\*\/|xp_|sp_|0x)/gi,
      /(\bOR\b\s*\d+\s*=\s*\d+)/gi,
      /(\bAND\b\s*\d+\s*=\s*\d+)/gi,
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  static checkXss(input: string): boolean {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*onerror/gi,
      /<svg[^>]*onload/gi,
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  static validateFileUpload(file: {
    name: string;
    size: number;
    type: string;
  }, options: {
    maxSize?: number;
    allowedTypes?: string[];
    allowedExtensions?: string[];
  } = {}): void {
    const { 
      maxSize = 10 * 1024 * 1024,
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf']
    } = options;
    
    if (file.size > maxSize) {
      throw new ValidationError(`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`);
    }
    
    if (!allowedTypes.includes(file.type)) {
      throw new ValidationError(`File type ${file.type} not allowed`);
    }
    
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      throw new ValidationError(`File extension ${extension} not allowed`);
    }
    
    const doubleExtensionPattern = /\.(php|exe|sh|bat|cmd|com|cgi|jar|app|deb|rpm)\./i;
    if (doubleExtensionPattern.test(file.name)) {
      throw new ValidationError('Suspicious file name detected');
    }
  }

  static createValidator<T>(schema: ZodSchema<T>) {
    return (data: unknown): T => {
      return this.validate(schema, data);
    };
  }
}

// Export commonly used validators
export const validateContent = (data: unknown) => {
  const baseValidation = BaseContentSchema.safeParse(data);
  if (!baseValidation.success) {
    throw new ValidationError('Invalid content data');
  }

  switch (baseValidation.data.content_type) {
    case 'resource':
      return InputValidator.validate(ResourceContentSchema, data);
    case 'project':
      return InputValidator.validate(ProjectContentSchema, data);
    case 'funding':
      return InputValidator.validate(FundingContentSchema, data);
    default:
      throw new ValidationError('Unknown content type');
  }
};

export const validatePagination = InputValidator.createValidator(PaginationSchema);
export const validateFilter = InputValidator.createValidator(FilterSchema);
export const validateWebhookConfig = InputValidator.createValidator(WebhookConfigSchema);