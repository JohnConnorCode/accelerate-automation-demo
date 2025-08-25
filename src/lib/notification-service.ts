import { Resend } from 'resend';

// Initialize Resend for email notifications
const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface NotificationOptions {
  type: 'email' | 'slack' | 'discord' | 'webhook';
  subject: string;
  content: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private adminEmail: string;
  private fromEmail: string;
  private fromName: string;
  private notifications: any[] = [];
  private unreadCount: number = 0;
  
  constructor() {
    this.adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    this.fromEmail = process.env.NOTIFICATION_FROM_EMAIL || 'noreply@example.com';
    this.fromName = process.env.NOTIFICATION_FROM_NAME || 'Accelerate Platform';
  }

  async send(notification: any): Promise<void> {
    this.notifications.push({ ...notification, read: false });
    this.unreadCount++;
  }

  getUnreadCount(): number {
    return this.unreadCount;
  }

  async markAsRead(id: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount--;
    }
  }

  async sendNotification(options: NotificationOptions): Promise<boolean> {
    const { type, subject, content, metadata } = options;
    
    try {
      switch (type) {
        case 'email':
          return await this.sendEmailInternal(subject, content, metadata);
        case 'slack':
          return await this.sendSlackInternal(subject, content, metadata);
        case 'discord':
          return await this.sendDiscordInternal(subject, content, metadata);
        case 'webhook':
          return await this.sendWebhook(subject, content, metadata);
        default:

          return false;
      }
    } catch (error) {

      return false;
    }
  }

  private async sendEmailInternal(subject: string, content: string, metadata?: any): Promise<boolean> {
    if (!resend) {

      return true;
    }

    try {
      const { data, error } = await resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [this.adminEmail],
        subject,
        html: this.formatEmailHtml(subject, content, metadata),
        text: content,
      });

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {

      return false;
    }
  }

  private async sendSlackInternal(subject: string, content: string, metadata?: any): Promise<boolean> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!webhookUrl) {

      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: subject,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: subject,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: content,
              },
            },
            ...(metadata ? [
              {
                type: 'section',
                fields: Object.entries(metadata).map(([key, value]) => ({
                  type: 'mrkdwn',
                  text: `*${key}:* ${value}`,
                })),
              },
            ] : []),
          ],
        }),
      });

      return response.ok;
    } catch (error) {

      return false;
    }
  }

  private async sendDiscordInternal(subject: string, content: string, metadata?: any): Promise<boolean> {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {

      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.fromName,
          embeds: [
            {
              title: subject,
              description: content,
              color: 0x00ff00, // Green
              fields: metadata ? Object.entries(metadata).map(([name, value]) => ({
                name,
                value: String(value),
                inline: true,
              })) : [],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      });

      return response.ok;
    } catch (error) {

      return false;
    }
  }

  private async sendWebhook(subject: string, content: string, metadata?: any): Promise<boolean> {
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    
    if (!webhookUrl) {

      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          content,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      });

      return response.ok;
    } catch (error) {

      return false;
    }
  }

  private formatEmailHtml(subject: string, content: string, metadata?: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
            .metadata { background: #f9fafb; padding: 15px; border-radius: 5px; margin-top: 20px; }
            .metadata-item { display: flex; justify-content: space-between; padding: 5px 0; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 12px; }
            .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">${subject}</h1>
            </div>
            <div class="content">
              <div style="white-space: pre-wrap;">${content}</div>
              ${metadata ? `
                <div class="metadata">
                  <h3 style="margin-top: 0;">Details</h3>
                  ${Object.entries(metadata).map(([key, value]) => `
                    <div class="metadata-item">
                      <strong>${key}:</strong>
                      <span>${value}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              <a href="${process.env.VERCEL_URL || 'http://localhost:3000'}/admin" class="button">
                View Admin Dashboard
              </a>
            </div>
            <div class="footer">
              <p>Accelerate Content Automation System</p>
              <p>This is an automated notification. Do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Notification templates for common events
  async notifyNewContent(stats: any) {
    const subject = `📊 New Content Fetched: ${stats.total} items`;
    const content = `
Content Fetch Summary:
----------------------
Total Fetched: ${stats.total}
Unique Items: ${stats.unique}
Duplicates: ${stats.duplicates || 0}

By Type:
- Resources: ${stats.resources || 0}
- Projects: ${stats.projects || 0}
- Funding: ${stats.funding || 0}

Status: ${stats.errors > 0 ? '⚠️ Some errors occurred' : '✅ Success'}
    `.trim();

    await this.sendNotification({
      type: 'email',
      subject,
      content,
      metadata: stats,
    });
  }

  async notifyScoringComplete(stats: any) {
    const subject = `🤖 AI Scoring Complete: ${stats.processed} items`;
    const content = `
AI Scoring Summary:
-------------------
Processed: ${stats.processed}
Scored: ${stats.scored}

Results:
- Auto-Approved: ${stats.approved || 0}
- Needs Review: ${stats.review || 0}
- Rejected: ${stats.rejected || 0}

Average Score: ${(stats.avgScore || 0).toFixed(2)}
    `.trim();

    await this.sendNotification({
      type: 'email',
      subject,
      content,
      metadata: stats,
    });
  }

  async notifyContentApproved(items: any[]) {
    const subject = `✅ ${items.length} Items Approved`;
    const content = `
The following content has been approved and published:

${items.map(item => `• ${item.title} (${item.content_type})`).join('\n')}

View them in the main application.
    `.trim();

    await this.sendNotification({
      type: 'email',
      subject,
      content,
      metadata: {
        count: items.length,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async notifyError(error: any, context: string) {
    const subject = `❌ Error in ${context}`;
    const content = `
An error occurred during ${context}:

Error: ${error.message || 'Unknown error'}
Stack: ${error.stack || 'No stack trace'}

Please check the logs for more details.
    `.trim();

    await this.sendNotification({
      type: 'email',
      subject,
      content,
      metadata: {
        context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Public wrapper methods for external use
  async sendEmailTo(to: string, subject: string, content: string): Promise<boolean> {
    // Override recipient for public method
    const originalAdmin = this.adminEmail;
    this.adminEmail = to;
    const result = await this.sendNotification({
      type: 'email',
      subject,
      content,
    });
    this.adminEmail = originalAdmin;
    return result;
  }

  async sendSlackNotification(content: string, severity: 'info' | 'warning' | 'error' | 'critical'): Promise<boolean> {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    };
    const subject = `${icons[severity]} ${severity.toUpperCase()} Alert`;
    return this.sendNotification({
      type: 'slack',
      subject,
      content,
      metadata: { severity },
    });
  }

  async sendDiscordNotification(content: string, type: 'info' | 'warning' | 'error'): Promise<boolean> {
    const subject = `${type.toUpperCase()} Notification`;
    return this.sendNotification({
      type: 'discord',
      subject,
      content,
      metadata: { type },
    });
  }

  // Public API methods - these are the main methods external code should use
  async sendEmail(to: string, subject: string, content: string): Promise<boolean> {
    return this.sendEmailTo(to, subject, content);
  }

  async sendSlack(content: string, severity: 'info' | 'warning' | 'error' | 'critical'): Promise<boolean> {
    return this.sendSlackNotification(content, severity);
  }

  async sendDiscord(content: string, type: 'info' | 'warning' | 'error'): Promise<boolean> {
    return this.sendDiscordNotification(content, type);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();