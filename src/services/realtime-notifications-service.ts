import { supabase } from '../lib/supabase-client';
import { EventEmitter } from 'events';

/**
 * Real-time Notifications Service
 * Provides instant updates and alerts for better UX
 */

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: any;
  expiresAt?: Date;
}

type NotificationType = 
  | 'content_approved'
  | 'content_rejected'
  | 'ai_assessment_complete'
  | 'quality_check_complete'
  | 'batch_complete'
  | 'system_alert'
  | 'performance_warning'
  | 'new_opportunity'
  | 'deadline_reminder'
  | 'milestone_reached';

interface NotificationPreferences {
  enableDesktop: boolean;
  enableSound: boolean;
  enableEmail: boolean;
  types: {
    [key in NotificationType]?: boolean;
  };
  quietHours?: {
    start: string; // "22:00"
    end: string;   // "08:00"
  };
}

export class RealtimeNotificationsService extends EventEmitter {
  private notifications: Map<string, Notification> = new Map();
  private preferences: NotificationPreferences = {
    enableDesktop: true,
    enableSound: true,
    enableEmail: false,
    types: {
      content_approved: true,
      content_rejected: true,
      ai_assessment_complete: true,
      quality_check_complete: false,
      batch_complete: true,
      system_alert: true,
      performance_warning: true,
      new_opportunity: true,
      deadline_reminder: true,
      milestone_reached: true
    }
  };
  
  private subscription: any = null;
  private soundEnabled = true;
  private unreadCount = 0;
  
  // Notification templates
  private templates = {
    content_approved: {
      title: '✅ Content Approved',
      icon: '✅',
      sound: 'success'
    },
    content_rejected: {
      title: '❌ Content Rejected',
      icon: '❌',
      sound: 'error'
    },
    ai_assessment_complete: {
      title: '🤖 AI Assessment Complete',
      icon: '🤖',
      sound: 'complete'
    },
    quality_check_complete: {
      title: '✔️ Quality Check Complete',
      icon: '✔️',
      sound: 'complete'
    },
    batch_complete: {
      title: '📦 Batch Processing Complete',
      icon: '📦',
      sound: 'success'
    },
    system_alert: {
      title: '⚠️ System Alert',
      icon: '⚠️',
      sound: 'alert'
    },
    performance_warning: {
      title: '⚡ Performance Warning',
      icon: '⚡',
      sound: 'warning'
    },
    new_opportunity: {
      title: '🎯 New Opportunity',
      icon: '🎯',
      sound: 'notification'
    },
    deadline_reminder: {
      title: '⏰ Deadline Reminder',
      icon: '⏰',
      sound: 'reminder'
    },
    milestone_reached: {
      title: '🏆 Milestone Reached',
      icon: '🏆',
      sound: 'achievement'
    }
  };
  
  constructor() {
    super();
    this.loadPreferences();
    this.initializeRealtimeSubscription();
  }
  
  /**
   * Initialize real-time subscription
   */
  private async initializeRealtimeSubscription(): Promise<void> {
    // Subscribe to notifications table changes
    this.subscription = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      }, (payload) => {
        this.handleNewNotification(payload.new as any);
      })
      .subscribe();
    
    console.log('[Notifications] Real-time subscription initialized');
  }
  
  /**
   * Handle new notification from database
   */
  private async handleNewNotification(data: any): Promise<void> {
    const notification: Notification = {
      id: data.id,
      type: data.type,
      title: data.title,
      message: data.message,
      severity: data.severity || 'info',
      timestamp: new Date(data.created_at),
      read: false,
      actionUrl: data.action_url,
      actionLabel: data.action_label,
      metadata: data.metadata,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined
    };
    
    // Check if notification is enabled
    if (!this.shouldShowNotification(notification)) {
      return;
    }
    
    // Store notification
    this.notifications.set(notification.id, notification);
    this.unreadCount++;
    
    // Emit event
    this.emit('notification', notification);
    
    // Show desktop notification
    if (this.preferences.enableDesktop) {
      await this.showDesktopNotification(notification);
    }
    
    // Play sound
    if (this.preferences.enableSound) {
      this.playNotificationSound(notification.type);
    }
    
    // Send email if configured
    if (this.preferences.enableEmail && notification.severity === 'error') {
      await this.sendEmailNotification(notification);
    }
  }
  
  /**
   * Create and send a notification
   */
  async send(
    type: NotificationType,
    message: string,
    options?: {
      severity?: Notification['severity'];
      actionUrl?: string;
      actionLabel?: string;
      metadata?: any;
      expiresIn?: number; // minutes
    }
  ): Promise<Notification> {
    const template = this.templates[type];
    
    const notification: Notification = {
      id: this.generateId(),
      type,
      title: template.title,
      message,
      severity: options?.severity || 'info',
      timestamp: new Date(),
      read: false,
      actionUrl: options?.actionUrl,
      actionLabel: options?.actionLabel,
      metadata: options?.metadata,
      expiresAt: options?.expiresIn 
        ? new Date(Date.now() + options.expiresIn * 60000)
        : undefined
    };
    
    // Store in database
    await supabase.from('notifications').insert({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      action_url: notification.actionUrl,
      action_label: notification.actionLabel,
      metadata: notification.metadata,
      expires_at: notification.expiresAt?.toISOString(),
      created_at: notification.timestamp.toISOString()
    });
    
    return notification;
  }
  
  /**
   * Send batch completion notification
   */
  async notifyBatchComplete(
    itemsProcessed: number,
    approved: number,
    rejected: number,
    duration: number
  ): Promise<void> {
    const message = `Processed ${itemsProcessed} items in ${Math.round(duration / 1000)}s\n` +
                   `✅ Approved: ${approved}\n` +
                   `❌ Rejected: ${rejected}`;
    
    await this.send('batch_complete', message, {
      severity: 'success',
      actionUrl: '/api/admin?tab=queue',
      actionLabel: 'View Results',
      metadata: {
        itemsProcessed,
        approved,
        rejected,
        duration
      }
    });
  }
  
  /**
   * Send AI assessment notification
   */
  async notifyAIAssessment(
    itemId: string,
    score: number,
    recommendation: string
  ): Promise<void> {
    const severity = score > 80 ? 'success' : score > 50 ? 'info' : 'warning';
    const message = `Score: ${score}/100\nRecommendation: ${recommendation}`;
    
    await this.send('ai_assessment_complete', message, {
      severity,
      actionUrl: `/api/content/${itemId}`,
      actionLabel: 'View Details',
      metadata: { itemId, score, recommendation }
    });
  }
  
  /**
   * Send performance warning
   */
  async notifyPerformanceIssue(
    metric: string,
    value: number,
    threshold: number
  ): Promise<void> {
    const message = `${metric} is ${value} (threshold: ${threshold})\nPerformance may be degraded.`;
    
    await this.send('performance_warning', message, {
      severity: 'warning',
      actionUrl: '/api/performance?action=dashboard',
      actionLabel: 'View Performance',
      metadata: { metric, value, threshold }
    });
  }
  
  /**
   * Send deadline reminder
   */
  async notifyDeadline(
    item: string,
    deadline: Date,
    hoursRemaining: number
  ): Promise<void> {
    const message = `${item} deadline in ${hoursRemaining} hours\nDue: ${deadline.toLocaleString()}`;
    
    await this.send('deadline_reminder', message, {
      severity: hoursRemaining < 24 ? 'warning' : 'info',
      metadata: { item, deadline, hoursRemaining }
    });
  }
  
  /**
   * Check if notification should be shown
   */
  private shouldShowNotification(notification: Notification): boolean {
    // Check if type is enabled
    if (this.preferences.types[notification.type] === false) {
      return false;
    }
    
    // Check quiet hours
    if (this.preferences.quietHours) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = this.preferences.quietHours;
      
      if (start < end) {
        // Normal case: 22:00 - 08:00
        if (currentTime >= start || currentTime < end) {
          return notification.severity === 'error'; // Only show errors during quiet hours
        }
      } else {
        // Crosses midnight: 22:00 - 08:00
        if (currentTime >= start && currentTime < end) {
          return notification.severity === 'error';
        }
      }
    }
    
    // Check if expired
    if (notification.expiresAt && notification.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Show desktop notification
   */
  private async showDesktopNotification(notification: Notification): Promise<void> {
    // This would use the browser's Notification API in a real implementation
    console.log(`[Desktop Notification] ${notification.title}: ${notification.message}`);
    
    // In a browser environment:
    /*
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon.png',
        tag: notification.id,
        requireInteraction: notification.severity === 'error'
      });
    }
    */
  }
  
  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationType): void {
    if (!this.soundEnabled) return;
    
    const template = this.templates[type];
    const sound = template.sound;
    
    // This would play actual sounds in a browser environment
    console.log(`[Sound] Playing ${sound} sound for ${type}`);
    
    // In a browser environment:
    /*
    const audio = new Audio(`/sounds/${sound}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(console.error);
    */
  }
  
  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    // This would integrate with an email service
    console.log(`[Email] Sending email for ${notification.title}`);
    
    // Store in database for email queue
    await supabase.from('email_queue').insert({
      to: process.env.ADMIN_EMAIL,
      subject: notification.title,
      body: notification.message,
      priority: notification.severity === 'error' ? 'high' : 'normal',
      created_at: new Date().toISOString()
    });
  }
  
  /**
   * Get all notifications
   */
  getAll(options?: {
    unreadOnly?: boolean;
    type?: NotificationType;
    limit?: number;
  }): Notification[] {
    let notifications = Array.from(this.notifications.values());
    
    if (options?.unreadOnly) {
      notifications = notifications.filter(n => !n.read);
    }
    
    if (options?.type) {
      notifications = notifications.filter(n => n.type === options.type);
    }
    
    // Sort by timestamp (newest first)
    notifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (options?.limit) {
      notifications = notifications.slice(0, options.limit);
    }
    
    return notifications;
  }
  
  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      
      // Update in database
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      
      this.emit('read', notificationId);
    }
  }
  
  /**
   * Mark all as read
   */
  async markAllAsRead(): Promise<void> {
    for (const notification of this.notifications.values()) {
      if (!notification.read) {
        notification.read = true;
      }
    }
    
    this.unreadCount = 0;
    
    // Update in database
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    
    this.emit('all-read');
  }
  
  /**
   * Clear old notifications
   */
  async clearOld(daysOld: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let cleared = 0;
    
    for (const [id, notification] of this.notifications.entries()) {
      if (notification.timestamp < cutoff) {
        this.notifications.delete(id);
        cleared++;
      }
    }
    
    // Delete from database
    await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoff.toISOString());
    
    return cleared;
  }
  
  /**
   * Update preferences
   */
  updatePreferences(preferences: Partial<NotificationPreferences>): void {
    this.preferences = { ...this.preferences, ...preferences };
    this.savePreferences();
    this.emit('preferences-updated', this.preferences);
  }
  
  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }
  
  /**
   * Load preferences
   */
  private async loadPreferences(): Promise<void> {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'notification_preferences')
      .single();
    
    if (data?.value) {
      this.preferences = { ...this.preferences, ...data.value };
    }
  }
  
  /**
   * Save preferences
   */
  private async savePreferences(): Promise<void> {
    await supabase
      .from('system_settings')
      .upsert({
        key: 'notification_preferences',
        value: this.preferences,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up subscriptions
   */
  destroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.removeAllListeners();
  }
}

// Export singleton instance
export const notifications = new RealtimeNotificationsService();