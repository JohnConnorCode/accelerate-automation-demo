import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { supabase } from '../lib/supabase-client';

/**
 * Comprehensive Data Validation and Sanitization Service
 * Ensures all data entering the system is clean, valid, and safe
 */

// Project validation schema
const ProjectSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters')
    .transform(val => val.trim()),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be less than 5000 characters')
    .transform(val => val.trim()),
  
  team_size: z.number()
    .int('Team size must be a whole number')
    .min(1, 'Team size must be at least 1')
    .max(100, 'Team size must be less than 100')
    .optional(),
  
  funding_amount: z.number()
    .min(0, 'Funding amount must be positive')
    .max(10000000, 'Funding amount seems unrealistic')
    .optional(),
  
  launch_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  
  website: z.string()
    .url('Must be a valid URL')
    .optional()
    .nullable(),
  
  github_url: z.string()
    .url('Must be a valid URL')
    .regex(/github\.com/, 'Must be a GitHub URL')
    .optional()
    .nullable(),
  
  twitter_handle: z.string()
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, 'Invalid Twitter handle')
    .transform(val => val.startsWith('@') ? val : `@${val}`)
    .optional()
    .nullable(),
  
  categories: z.array(z.string())
    .max(10, 'Maximum 10 categories allowed')
    .optional(),
  
  tags: z.array(z.string())
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  
  source: z.string()
    .min(1, 'Source is required'),
  
  external_id: z.string()
    .optional()
});

// Funding opportunity validation schema
const FundingSchema = z.object({
  name: z.string()
    .min(3, 'Name must be at least 3 characters')
    .max(200, 'Name must be less than 200 characters')
    .transform(val => val.trim()),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(10000, 'Description must be less than 10000 characters')
    .transform(val => val.trim()),
  
  amount_min: z.number()
    .min(0, 'Minimum amount must be positive')
    .optional(),
  
  amount_max: z.number()
    .min(0, 'Maximum amount must be positive')
    .optional(),
  
  deadline: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  
  requirements: z.array(z.string())
    .max(50, 'Maximum 50 requirements allowed')
    .optional(),
  
  website: z.string()
    .url('Must be a valid URL')
    .optional(),
  
  source: z.string()
    .min(1, 'Source is required')
});

// Resource validation schema
const ResourceSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be less than 200 characters')
    .transform(val => val.trim()),
  
  content: z.string()
    .min(10, 'Content must be at least 10 characters')
    .max(50000, 'Content must be less than 50000 characters')
    .transform(val => val.trim()),
  
  type: z.enum(['article', 'video', 'tool', 'course', 'documentation', 'other']),
  
  url: z.string()
    .url('Must be a valid URL')
    .optional(),
  
  author: z.string()
    .max(100, 'Author name too long')
    .optional(),
  
  published_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  
  tags: z.array(z.string())
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
  
  source: z.string()
    .min(1, 'Source is required')
});

interface ValidationResult {
  valid: boolean;
  errors?: string[];
  sanitized?: any;
  warnings?: string[];
}

interface SanitizationOptions {
  removeScripts: boolean;
  removeStyles: boolean;
  allowedTags?: string[];
  maxLength?: number;
  truncate?: boolean;
}

export class DataValidationService {
  private readonly defaultSanitizationOptions: SanitizationOptions = {
    removeScripts: true,
    removeStyles: true,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 'a', 'ul', 'ol', 'li'],
    maxLength: 50000,
    truncate: true
  };

  private suspiciousPatterns = [
    /\bscript\b/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,  // onclick, onload, etc.
    /<iframe/gi,
    /<embed/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /file:\/\//gi,
    /\.\.\//g,  // Path traversal
    /DROP\s+TABLE/gi,  // SQL injection
    /DELETE\s+FROM/gi,
    /INSERT\s+INTO/gi,
    /UPDATE\s+SET/gi,
    /UNION\s+SELECT/gi
  ];

  private profanityList = [
    // Add profanity terms to filter
    // Keeping this empty for now, but can be populated as needed
  ];

  /**
   * Validate project data
   */
  async validateProject(data: any): Promise<ValidationResult> {
    try {
      // Sanitize strings first
      const sanitized = await this.sanitizeObject(data);
      
      // Validate against schema
      const parsed = ProjectSchema.parse(sanitized);
      
      // Additional business logic validation
      const warnings: string[] = [];
      
      // Check for suspicious patterns
      const suspicious = this.detectSuspiciousContent(JSON.stringify(parsed));
      if (suspicious.length > 0) {
        warnings.push(...suspicious);
      }
      
      // Check funding amount reasonableness
      if (parsed.funding_amount && parsed.funding_amount > 5000000) {
        warnings.push('Funding amount seems unusually high');
      }
      
      // Check team size reasonableness
      if (parsed.team_size && parsed.team_size === 1 && parsed.funding_amount && parsed.funding_amount > 1000000) {
        warnings.push('Large funding for single-person team is unusual');
      }
      
      // Check date validity
      if (parsed.launch_date) {
        const launchDate = new Date(parsed.launch_date);
        const now = new Date();
        if (launchDate > now) {
          warnings.push('Launch date is in the future');
        }
        if (launchDate < new Date('2020-01-01')) {
          warnings.push('Launch date seems too old for current criteria');
        }
      }
      
      return {
        valid: true,
        sanitized: parsed,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: ['Unknown validation error']
      };
    }
  }

  /**
   * Validate funding opportunity data
   */
  async validateFunding(data: any): Promise<ValidationResult> {
    try {
      const sanitized = await this.sanitizeObject(data);
      const parsed = FundingSchema.parse(sanitized);
      
      const warnings: string[] = [];
      
      // Check amount consistency
      if (parsed.amount_min && parsed.amount_max && parsed.amount_min > parsed.amount_max) {
        return {
          valid: false,
          errors: ['Minimum amount cannot be greater than maximum amount']
        };
      }
      
      // Check deadline validity
      if (parsed.deadline) {
        const deadline = new Date(parsed.deadline);
        const now = new Date();
        if (deadline < now) {
          warnings.push('Deadline has already passed');
        }
        if (deadline > new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          warnings.push('Deadline is more than a year away');
        }
      }
      
      // Check for suspicious content
      const suspicious = this.detectSuspiciousContent(JSON.stringify(parsed));
      if (suspicious.length > 0) {
        warnings.push(...suspicious);
      }
      
      return {
        valid: true,
        sanitized: parsed,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: ['Unknown validation error']
      };
    }
  }

  /**
   * Validate resource data
   */
  async validateResource(data: any): Promise<ValidationResult> {
    try {
      const sanitized = await this.sanitizeObject(data);
      const parsed = ResourceSchema.parse(sanitized);
      
      const warnings: string[] = [];
      
      // Check published date validity
      if (parsed.published_date) {
        const publishedDate = new Date(parsed.published_date);
        const now = new Date();
        if (publishedDate > now) {
          warnings.push('Published date is in the future');
        }
      }
      
      // Check for suspicious content
      const suspicious = this.detectSuspiciousContent(JSON.stringify(parsed));
      if (suspicious.length > 0) {
        warnings.push(...suspicious);
      }
      
      // Check content quality
      if (parsed.content.length < 100) {
        warnings.push('Content seems too short to be valuable');
      }
      
      return {
        valid: true,
        sanitized: parsed,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: ['Unknown validation error']
      };
    }
  }

  /**
   * Sanitize an object recursively
   */
  private async sanitizeObject(obj: any, options?: SanitizationOptions): Promise<any> {
    const opts = { ...this.defaultSanitizationOptions, ...options };
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj, opts);
    }
    
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this.sanitizeObject(item, opts)));
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key as well
        const sanitizedKey = this.sanitizeString(key, { ...opts, maxLength: 100 });
        sanitized[sanitizedKey] = await this.sanitizeObject(value, opts);
      }
      return sanitized;
    }
    
    return obj;
  }

  /**
   * Sanitize a string value
   */
  private sanitizeString(str: string, options: SanitizationOptions): string {
    if (!str || typeof str !== 'string') return str;
    
    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Remove HTML if needed
    if (options.removeScripts || options.removeStyles) {
      sanitized = DOMPurify.sanitize(sanitized, {
        ALLOWED_TAGS: options.allowedTags || [],
        FORBID_TAGS: options.removeScripts ? ['script'] : [],
        FORBID_ATTR: options.removeStyles ? ['style'] : []
      });
    }
    
    // Truncate if needed
    if (options.maxLength && sanitized.length > options.maxLength) {
      if (options.truncate) {
        sanitized = sanitized.substring(0, options.maxLength - 3) + '...';
      } else {
        throw new Error(`String exceeds maximum length of ${options.maxLength}`);
      }
    }
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    return sanitized;
  }

  /**
   * Detect suspicious content patterns
   */
  private detectSuspiciousContent(content: string): string[] {
    const warnings: string[] = [];
    
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }
    
    // Check for profanity
    const lowerContent = content.toLowerCase();
    for (const word of this.profanityList) {
      if (lowerContent.includes(word)) {
        warnings.push('Inappropriate content detected');
        break;
      }
    }
    
    // Check for excessive capitalization (spam indicator)
    const upperRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (upperRatio > 0.5 && content.length > 20) {
      warnings.push('Excessive capitalization detected');
    }
    
    // Check for repeated characters (spam indicator)
    if (/(.)\1{5,}/g.test(content)) {
      warnings.push('Repeated characters detected');
    }
    
    // Check for suspicious URLs
    const urlPattern = /https?:\/\/[^\s]+/g;
    const urls = content.match(urlPattern) || [];
    for (const url of urls) {
      if (this.isSuspiciousUrl(url)) {
        warnings.push(`Suspicious URL detected: ${url}`);
      }
    }
    
    return warnings;
  }

  /**
   * Check if URL is suspicious
   */
  private isSuspiciousUrl(url: string): boolean {
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly', 'short.link',
      't.co', 'buff.ly', 'is.gd', 'soo.gd'
    ];
    
    const suspicious = suspiciousDomains.some(domain => url.includes(domain));
    
    // Check for IP addresses instead of domains
    const ipPattern = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
    if (ipPattern.test(url)) {
      return true;
    }
    
    // Check for unusual ports
    const portPattern = /:\d{4,}/;
    if (portPattern.test(url) && !url.includes(':3000') && !url.includes(':8080')) {
      return true;
    }
    
    return suspicious;
  }

  /**
   * Validate email address
   */
  validateEmail(email: string): ValidationResult {
    const emailSchema = z.string().email('Invalid email address');
    
    try {
      const sanitized = this.sanitizeString(email, {
        ...this.defaultSanitizationOptions,
        maxLength: 255
      });
      
      emailSchema.parse(sanitized);
      
      // Additional checks
      const warnings: string[] = [];
      
      // Check for disposable email domains
      const disposableDomains = ['tempmail.com', 'throwaway.email', 'guerrillamail.com'];
      const domain = sanitized.split('@')[1];
      if (disposableDomains.includes(domain)) {
        warnings.push('Disposable email address detected');
      }
      
      return {
        valid: true,
        sanitized,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Invalid email address']
      };
    }
  }

  /**
   * Validate URL
   */
  validateUrl(url: string): ValidationResult {
    const urlSchema = z.string().url('Invalid URL');
    
    try {
      const sanitized = this.sanitizeString(url, {
        ...this.defaultSanitizationOptions,
        maxLength: 2048
      });
      
      urlSchema.parse(sanitized);
      
      const warnings: string[] = [];
      
      if (this.isSuspiciousUrl(sanitized)) {
        warnings.push('URL appears suspicious');
      }
      
      return {
        valid: true,
        sanitized,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        errors: ['Invalid URL']
      };
    }
  }

  /**
   * Validate and sanitize batch data
   */
  async validateBatch(
    items: any[],
    type: 'project' | 'funding' | 'resource'
  ): Promise<{
    valid: any[];
    invalid: Array<{ item: any; errors: string[] }>;
    warnings: Array<{ item: any; warnings: string[] }>;
  }> {
    const valid: any[] = [];
    const invalid: Array<{ item: any; errors: string[] }> = [];
    const warnings: Array<{ item: any; warnings: string[] }> = [];
    
    for (const item of items) {
      let result: ValidationResult;
      
      switch (type) {
        case 'project':
          result = await this.validateProject(item);
          break;
        case 'funding':
          result = await this.validateFunding(item);
          break;
        case 'resource':
          result = await this.validateResource(item);
          break;
        default:
          result = { valid: false, errors: ['Unknown type'] };
      }
      
      if (result.valid) {
        valid.push(result.sanitized);
        if (result.warnings && result.warnings.length > 0) {
          warnings.push({ item: result.sanitized, warnings: result.warnings });
        }
      } else {
        invalid.push({ item, errors: result.errors || [] });
      }
    }
    
    // Log validation statistics
    await this.logValidationStats(type, valid.length, invalid.length, warnings.length);
    
    return { valid, invalid, warnings };
  }

  /**
   * Log validation statistics
   */
  private async logValidationStats(
    type: string,
    validCount: number,
    invalidCount: number,
    warningCount: number
  ): Promise<void> {
    try {
      await supabase.from('validation_stats').insert({
        type,
        valid_count: validCount,
        invalid_count: invalidCount,
        warning_count: warningCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {

    }
  }

  /**
   * Clean and normalize data
   */
  normalizeData(data: any): any {
    if (typeof data === 'string') {
      // Normalize unicode
      return data.normalize('NFC');
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item));
    }
    
    if (data && typeof data === 'object') {
      const normalized: any = {};
      for (const [key, value] of Object.entries(data)) {
        normalized[key] = this.normalizeData(value);
      }
      return normalized;
    }
    
    return data;
  }
}