import { EventEmitter } from 'events';
import { intelligentCache } from './intelligent-cache-service';
import { monitoring } from './monitoring-alerting-service';

/**
 * Graceful Degradation Service
 * Ensures system continues functioning with reduced features during failures
 */

interface DegradationLevel {
  level: 'full' | 'partial' | 'minimal' | 'emergency';
  enabledFeatures: Set<string>;
  disabledFeatures: Set<string>;
  performanceMode: 'normal' | 'conservative' | 'survival';
  cacheStrategy: 'normal' | 'aggressive' | 'read-only';
  apiRateLimit: number;
  batchSize: number;
  timeouts: {
    api: number;
    database: number;
    cache: number;
  };
}

interface SystemHealth {
  cpu: number;
  memory: number;
  errorRate: number;
  responseTime: number;
  availableConnections: number;
  queueDepth: number;
}

interface FeatureConfig {
  name: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  resourceConsumption: 'high' | 'medium' | 'low';
  fallbackBehavior: () => any;
}

export class GracefulDegradationService extends EventEmitter {
  private currentLevel: DegradationLevel;
  private featureConfigs: Map<string, FeatureConfig> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: SystemHealth | null = null;
  private degradationHistory: Array<{
    timestamp: Date;
    fromLevel: string;
    toLevel: string;
    reason: string;
  }> = [];
  
  // Thresholds for degradation levels
  private readonly thresholds = {
    emergency: {
      errorRate: 0.5,     // 50% errors
      responseTime: 10000, // 10 seconds
      memory: 0.95,       // 95% memory
      cpu: 0.95          // 95% CPU
    },
    minimal: {
      errorRate: 0.3,     // 30% errors
      responseTime: 5000,  // 5 seconds
      memory: 0.90,       // 90% memory
      cpu: 0.90          // 90% CPU
    },
    partial: {
      errorRate: 0.1,     // 10% errors
      responseTime: 3000,  // 3 seconds
      memory: 0.80,       // 80% memory
      cpu: 0.80          // 80% CPU
    }
  };
  
  // Feature definitions
  private readonly features: FeatureConfig[] = [
    {
      name: 'ai-assessment',
      priority: 'high',
      dependencies: ['openai-api'],
      resourceConsumption: 'high',
      fallbackBehavior: () => ({ score: 75, reason: 'Manual review required' })
    },
    {
      name: 'smart-search',
      priority: 'medium',
      dependencies: ['database', 'cache'],
      resourceConsumption: 'medium',
      fallbackBehavior: () => ({ results: [], fromCache: true })
    },
    {
      name: 'real-time-notifications',
      priority: 'low',
      dependencies: ['websocket'],
      resourceConsumption: 'low',
      fallbackBehavior: () => null
    },
    {
      name: 'content-enrichment',
      priority: 'medium',
      dependencies: ['ai-assessment'],
      resourceConsumption: 'high',
      fallbackBehavior: () => ({ enriched: false })
    },
    {
      name: 'analytics-dashboard',
      priority: 'low',
      dependencies: ['database'],
      resourceConsumption: 'medium',
      fallbackBehavior: () => ({ available: false })
    },
    {
      name: 'batch-processing',
      priority: 'medium',
      dependencies: ['database', 'queue'],
      resourceConsumption: 'high',
      fallbackBehavior: () => ({ queued: true, estimatedTime: 'unknown' })
    },
    {
      name: 'export-functionality',
      priority: 'low',
      dependencies: ['database'],
      resourceConsumption: 'medium',
      fallbackBehavior: () => ({ exportAvailable: false })
    },
    {
      name: 'advanced-filtering',
      priority: 'low',
      dependencies: ['database'],
      resourceConsumption: 'medium',
      fallbackBehavior: () => ({ filters: [] })
    }
  ];
  
  constructor() {
    super();
    this.currentLevel = this.getFullServiceLevel();
    this.initializeFeatures();
    this.startHealthMonitoring();
  }
  
  /**
   * Initialize feature configurations
   */
  private initializeFeatures(): void {
    for (const feature of this.features) {
      this.featureConfigs.set(feature.name, feature);
    }
  }
  
  /**
   * Get full service level configuration
   */
  private getFullServiceLevel(): DegradationLevel {
    return {
      level: 'full',
      enabledFeatures: new Set(this.features.map(f => f.name)),
      disabledFeatures: new Set(),
      performanceMode: 'normal',
      cacheStrategy: 'normal',
      apiRateLimit: 100, // requests per minute
      batchSize: 50,
      timeouts: {
        api: 30000,
        database: 30000,
        cache: 5000
      }
    };
  }
  
  /**
   * Get partial degradation level
   */
  private getPartialLevel(): DegradationLevel {
    const enabledFeatures = new Set(
      this.features
        .filter(f => f.priority !== 'low')
        .map(f => f.name)
    );
    
    const disabledFeatures = new Set(
      this.features
        .filter(f => f.priority === 'low')
        .map(f => f.name)
    );
    
    return {
      level: 'partial',
      enabledFeatures,
      disabledFeatures,
      performanceMode: 'conservative',
      cacheStrategy: 'aggressive',
      apiRateLimit: 50,
      batchSize: 20,
      timeouts: {
        api: 20000,
        database: 20000,
        cache: 3000
      }
    };
  }
  
  /**
   * Get minimal service level
   */
  private getMinimalLevel(): DegradationLevel {
    const enabledFeatures = new Set(
      this.features
        .filter(f => f.priority === 'critical' || f.priority === 'high')
        .map(f => f.name)
    );
    
    const disabledFeatures = new Set(
      this.features
        .filter(f => f.priority !== 'critical' && f.priority !== 'high')
        .map(f => f.name)
    );
    
    return {
      level: 'minimal',
      enabledFeatures,
      disabledFeatures,
      performanceMode: 'survival',
      cacheStrategy: 'read-only',
      apiRateLimit: 20,
      batchSize: 5,
      timeouts: {
        api: 10000,
        database: 10000,
        cache: 2000
      }
    };
  }
  
  /**
   * Get emergency level (bare minimum)
   */
  private getEmergencyLevel(): DegradationLevel {
    const enabledFeatures = new Set(
      this.features
        .filter(f => f.priority === 'critical')
        .map(f => f.name)
    );
    
    const disabledFeatures = new Set(
      this.features
        .filter(f => f.priority !== 'critical')
        .map(f => f.name)
    );
    
    return {
      level: 'emergency',
      enabledFeatures,
      disabledFeatures,
      performanceMode: 'survival',
      cacheStrategy: 'read-only',
      apiRateLimit: 5,
      batchSize: 1,
      timeouts: {
        api: 5000,
        database: 5000,
        cache: 1000
      }
    };
  }
  
  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    console.log('[Degradation] Starting health monitoring...');
    
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.checkSystemHealth();
    }, 30000);
    
    // Initial check
    this.checkSystemHealth();
  }
  
  /**
   * Check system health and adjust level
   */
  private async checkSystemHealth(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      this.lastHealthCheck = health;
      
      const recommendedLevel = this.determineOptimalLevel(health);
      
      if (recommendedLevel !== this.currentLevel.level) {
        await this.transitionToLevel(recommendedLevel, 'System health changed');
      }
      
      this.emit('health-check', {
        health,
        currentLevel: this.currentLevel.level,
        recommendedLevel
      });
      
    } catch (error) {
      console.error('[Degradation] Health check failed:', error);
      // If health check fails, assume worst case
      await this.transitionToLevel('minimal', 'Health check failure');
    }
  }
  
  /**
   * Get current system health metrics
   */
  private async getSystemHealth(): Promise<SystemHealth> {
    const healthSummary = monitoring.getHealthSummary();
    const metrics = healthSummary.metrics;
    
    return {
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      errorRate: metrics.errorRate || 0,
      responseTime: metrics.responseTime || 0,
      availableConnections: 100 - (metrics.dbConnections || 0),
      queueDepth: metrics.queueSize || 0
    };
  }
  
  /**
   * Determine optimal degradation level based on health
   */
  private determineOptimalLevel(health: SystemHealth): DegradationLevel['level'] {
    // Check emergency thresholds
    if (
      health.errorRate > this.thresholds.emergency.errorRate ||
      health.responseTime > this.thresholds.emergency.responseTime ||
      health.memory > this.thresholds.emergency.memory ||
      health.cpu > this.thresholds.emergency.cpu
    ) {
      return 'emergency';
    }
    
    // Check minimal thresholds
    if (
      health.errorRate > this.thresholds.minimal.errorRate ||
      health.responseTime > this.thresholds.minimal.responseTime ||
      health.memory > this.thresholds.minimal.memory ||
      health.cpu > this.thresholds.minimal.cpu
    ) {
      return 'minimal';
    }
    
    // Check partial thresholds
    if (
      health.errorRate > this.thresholds.partial.errorRate ||
      health.responseTime > this.thresholds.partial.responseTime ||
      health.memory > this.thresholds.partial.memory ||
      health.cpu > this.thresholds.partial.cpu
    ) {
      return 'partial';
    }
    
    // System is healthy
    return 'full';
  }
  
  /**
   * Transition to a new degradation level
   */
  private async transitionToLevel(
    newLevel: DegradationLevel['level'],
    reason: string
  ): Promise<void> {
    const oldLevel = this.currentLevel.level;
    
    if (oldLevel === newLevel) return;
    
    console.log(`[Degradation] Transitioning from ${oldLevel} to ${newLevel}: ${reason}`);
    
    // Record transition
    this.degradationHistory.push({
      timestamp: new Date(),
      fromLevel: oldLevel,
      toLevel: newLevel,
      reason
    });
    
    // Get new level configuration
    let newConfig: DegradationLevel;
    switch (newLevel) {
      case 'emergency':
        newConfig = this.getEmergencyLevel();
        break;
      case 'minimal':
        newConfig = this.getMinimalLevel();
        break;
      case 'partial':
        newConfig = this.getPartialLevel();
        break;
      default:
        newConfig = this.getFullServiceLevel();
    }
    
    // Apply new configuration
    await this.applyDegradationLevel(newConfig);
    
    // Update current level
    this.currentLevel = newConfig;
    
    // Emit event
    this.emit('level-changed', {
      oldLevel,
      newLevel,
      reason,
      config: newConfig
    });
    
    // Send notification
    await monitoring.recordMetric(
      'degradation_level',
      this.getLevelNumeric(newLevel),
      { reason }
    );
  }
  
  /**
   * Apply degradation level configuration
   */
  private async applyDegradationLevel(level: DegradationLevel): Promise<void> {
    console.log(`[Degradation] Applying ${level.level} configuration`);
    
    // Disable features
    for (const feature of level.disabledFeatures) {
      await this.disableFeature(feature);
    }
    
    // Enable features
    for (const feature of level.enabledFeatures) {
      await this.enableFeature(feature);
    }
    
    // Apply cache strategy
    await this.applyCacheStrategy(level.cacheStrategy);
    
    // Update performance settings
    await this.updatePerformanceSettings(level);
    
    console.log(`[Degradation] Level ${level.level} applied successfully`);
  }
  
  /**
   * Disable a feature
   */
  private async disableFeature(featureName: string): Promise<void> {
    const config = this.featureConfigs.get(featureName);
    if (!config) return;
    
    console.log(`[Degradation] Disabling feature: ${featureName}`);
    
    // Store disabled state
    await intelligentCache.set(
      `feature:${featureName}:enabled`,
      false,
      { ttl: 3600000 }
    );
    
    this.emit('feature-disabled', featureName);
  }
  
  /**
   * Enable a feature
   */
  private async enableFeature(featureName: string): Promise<void> {
    const config = this.featureConfigs.get(featureName);
    if (!config) return;
    
    // Check dependencies
    for (const dep of config.dependencies) {
      if (!await this.isDependencyAvailable(dep)) {
        console.warn(`[Degradation] Cannot enable ${featureName}: dependency ${dep} unavailable`);
        return;
      }
    }
    
    console.log(`[Degradation] Enabling feature: ${featureName}`);
    
    // Store enabled state
    await intelligentCache.set(
      `feature:${featureName}:enabled`,
      true,
      { ttl: 3600000 }
    );
    
    this.emit('feature-enabled', featureName);
  }
  
  /**
   * Check if dependency is available
   */
  private async isDependencyAvailable(dependency: string): Promise<boolean> {
    // Check various dependencies
    switch (dependency) {
      case 'database':
        return await this.checkDatabaseConnection();
      case 'cache':
        return await this.checkCacheAvailability();
      case 'openai-api':
        return await this.checkApiAvailability('openai');
      case 'websocket':
        return true; // Simplified for now
      case 'queue':
        return true; // Simplified for now
      default:
        return true;
    }
  }
  
  /**
   * Check database connection
   */
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Simple health check query
      const { error } = await (global as any).supabase
        .from('system_settings')
        .select('key')
        .limit(1)
        .single();
      
      return !error;
    } catch {
      return false;
    }
  }
  
  /**
   * Check cache availability
   */
  private async checkCacheAvailability(): Promise<boolean> {
    try {
      await intelligentCache.set('health-check', true, { ttl: 1000 });
      const result = await intelligentCache.get('health-check');
      return result === true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check API availability
   */
  private async checkApiAvailability(apiName: string): Promise<boolean> {
    // This would check actual API endpoints in production
    // For now, return based on error rate
    const health = this.lastHealthCheck;
    return !health || health.errorRate < 0.5;
  }
  
  /**
   * Apply cache strategy
   */
  private async applyCacheStrategy(strategy: DegradationLevel['cacheStrategy']): Promise<void> {
    switch (strategy) {
      case 'aggressive':
        // Increase cache TTLs
        console.log('[Degradation] Applying aggressive caching');
        break;
      case 'read-only':
        // Only read from cache, don't write
        console.log('[Degradation] Cache set to read-only mode');
        break;
      default:
        // Normal caching
        break;
    }
  }
  
  /**
   * Update performance settings
   */
  private async updatePerformanceSettings(level: DegradationLevel): Promise<void> {
    // Store performance settings for other services to use
    await intelligentCache.set('performance:settings', {
      mode: level.performanceMode,
      apiRateLimit: level.apiRateLimit,
      batchSize: level.batchSize,
      timeouts: level.timeouts
    }, { ttl: 3600000 });
  }
  
  /**
   * Check if a feature is enabled
   */
  async isFeatureEnabled(featureName: string): Promise<boolean> {
    // First check current level
    if (this.currentLevel.enabledFeatures.has(featureName)) {
      return true;
    }
    
    // Check cache for override
    const cached = await intelligentCache.get<boolean>(`feature:${featureName}:enabled`);
    return cached === true;
  }
  
  /**
   * Get fallback for a feature
   */
  getFallback(featureName: string): any {
    const config = this.featureConfigs.get(featureName);
    if (!config) return null;
    
    return config.fallbackBehavior();
  }
  
  /**
   * Execute with degradation support
   */
  async executeWithDegradation<T>(
    featureName: string,
    operation: () => Promise<T>,
    options?: {
      skipFallback?: boolean;
      customFallback?: () => T;
    }
  ): Promise<T> {
    // Check if feature is enabled
    const isEnabled = await this.isFeatureEnabled(featureName);
    
    if (!isEnabled) {
      console.log(`[Degradation] Feature ${featureName} is disabled`);
      
      if (options?.skipFallback) {
        throw new Error(`Feature ${featureName} is currently unavailable`);
      }
      
      // Use custom fallback or default
      const fallback = options?.customFallback || (() => this.getFallback(featureName));
      return fallback();
    }
    
    // Apply performance constraints based on current level
    const settings = await this.getPerformanceSettings();
    
    try {
      // Execute with timeout based on degradation level
      const timeout = settings.timeouts?.api || 30000;
      return await this.withTimeout(operation(), timeout);
    } catch (error) {
      console.error(`[Degradation] Feature ${featureName} failed:`, error);
      
      // Try fallback on error
      if (!options?.skipFallback) {
        const fallback = options?.customFallback || (() => this.getFallback(featureName));
        return fallback();
      }
      
      throw error;
    }
  }
  
  /**
   * Get current performance settings
   */
  async getPerformanceSettings(): Promise<{
    mode: string;
    apiRateLimit: number;
    batchSize: number;
    timeouts: DegradationLevel['timeouts'];
  }> {
    const cached = await intelligentCache.get<any>('performance:settings');
    
    if (cached) {
      return cached;
    }
    
    return {
      mode: this.currentLevel.performanceMode,
      apiRateLimit: this.currentLevel.apiRateLimit,
      batchSize: this.currentLevel.batchSize,
      timeouts: this.currentLevel.timeouts
    };
  }
  
  /**
   * Wrap promise with timeout
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeout)
      )
    ]);
  }
  
  /**
   * Convert level to numeric for metrics
   */
  private getLevelNumeric(level: DegradationLevel['level']): number {
    switch (level) {
      case 'full': return 100;
      case 'partial': return 75;
      case 'minimal': return 50;
      case 'emergency': return 25;
      default: return 0;
    }
  }
  
  /**
   * Force a degradation level (for testing/emergency)
   */
  async forceLevel(level: DegradationLevel['level'], reason: string): Promise<void> {
    await this.transitionToLevel(level, `Forced: ${reason}`);
  }
  
  /**
   * Get current status
   */
  getStatus(): {
    currentLevel: DegradationLevel['level'];
    enabledFeatures: string[];
    disabledFeatures: string[];
    lastHealthCheck: SystemHealth | null;
    history: Array<{
      timestamp: Date;
      fromLevel: string;
      toLevel: string;
      reason: string;
    }>;
  } {
    return {
      currentLevel: this.currentLevel.level,
      enabledFeatures: Array.from(this.currentLevel.enabledFeatures),
      disabledFeatures: Array.from(this.currentLevel.disabledFeatures),
      lastHealthCheck: this.lastHealthCheck,
      history: this.degradationHistory.slice(-10) // Last 10 transitions
    };
  }
  
  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[Degradation] Monitoring stopped');
    }
  }
}

// Export singleton instance
export const degradation = new GracefulDegradationService();