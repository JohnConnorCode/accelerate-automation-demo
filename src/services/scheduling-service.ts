import { supabase } from '../lib/supabase-client';
import { AccelerateOrchestrator } from '../orchestrator';
import { AutomatedQualityChecks } from './automated-quality-checks';
import { EnhancedAIService } from './enhanced-ai-service';

/**
 * CEO-Controlled Scheduling Service
 * Default: 24 hours, but fully configurable
 */

interface ScheduleConfig {
  enabled: boolean;
  intervalHours: number;
  lastRun: string | null;
  nextRun: string | null;
  manualOnly: boolean;
  autoQualityChecks: boolean;
  autoAIAssessment: boolean;
  notifyOnComplete: boolean;
  maxItemsPerRun: number;
}

export class SchedulingService {
  private orchestrator: AccelerateOrchestrator;
  private qualityChecker: AutomatedQualityChecks;
  private aiService: EnhancedAIService;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private config: ScheduleConfig = {
    enabled: true,
    intervalHours: 24,  // DEFAULT: 24 hours, not 30 minutes!
    lastRun: null,
    nextRun: null,
    manualOnly: false,  // If true, ONLY manual runs allowed
    autoQualityChecks: true,
    autoAIAssessment: true,
    notifyOnComplete: true,
    maxItemsPerRun: 500
  };

  constructor() {
    this.orchestrator = new AccelerateOrchestrator();
    this.qualityChecker = new AutomatedQualityChecks();
    this.aiService = new EnhancedAIService();
    this.loadConfig();
  }

  /**
   * Load schedule configuration from database
   */
  private async loadConfig(): Promise<void> {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'schedule_config')
        .single();

      if (data?.value) {
        this.config = { ...this.config, ...data.value };
        console.log('[Scheduler] Loaded config:', this.config);
      } else {
        // Save default config
        await this.saveConfig();
        console.log('[Scheduler] Using default config: 24-hour interval');
      }
    } catch (error) {
      console.error('[Scheduler] Failed to load config:', error);
    }
  }

  /**
   * Save configuration to database
   */
  private async saveConfig(): Promise<void> {
    try {
      await supabase
        .from('system_settings')
        .upsert({
          key: 'schedule_config',
          value: this.config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });
      
      console.log('[Scheduler] Config saved');
    } catch (error) {
      console.error('[Scheduler] Failed to save config:', error);
    }
  }

  /**
   * Update schedule configuration (CEO control)
   */
  async updateSchedule(updates: Partial<ScheduleConfig>): Promise<ScheduleConfig> {
    this.config = { ...this.config, ...updates };
    
    // Recalculate next run if interval changed
    if (updates.intervalHours !== undefined) {
      this.config.nextRun = this.calculateNextRun();
    }
    
    await this.saveConfig();
    
    // Restart scheduler with new config
    if (this.config.enabled && !this.config.manualOnly) {
      this.startScheduler();
    } else {
      this.stopScheduler();
    }
    
    return this.config;
  }

  /**
   * Calculate next run time
   */
  private calculateNextRun(): string {
    const next = new Date();
    next.setHours(next.getHours() + this.config.intervalHours);
    return next.toISOString();
  }

  /**
   * Start the scheduler
   */
  async startScheduler(): Promise<void> {
    this.stopScheduler(); // Clear any existing timer
    
    if (this.config.manualOnly) {
      console.log('[Scheduler] Manual-only mode - automatic runs disabled');
      return;
    }
    
    if (!this.config.enabled) {
      console.log('[Scheduler] Scheduler is disabled');
      return;
    }
    
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    
    console.log(`[Scheduler] Starting scheduler with ${this.config.intervalHours}-hour interval`);
    console.log(`[Scheduler] Next run: ${this.config.nextRun || 'calculating...'}`);
    
    // Set up recurring timer
    this.scheduleTimer = setInterval(async () => {
      await this.runScheduledUpdate();
    }, intervalMs);
    
    // Calculate and save next run time
    this.config.nextRun = this.calculateNextRun();
    await this.saveConfig();
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
      console.log('[Scheduler] Scheduler stopped');
    }
  }

  /**
   * Run scheduled update (automatic)
   */
  private async runScheduledUpdate(): Promise<void> {
    console.log('[Scheduler] Starting scheduled update...');
    
    const startTime = Date.now();
    const results = {
      fetched: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      errors: 0
    };
    
    try {
      // Run orchestrator
      console.log('[Scheduler] Running data fetch...');
      const orchestratorResult = await this.orchestrator.run();
      results.fetched = (orchestratorResult as any).totalItems || 0;
      results.processed = (orchestratorResult as any).processed || 0;
      
      // Run quality checks if enabled
      if (this.config.autoQualityChecks) {
        console.log('[Scheduler] Running automated quality checks...');
        const qualityStats = await this.qualityChecker.runBatchQualityChecks(
          this.config.maxItemsPerRun
        );
        results.approved += qualityStats.approved;
        results.rejected += qualityStats.rejected;
      }
      
      // Update last run time
      this.config.lastRun = new Date().toISOString();
      this.config.nextRun = this.calculateNextRun();
      await this.saveConfig();
      
      // Log results
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`[Scheduler] Update completed in ${duration}s`);
      console.log(`[Scheduler] Results:`, results);
      
      // Store run history
      await this.storeRunHistory(results, duration);
      
      // Send notification if enabled
      if (this.config.notifyOnComplete) {
        await this.sendCompletionNotification(results, duration);
      }
      
    } catch (error) {
      console.error('[Scheduler] Update failed:', error);
      results.errors++;
    }
  }

  /**
   * Run manual update (CEO triggered)
   */
  async runManualUpdate(options?: {
    skipFetch?: boolean;
    skipQualityChecks?: boolean;
    skipAI?: boolean;
    sources?: string[];
  }): Promise<any> {
    console.log('[Scheduler] Starting MANUAL update (CEO triggered)...');
    
    const startTime = Date.now();
    const results = {
      fetched: 0,
      processed: 0,
      approved: 0,
      rejected: 0,
      errors: 0,
      source: 'manual'
    };
    
    try {
      // Fetch data unless skipped
      if (!options?.skipFetch) {
        console.log('[Scheduler] Fetching data from sources...');
        const orchestratorResult = await this.orchestrator.run();
        results.fetched = (orchestratorResult as any).totalItems || 0;
        results.processed = (orchestratorResult as any).processed || 0;
      }
      
      // Run quality checks unless skipped
      if (!options?.skipQualityChecks) {
        console.log('[Scheduler] Running quality checks...');
        const qualityStats = await this.qualityChecker.runBatchQualityChecks(
          this.config.maxItemsPerRun
        );
        results.approved += qualityStats.approved;
        results.rejected += qualityStats.rejected;
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      // Store as manual run
      await this.storeRunHistory(results, duration);
      
      console.log(`[Scheduler] Manual update completed in ${duration}s`);
      
      return {
        success: true,
        results,
        duration,
        message: `Processed ${results.processed} items in ${duration} seconds`
      };
      
    } catch (error) {
      console.error('[Scheduler] Manual update failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results
      };
    }
  }

  /**
   * Store run history for analytics
   */
  private async storeRunHistory(results: any, duration: number): Promise<void> {
    try {
      await supabase.from('scheduler_history').insert({
        run_type: results.source || 'automatic',
        items_fetched: results.fetched,
        items_processed: results.processed,
        items_approved: results.approved,
        items_rejected: results.rejected,
        errors: results.errors,
        duration_seconds: duration,
        config: this.config,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Scheduler] Failed to store history:', error);
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(results: any, duration: number): Promise<void> {
    // This could send email, webhook, or dashboard notification
    console.log('[Scheduler] Notification: Update complete', {
      results,
      duration,
      nextRun: this.config.nextRun
    });
    
    // Store notification in database for dashboard
    try {
      await supabase.from('notifications').insert({
        type: 'scheduler_complete',
        title: 'Content Update Complete',
        message: `Processed ${results.processed} items. Approved: ${results.approved}, Rejected: ${results.rejected}`,
        metadata: results,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('[Scheduler] Failed to store notification:', error);
    }
  }

  /**
   * Get scheduler status (for dashboard)
   */
  async getStatus(): Promise<{
    config: ScheduleConfig;
    isRunning: boolean;
    lastRun: string | null;
    nextRun: string | null;
    recentRuns: any[];
  }> {
    // Fetch recent run history
    const { data: recentRuns } = await supabase
      .from('scheduler_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    return {
      config: this.config,
      isRunning: this.scheduleTimer !== null,
      lastRun: this.config.lastRun,
      nextRun: this.config.nextRun,
      recentRuns: recentRuns || []
    };
  }

  /**
   * Enable/disable scheduler
   */
  async setEnabled(enabled: boolean): Promise<void> {
    await this.updateSchedule({ enabled });
    
    if (enabled && !this.config.manualOnly) {
      console.log('[Scheduler] Enabled - will run every', this.config.intervalHours, 'hours');
    } else {
      console.log('[Scheduler] Disabled - manual runs only');
    }
  }

  /**
   * Set to manual-only mode
   */
  async setManualOnly(manualOnly: boolean): Promise<void> {
    await this.updateSchedule({ manualOnly });
    
    if (manualOnly) {
      console.log('[Scheduler] MANUAL-ONLY mode activated - no automatic runs');
    } else {
      console.log('[Scheduler] Automatic mode activated - runs every', this.config.intervalHours, 'hours');
    }
  }
}