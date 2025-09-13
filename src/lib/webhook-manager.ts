import { createHmac } from 'crypto';
import { supabase } from './supabase';
import { z } from 'zod';

// Webhook event types
export enum WebhookEvent {
  CONTENT_CREATED = 'content.created',
  CONTENT_UPDATED = 'content.updated',
  CONTENT_APPROVED = 'content.approved',
  CONTENT_REJECTED = 'content.rejected',
  FETCH_COMPLETED = 'fetch.completed',
  FETCH_FAILED = 'fetch.failed',
  AI_SCORING_COMPLETED = 'ai.scoring.completed',
  THRESHOLD_REACHED = 'threshold.reached',
}

// Webhook configuration schema
const WebhookConfigSchema = z.object({
  url: z.string().url(),
  events: z.array(z.nativeEnum(WebhookEvent)),
  active: z.boolean().default(true),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  retryCount: z.number().default(3),
  retryDelay: z.number().default(1000),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// Webhook payload schema
const WebhookPayloadSchema = z.object({
  event: z.nativeEnum(WebhookEvent),
  timestamp: z.string(),
  data: z.any(),
  metadata: z.object({
    webhookId: z.string(),
    deliveryId: z.string(),
    attempt: z.number(),
  }),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export class WebhookManager {
  private webhooks: Map<string, WebhookConfig> = new Map();
  private deliveryQueue: WebhookPayload[] = [];
  private processing = false;

  constructor() {
    this.loadWebhooks();
    this.startProcessor();
  }

  // Load webhooks from database
  private async loadWebhooks() {
    try {
      const { data, error } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('active', true);

      if (error) {throw error;}

      if (data) {
        data.forEach(webhook => {
          this.webhooks.set(webhook.id, {
            url: webhook.url,
            events: webhook.events,
            active: webhook.active,
            secret: webhook.secret,
            headers: webhook.headers,
            retryCount: webhook.retry_count || 3,
            retryDelay: webhook.retry_delay || 1000,
          });
        });
      }

    } catch (error) {

    }
  }

  // Register a new webhook
  async registerWebhook(config: WebhookConfig): Promise<string> {
    try {
      // Validate configuration
      const validated = WebhookConfigSchema.parse(config);

      // Generate unique ID and secret if not provided
      const id = `wh_${Date.now()}_${this.webhooks.size}`;
      const secret = validated.secret || this.generateSecret();

      // Save to database
      const { error } = await supabase
        .from('webhook_endpoints')
        .insert({
          id,
          url: validated.url,
          events: validated.events,
          active: validated.active,
          secret,
          headers: validated.headers,
          retry_count: validated.retryCount,
          retry_delay: validated.retryDelay,
          created_at: new Date().toISOString(),
        });

      if (error) {throw error;}

      // Add to memory
      this.webhooks.set(id, { ...validated, secret });

      return id;
    } catch (error) {

      throw error;
    }
  }

  // Unregister a webhook
  async unregisterWebhook(webhookId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('webhook_endpoints')
        .delete()
        .eq('id', webhookId);

      if (error) {throw error;}

      this.webhooks.delete(webhookId);

      return true;
    } catch (error) {

      return false;
    }
  }

  // Trigger webhook event
  async trigger(event: WebhookEvent, data: any) {
    const webhooksToTrigger = Array.from(this.webhooks.entries())
      .filter(([_, config]) => config.active && config.events.includes(event));

    if (webhooksToTrigger.length === 0) {
      return;
    }

    for (const [webhookId, config] of webhooksToTrigger) {
      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        data,
        metadata: {
          webhookId,
          deliveryId: `del_${Date.now()}_${webhookId.substring(3, 9)}`,
          attempt: 1,
        },
      };

      this.deliveryQueue.push(payload);
    }

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  // Process webhook delivery queue
  private async processQueue() {
    if (this.processing || this.deliveryQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.deliveryQueue.length > 0) {
      const payload = this.deliveryQueue.shift();
      if (payload) {
        await this.deliverWebhook(payload);
      }
    }

    this.processing = false;
  }

  // Deliver webhook with retries
  private async deliverWebhook(payload: WebhookPayload) {
    const config = this.webhooks.get(payload.metadata.webhookId);
    if (!config || !config.active) {
      return;
    }

    let attempt = 0;
    let success = false;

    while (attempt < config.retryCount && !success) {
      attempt++;
      
      try {
        // Generate signature
        const signature = this.generateSignature(payload, config.secret || '');

        // Prepare headers
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Delivery': payload.metadata.deliveryId,
          'X-Webhook-Timestamp': payload.timestamp,
          'X-Webhook-Signature': signature,
          ...config.headers,
        };

        // Send webhook
        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (response.ok) {
          success = true;
          await this.logDelivery(payload, response.status, 'success');

        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error: any) {

        if (attempt < config.retryCount) {
          // Wait before retry with exponential backoff
          const delay = config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          await this.logDelivery(payload, 0, 'failed', error.message);
        }
      }
    }

    return success;
  }

  // Generate HMAC signature for webhook payload
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const data = JSON.stringify(payload);
    return createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  // Generate random secret
  private generateSecret(): string {
    const timestamp = Date.now().toString(36);
    const hash = createHmac('sha256', timestamp)
      .update(process.env.NODE_ENV || 'production')
      .digest('hex')
      .substring(0, 32);
    return `whsec_${hash}`;
  }

  // Log webhook delivery
  private async logDelivery(
    payload: WebhookPayload,
    statusCode: number,
    status: 'success' | 'failed',
    error?: string
  ) {
    try {
      await supabase
        .from('webhook_deliveries')
        .insert({
          webhook_id: payload.metadata.webhookId,
          delivery_id: payload.metadata.deliveryId,
          event: payload.event,
          payload,
          status_code: statusCode,
          status,
          error,
          attempts: payload.metadata.attempt,
          delivered_at: new Date().toISOString(),
        });
    } catch (error) {

    }
  }

  // Start background processor
  private startProcessor() {
    setInterval(() => {
      if (this.deliveryQueue.length > 0 && !this.processing) {
        this.processQueue();
      }
    }, 1000);
  }

  // Verify webhook signature (for incoming webhooks)
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expected;
  }

  // Get webhook statistics
  async getStats(webhookId?: string): Promise<any> {
    try {
      const query = supabase
        .from('webhook_deliveries')
        .select('*');

      if (webhookId) {
        query.eq('webhook_id', webhookId);
      }

      const { data, error } = await query;
      if (error) {throw error;}

      const stats = {
        total: data?.length || 0,
        successful: data?.filter(d => d.status === 'success').length || 0,
        failed: data?.filter(d => d.status === 'failed').length || 0,
        byEvent: {} as Record<string, number>,
      };

      if (data) {
        data.forEach(delivery => {
          stats.byEvent[delivery.event] = (stats.byEvent[delivery.event] || 0) + 1;
        });
      }

      return stats;
    } catch (error) {

      return null;
    }
  }

  // Update webhook configuration
  async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): Promise<boolean> {
    try {
      const existing = this.webhooks.get(webhookId);
      if (!existing) {
        throw new Error('Webhook not found');
      }

      const updated = { ...existing, ...updates };
      const validated = WebhookConfigSchema.parse(updated);

      const { error } = await supabase
        .from('webhook_endpoints')
        .update({
          url: validated.url,
          events: validated.events,
          active: validated.active,
          headers: validated.headers,
          retry_count: validated.retryCount,
          retry_delay: validated.retryDelay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId);

      if (error) {throw error;}

      this.webhooks.set(webhookId, validated);

      return true;
    } catch (error) {

      return false;
    }
  }

  // Test webhook endpoint
  async testWebhook(webhookId: string): Promise<boolean> {
    const config = this.webhooks.get(webhookId);
    if (!config) {

      return false;
    }

    const testPayload: WebhookPayload = {
      event: WebhookEvent.CONTENT_CREATED,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook delivery',
      },
      metadata: {
        webhookId,
        deliveryId: `test_${Date.now()}`,
        attempt: 1,
      },
    };

    try {
      const signature = this.generateSignature(testPayload, config.secret || '');
      
      const response = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': testPayload.event,
          'X-Webhook-Delivery': testPayload.metadata.deliveryId,
          'X-Webhook-Timestamp': testPayload.timestamp,
          'X-Webhook-Signature': signature,
          'X-Webhook-Test': 'true',
          ...config.headers,
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(10000),
      });

      const success = response.ok;

      return success;
    } catch (error: any) {

      return false;
    }
  }
}

// Export singleton instance
export const webhookManager = new WebhookManager();