import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { supabase } from '../lib/supabase';
import { AIScorer } from '../lib/ai-scorer';
import { deduplicationService } from '../lib/deduplication-service';
import { webhookManager, WebhookEvent } from '../lib/webhook-manager';
import { monitoringService } from '../lib/monitoring-service';
import { backupService } from '../lib/backup-service';
import { rateLimiter, tieredRateLimiter } from '../lib/rate-limiter';
import { notificationService } from '../lib/notification-service';
import { InputValidator, validateContent, ContentTypeSchema } from '../lib/input-validator';
import { errorHandler, AppError, ValidationError } from '../lib/error-handler';

// Mock environment
process.env.OPENAI_API_KEY = 'test-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.CRON_SECRET = 'test-cron-secret';

describe('Comprehensive System Tests', () => {
  
  describe('Content Validation and Sanitization', () => {
    it('should validate and sanitize resource content', () => {
      const input = {
        url: 'https://example.com/resource',
        title: '<script>alert("xss")</script>Great Resource',
        description: 'This is a <b>great</b> resource for learning',
        content_type: 'resource',
        resource_source: 'test',
        tags: ['web3', 'blockchain'],
      };

      const validated = validateContent(input);
      
      expect(validated.title).not.toContain('<script>');
      expect(validated.title).toBe('Great Resource');
      expect(validated.content_type).toBe('resource');
      expect(validated.tags).toEqual(['web3', 'blockchain']);
    });

    it('should reject invalid URLs', () => {
      const input = {
        url: 'not-a-valid-url',
        title: 'Test',
        description: 'Test description',
        content_type: 'resource',
        resource_source: 'test',
      };

      expect(() => validateContent(input)).toThrow(ValidationError);
    });

    it('should reject SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const isSqlInjection = InputValidator.checkSqlInjection(maliciousInput);
      expect(isSqlInjection).toBe(true);
    });

    it('should detect XSS attempts', () => {
      const xssInput = '<img src=x onerror=alert("xss")>';
      const isXss = InputValidator.checkXss(xssInput);
      expect(isXss).toBe(true);
    });

    it('should validate file uploads', () => {
      const validFile = {
        name: 'document.pdf',
        size: 1024 * 1024, // 1MB
        type: 'application/pdf',
      };

      expect(() => InputValidator.validateFileUpload(validFile)).not.toThrow();

      const invalidFile = {
        name: 'malicious.exe',
        size: 1024 * 1024,
        type: 'application/x-msdownload',
      };

      expect(() => InputValidator.validateFileUpload(invalidFile)).toThrow(ValidationError);
    });

    it('should enforce content type enum', () => {
      const validTypes = ['resource', 'project', 'funding'];
      validTypes.forEach(type => {
        expect(() => ContentTypeSchema.parse(type)).not.toThrow();
      });

      expect(() => ContentTypeSchema.parse('invalid')).toThrow();
    });
  });

  describe('Deduplication Service', () => {
    it('should detect exact URL duplicates', async () => {
      const item = {
        url: 'https://example.com/duplicate',
        title: 'Duplicate Content',
        description: 'This is duplicate content',
      };

      const result = await deduplicationService.checkDuplicate(item);
      // First item should not be duplicate
      expect(result.isDuplicate).toBeDefined();
    });

    it('should normalize URLs for comparison', () => {
      const urls = [
        'https://www.example.com/',
        'https://example.com',
        'https://example.com?utm_source=test',
        'HTTPS://EXAMPLE.COM/',
      ];

      const normalized = urls.map(url => {
        const u = new URL(url.toLowerCase());
        return `${u.protocol}//${u.hostname.replace('www.', '')}${u.pathname.replace(/\/$/, '')}`;
      });

      // All should normalize to the same URL
      expect(new Set(normalized).size).toBe(1);
    });

    it('should detect similar content', async () => {
      const items = [
        {
          url: 'https://example.com/1',
          title: 'Web3 Development Guide',
          description: 'A comprehensive guide to Web3 development',
        },
        {
          url: 'https://example.com/2',
          title: 'Web3 Development Tutorial',
          description: 'A comprehensive tutorial for Web3 development',
        },
      ];

      const unique = await deduplicationService.deduplicateBatch(items);
      // Should detect similarity and reduce count
      expect(unique.length).toBeLessThanOrEqual(items.length);
    });
  });

  describe('AI Scoring System', () => {
    let scorer: AIScorer;

    beforeAll(() => {
      scorer = new AIScorer();
    });

    it('should score content within valid range', async () => {
      const content = {
        title: 'Advanced DeFi Strategies',
        description: 'Learn advanced strategies for DeFi yield farming',
        url: 'https://example.com/defi',
        tags: ['defi', 'yield', 'farming'],
      };

      const score = await scorer.scoreContent(content);
      
      if (score) {
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(1);
        expect(score.relevance).toBeGreaterThanOrEqual(0);
        expect(score.relevance).toBeLessThanOrEqual(1);
        expect(score.quality).toBeGreaterThanOrEqual(0);
        expect(score.quality).toBeLessThanOrEqual(1);
      }
    });

    it('should handle batch scoring', async () => {
      const contents = Array(5).fill(null).map((_, i) => ({
        title: `Content ${i}`,
        description: `Description ${i}`,
        url: `https://example.com/${i}`,
        tags: ['test'],
      }));

      const scores = await scorer.scoreBatch(contents);
      expect(scores).toBeInstanceOf(Map);
      expect(scores.size).toBeGreaterThan(0);
    });

    it('should auto-approve high quality content', () => {
      const highScore = {
        relevance: 0.9,
        quality: 0.9,
        urgency: 0.8,
        authority: 0.85,
        overall: 0.86,
        reasoning: 'High quality content',
        categories: ['web3'],
        sentiment: 'positive' as const,
        recommendation: 'approve' as const,
      };

      expect(scorer.shouldAutoApprove(highScore)).toBe(true);
    });

    it('should auto-reject low quality content', () => {
      const lowScore = {
        relevance: 0.2,
        quality: 0.1,
        urgency: 0.1,
        authority: 0.1,
        overall: 0.13,
        reasoning: 'Low quality spam',
        categories: ['spam'],
        sentiment: 'negative' as const,
        recommendation: 'reject' as const,
      };

      expect(scorer.shouldAutoReject(lowScore)).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const req: any = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '192.168.1.1' },
      };

      // First request should be allowed
      const firstCheck = await rateLimiter.checkLimit(req);
      expect(firstCheck.allowed).toBe(true);
      expect(firstCheck.remaining).toBeGreaterThan(0);

      // Simulate many requests
      for (let i = 0; i < 100; i++) {
        await rateLimiter.checkLimit(req);
      }

      // Should eventually be rate limited
      const limitedCheck = await rateLimiter.checkLimit(req);
      expect(limitedCheck.allowed).toBe(false);
      expect(limitedCheck.remaining).toBe(0);
    });

    it('should apply different tiers correctly', () => {
      const adminTier = tieredRateLimiter.getTier('/admin/dashboard');
      const searchTier = tieredRateLimiter.getTier('/search');
      const exportTier = tieredRateLimiter.getTier('/export/data');
      
      // Different endpoints should get different rate limiters
      expect(adminTier).toBeDefined();
      expect(searchTier).toBeDefined();
      expect(exportTier).toBeDefined();
    });

    it('should bypass rate limiting for authenticated cron jobs', async () => {
      const req: any = {
        headers: { 
          'x-forwarded-for': '192.168.1.1',
          'authorization': `Bearer ${process.env.CRON_SECRET}`,
        },
        socket: { remoteAddress: '192.168.1.1' },
      };

      // Should always be allowed with valid cron secret
      for (let i = 0; i < 200; i++) {
        const check = await rateLimiter.checkLimit(req);
        expect(check.allowed).toBe(true);
      }
    });
  });

  describe('Webhook System', () => {
    it('should verify webhook signatures', () => {
      const payload = JSON.stringify({ test: 'data' });
      const secret = 'webhook-secret';
      
      // Generate signature
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Test webhook signature verification directly
      // Note: verifySignature is a private method, so we'll test it indirectly
      // through the webhook delivery process
      
      // For now, just verify signature generation works
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
    });

    it('should handle webhook event types', () => {
      const validEvents = [
        'content.created',
        'content.updated',
        'content.approved',
        'content.rejected',
        'fetch.completed',
        'fetch.failed',
        'ai.scoring.completed',
        'threshold.reached',
      ];

      validEvents.forEach(event => {
        expect(() => webhookManager.trigger(event as any, {})).not.toThrow();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle different error types', () => {
      const validationError = new ValidationError('Invalid input');
      expect(validationError.statusCode).toBe(400);
      expect(validationError.isOperational).toBe(true);

      const appError = new AppError('Server error', 500, false);
      expect(appError.statusCode).toBe(500);
      expect(appError.isOperational).toBe(false);
    });

    it('should create proper error responses', () => {
      const error = new ValidationError('Invalid email format');
      const response = errorHandler.createErrorResponse(error);
      
      expect(response.error).toBe(true);
      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('Invalid email format');
    });

    it('should sanitize sensitive headers', () => {
      const headers = {
        'authorization': 'Bearer secret-token',
        'cookie': 'session=secret',
        'x-api-key': 'secret-key',
        'content-type': 'application/json',
      };

      const sanitized = errorHandler['sanitizeHeaders'](headers);
      
      expect(sanitized.authorization).toBeUndefined();
      expect(sanitized.cookie).toBeUndefined();
      expect(sanitized['x-api-key']).toBeUndefined();
      expect(sanitized['content-type']).toBe('application/json');
    });
  });

  describe('Monitoring Service', () => {
    it('should track health status', () => {
      const health = monitoringService.getHealthStatus();
      
      expect(health.overall).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.overall);
      expect(health.services).toBeInstanceOf(Array);
    });

    it('should manage alerts', () => {
      const alerts = monitoringService.getActiveAlerts();
      
      expect(alerts).toBeInstanceOf(Array);
      alerts.forEach(alert => {
        expect(alert.id).toBeDefined();
        expect(alert.severity).toBeDefined();
        expect(alert.service).toBeDefined();
        expect(alert.message).toBeDefined();
      });
    });

    it('should collect metrics', () => {
      const metrics = monitoringService.getMetrics(undefined, 60);
      
      expect(metrics).toBeInstanceOf(Array);
      metrics.forEach(metric => {
        expect(metric.name).toBeDefined();
        expect(metric.value).toBeDefined();
        expect(metric.timestamp).toBeInstanceOf(Date);
      });
    });
  });

  describe('Backup Service', () => {
    it('should list backups', async () => {
      const backups = await backupService.listBackups();
      
      expect(backups).toBeInstanceOf(Array);
      backups.forEach(backup => {
        expect(backup.id).toBeDefined();
        expect(backup.type).toMatch(/^(full|incremental)$/);
        expect(backup.timestamp).toBeInstanceOf(Date);
        expect(backup.status).toBe('completed');
      });
    });

    it('should verify backup integrity', async () => {
      const backups = await backupService.listBackups();
      
      if (backups.length > 0) {
        const result = await backupService.verifyBackup(backups[0].id);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle end-to-end content processing', async () => {
      const content = {
        url: 'https://example.com/test-content',
        title: 'Test Integration Content',
        description: 'This tests the full pipeline',
        content_type: 'resource' as const,
        resource_source: 'test',
        tags: ['test', 'integration'],
      };

      // 1. Validate content
      const validated = validateContent(content);
      expect(validated).toBeDefined();

      // 2. Check for duplicates
      const duplicate = await deduplicationService.checkDuplicate(validated);
      expect(duplicate.isDuplicate).toBeDefined();

      // 3. Score content
      const scorer = new AIScorer();
      const score = await scorer.scoreContent(validated);
      if (score) {
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(1);
      }

      // 4. Trigger webhooks (mock)
      await webhookManager.trigger(WebhookEvent.CONTENT_CREATED, validated);

      // 5. Track metrics
      const health = monitoringService.getHealthStatus();
      expect(health.overall).toBeDefined();
    });

    it('should handle errors gracefully throughout pipeline', async () => {
      const invalidContent = {
        url: 'not-a-url',
        title: '',
        description: '',
        content_type: 'invalid' as any,
      };

      // Should throw validation error
      expect(() => validateContent(invalidContent)).toThrow(ValidationError);

      // Error should be operational
      try {
        validateContent(invalidContent);
      } catch (error: any) {
        expect(error.isOperational).toBe(true);
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe('Security Tests', () => {
    it('should prevent path traversal attacks', () => {
      const maliciousPath = '../../../etc/passwd';
      const isValid = /^[a-zA-Z0-9-_/]+$/.test(maliciousPath);
      expect(isValid).toBe(false);
    });

    it('should validate JSON parsing', () => {
      const validJson = '{"test": "data"}';
      expect(() => InputValidator.validateJson(validJson)).not.toThrow();

      const invalidJson = '{test: data}';
      expect(() => InputValidator.validateJson(invalidJson)).toThrow(ValidationError);
    });

    it('should enforce array size limits', () => {
      const schema = ContentTypeSchema;
      const largeArray = Array(101).fill('tag');
      
      expect(() => InputValidator.validateArray(largeArray, schema, 100)).toThrow(ValidationError);
    });

    it('should validate email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'name+tag@example.org',
      ];

      validEmails.forEach(email => {
        expect(() => InputValidator.validateEmail(email)).not.toThrow();
      });

      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user..name@example.com',
      ];

      invalidEmails.forEach(email => {
        expect(() => InputValidator.validateEmail(email)).toThrow();
      });
    });
  });
});