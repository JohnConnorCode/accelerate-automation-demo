import { supabase } from './supabase';
import { AIScorer } from './ai-scorer';
import { EventEmitter } from 'events';
import * as tf from '@tensorflow/tfjs-node';

// Priority factors and weights
interface PriorityFactors {
  relevanceScore: number;      // 0-1, from AI scoring
  freshnessScore: number;      // 0-1, based on content age
  engagementPotential: number; // 0-1, predicted engagement
  sourceTrust: number;         // 0-1, source reliability
  trendingScore: number;       // 0-1, trending topic match
  uniquenessScore: number;     // 0-1, content uniqueness
  completenessScore: number;   // 0-1, content completeness
  urgencyScore: number;        // 0-1, time-sensitive content
}

// Content priority levels
export enum ContentPriority {
  EMERGENCY = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  BACKLOG = 1,
}

// Scheduling strategies
export enum SchedulingStrategy {
  FIFO = 'fifo',              // First In First Out
  LIFO = 'lifo',              // Last In First Out
  PRIORITY = 'priority',       // Priority-based
  WEIGHTED = 'weighted',       // Weighted scoring
  ADAPTIVE = 'adaptive',       // ML-based adaptive
  ROUND_ROBIN = 'round_robin', // Round-robin by category
  DEADLINE = 'deadline',       // Deadline-driven
  HYBRID = 'hybrid',          // Combination of strategies
}

// Content scheduling slot
interface ScheduleSlot {
  id: string;
  contentId: string;
  scheduledTime: Date;
  priority: ContentPriority;
  strategy: SchedulingStrategy;
  locked: boolean;
  metadata?: Record<string, any>;
}

// Prioritization configuration
interface PrioritizerConfig {
  strategy: SchedulingStrategy;
  weights: {
    relevance: number;
    freshness: number;
    engagement: number;
    trust: number;
    trending: number;
    uniqueness: number;
    completeness: number;
    urgency: number;
  };
  scheduling: {
    slotsPerHour: number;
    maxBatchSize: number;
    lookaheadHours: number;
    bufferMinutes: number;
  };
  rules: PriorityRule[];
  mlModelPath?: string;
}

// Priority rule for content filtering
interface PriorityRule {
  id: string;
  name: string;
  condition: {
    field: string;
    operator: string;
    value: any;
  };
  action: {
    type: 'boost' | 'suppress' | 'block' | 'schedule';
    value: any;
  };
  priority: number;
}

// Content item with priority metadata
interface PrioritizedContent {
  id: string;
  content: any;
  factors: PriorityFactors;
  finalScore: number;
  priority: ContentPriority;
  scheduledTime?: Date;
  reasoning?: string[];
}

// ML model for adaptive prioritization
class PriorityModel {
  private model: tf.LayersModel | null = null;
  private isTraining: boolean = false;

  async initialize(modelPath?: string) {
    if (modelPath) {
      try {
        this.model = await tf.loadLayersModel(modelPath);
        console.log('[Prioritizer] Loaded ML model from', modelPath);
      } catch (error) {
        console.error('[Prioritizer] Failed to load model:', error);
        this.createDefaultModel();
      }
    } else {
      this.createDefaultModel();
    }
  }

  private createDefaultModel() {
    // Create a simple neural network for priority prediction
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [8], // 8 priority factors
          units: 16,
          activation: 'relu' 
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ 
          units: 8,
          activation: 'relu' 
        }),
        tf.layers.dense({ 
          units: 1,
          activation: 'sigmoid' // Output 0-1 priority score
        }),
      ],
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy'],
    });
  }

  async predict(factors: PriorityFactors): Promise<number> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    const input = tf.tensor2d([[
      factors.relevanceScore,
      factors.freshnessScore,
      factors.engagementPotential,
      factors.sourceTrust,
      factors.trendingScore,
      factors.uniquenessScore,
      factors.completenessScore,
      factors.urgencyScore,
    ]]);

    const prediction = this.model.predict(input) as tf.Tensor;
    const score = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    return score[0];
  }

  async train(trainingData: Array<{ factors: PriorityFactors; score: number }>) {
    if (!this.model || this.isTraining) return;

    this.isTraining = true;

    try {
      const inputs = trainingData.map(d => [
        d.factors.relevanceScore,
        d.factors.freshnessScore,
        d.factors.engagementPotential,
        d.factors.sourceTrust,
        d.factors.trendingScore,
        d.factors.uniquenessScore,
        d.factors.completenessScore,
        d.factors.urgencyScore,
      ]);

      const outputs = trainingData.map(d => d.score);

      const xs = tf.tensor2d(inputs);
      const ys = tf.tensor2d(outputs, [outputs.length, 1]);

      await this.model.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`[Prioritizer] Training epoch ${epoch}:`, logs);
          },
        },
      });

      xs.dispose();
      ys.dispose();

      console.log('[Prioritizer] Model training completed');
    } catch (error) {
      console.error('[Prioritizer] Training error:', error);
    } finally {
      this.isTraining = false;
    }
  }

  async save(path: string): Promise<void> {
    if (!this.model) return;
    await this.model.save(path);
  }
}

export class ContentPrioritizer extends EventEmitter {
  private config: PrioritizerConfig;
  private schedule: Map<string, ScheduleSlot> = new Map();
  private contentQueue: PrioritizedContent[] = [];
  private model: PriorityModel;
  private trendingTopics: Set<string> = new Set();
  private sourceReliability: Map<string, number> = new Map();
  private scheduler: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config?: Partial<PrioritizerConfig>) {
    super();
    
    this.config = {
      strategy: SchedulingStrategy.HYBRID,
      weights: {
        relevance: 0.25,
        freshness: 0.15,
        engagement: 0.20,
        trust: 0.10,
        trending: 0.10,
        uniqueness: 0.10,
        completeness: 0.05,
        urgency: 0.05,
      },
      scheduling: {
        slotsPerHour: 10,
        maxBatchSize: 50,
        lookaheadHours: 24,
        bufferMinutes: 5,
      },
      rules: [],
      ...config,
    };

    this.model = new PriorityModel();
    this.initialize();
  }

  private async initialize() {
    await this.model.initialize(this.config.mlModelPath);
    await this.loadSourceReliability();
    await this.loadTrendingTopics();
    await this.loadExistingSchedule();
    this.startScheduler();
  }

  private async loadSourceReliability() {
    try {
      const { data, error } = await supabase
        .from('source_reliability')
        .select('source, trust_score');

      if (!error && data) {
        data.forEach(item => {
          this.sourceReliability.set(item.source, item.trust_score);
        });
      }
    } catch (error) {
      console.error('[Prioritizer] Error loading source reliability:', error);
    }
  }

  private async loadTrendingTopics() {
    try {
      const { data, error } = await supabase
        .from('trending_topics')
        .select('topic')
        .gte('trending_score', 0.7)
        .order('trending_score', { ascending: false })
        .limit(50);

      if (!error && data) {
        this.trendingTopics = new Set(data.map(item => item.topic.toLowerCase()));
      }
    } catch (error) {
      console.error('[Prioritizer] Error loading trending topics:', error);
    }
  }

  private async loadExistingSchedule() {
    try {
      const { data, error } = await supabase
        .from('content_schedule')
        .select('*')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true });

      if (!error && data) {
        data.forEach(item => {
          this.schedule.set(item.id, {
            id: item.id,
            contentId: item.content_id,
            scheduledTime: new Date(item.scheduled_time),
            priority: item.priority,
            strategy: item.strategy,
            locked: item.locked || false,
            metadata: item.metadata,
          });
        });
      }
    } catch (error) {
      console.error('[Prioritizer] Error loading schedule:', error);
    }
  }

  private startScheduler() {
    // Run scheduling every minute
    this.scheduler = setInterval(() => {
      this.processSchedule();
    }, 60000);

    this.isRunning = true;
    this.emit('scheduler:started');
  }

  async prioritizeContent(content: any[]): Promise<PrioritizedContent[]> {
    const prioritized: PrioritizedContent[] = [];

    for (const item of content) {
      const factors = await this.calculateFactors(item);
      const finalScore = await this.calculateFinalScore(factors);
      const priority = this.scoreToPriority(finalScore);
      const reasoning = this.explainPriority(factors, finalScore);

      const prioritizedItem: PrioritizedContent = {
        id: item.id,
        content: item,
        factors,
        finalScore,
        priority,
        reasoning,
      };

      // Apply rules
      const ruledItem = this.applyRules(prioritizedItem);
      prioritized.push(ruledItem);
    }

    // Sort by final score
    prioritized.sort((a, b) => b.finalScore - a.finalScore);

    // Store in queue
    this.contentQueue = prioritized;

    this.emit('content:prioritized', {
      count: prioritized.length,
      topPriority: prioritized.slice(0, 5).map(p => ({
        id: p.id,
        score: p.finalScore,
        priority: p.priority,
      })),
    });

    return prioritized;
  }

  private async calculateFactors(content: any): Promise<PriorityFactors> {
    // Calculate relevance score using AI
    const aiScorer = new AIScorer();
    const aiScore = await aiScorer.scoreContent(content);
    const relevanceScore = aiScore?.overall || 0.5;

    // Calculate freshness score
    const age = Date.now() - new Date(content.created_at || Date.now()).getTime();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    const freshnessScore = Math.max(0, 1 - (age / maxAge));

    // Calculate engagement potential
    const engagementPotential = this.predictEngagement(content);

    // Get source trust score
    const sourceTrust = this.sourceReliability.get(content.source) || 0.5;

    // Calculate trending score
    const trendingScore = this.calculateTrendingScore(content);

    // Calculate uniqueness score
    const uniquenessScore = await this.calculateUniqueness(content);

    // Calculate completeness score
    const completenessScore = this.calculateCompleteness(content);

    // Calculate urgency score
    const urgencyScore = this.calculateUrgency(content);

    return {
      relevanceScore,
      freshnessScore,
      engagementPotential,
      sourceTrust,
      trendingScore,
      uniquenessScore,
      completenessScore,
      urgencyScore,
    };
  }

  private predictEngagement(content: any): number {
    // Predict engagement based on content features
    let score = 0.5;

    // Title length and quality
    if (content.title) {
      const titleLength = content.title.length;
      if (titleLength > 30 && titleLength < 80) score += 0.1;
      if (/\d+/.test(content.title)) score += 0.05; // Contains numbers
      if (/how|why|what|guide|tutorial/i.test(content.title)) score += 0.1;
    }

    // Description quality
    if (content.description) {
      if (content.description.length > 100) score += 0.1;
      if (content.description.length > 300) score += 0.05;
    }

    // Media presence
    if (content.has_images) score += 0.1;
    if (content.has_video) score += 0.15;

    // Tags and categories
    if (content.tags && content.tags.length > 3) score += 0.05;

    return Math.min(1, score);
  }

  private calculateTrendingScore(content: any): number {
    if (!content.title && !content.description) return 0;

    const text = `${content.title || ''} ${content.description || ''}`.toLowerCase();
    let matches = 0;

    this.trendingTopics.forEach(topic => {
      if (text.includes(topic)) matches++;
    });

    return Math.min(1, matches * 0.2);
  }

  private async calculateUniqueness(content: any): Promise<number> {
    // Check for similar content in database
    const { data, error } = await supabase
      .from('content_queue')
      .select('id')
      .textSearch('title', content.title)
      .limit(5);

    if (error || !data) return 1;

    // More similar content = lower uniqueness
    return Math.max(0, 1 - (data.length * 0.2));
  }

  private calculateCompleteness(content: any): number {
    let score = 0;
    const fields = ['title', 'description', 'url', 'author', 'tags', 'category'];
    
    fields.forEach(field => {
      if (content[field]) score += (1 / fields.length);
    });

    // Extra points for rich content
    if (content.description && content.description.length > 500) score += 0.1;
    if (content.metadata && Object.keys(content.metadata).length > 5) score += 0.1;

    return Math.min(1, score);
  }

  private calculateUrgency(content: any): number {
    // Check for deadline or time-sensitive content
    if (content.deadline) {
      const timeUntilDeadline = new Date(content.deadline).getTime() - Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;
      
      if (timeUntilDeadline < dayInMs) return 1;
      if (timeUntilDeadline < 3 * dayInMs) return 0.8;
      if (timeUntilDeadline < 7 * dayInMs) return 0.6;
      if (timeUntilDeadline < 30 * dayInMs) return 0.4;
    }

    // Check for urgency keywords
    const urgentKeywords = ['urgent', 'deadline', 'limited', 'expires', 'ending', 'last chance'];
    const text = `${content.title || ''} ${content.description || ''}`.toLowerCase();
    
    let urgencyScore = 0;
    urgentKeywords.forEach(keyword => {
      if (text.includes(keyword)) urgencyScore += 0.2;
    });

    return Math.min(1, urgencyScore);
  }

  private async calculateFinalScore(factors: PriorityFactors): Promise<number> {
    switch (this.config.strategy) {
      case SchedulingStrategy.WEIGHTED:
        return this.calculateWeightedScore(factors);
      
      case SchedulingStrategy.ADAPTIVE:
        return await this.model.predict(factors);
      
      case SchedulingStrategy.HYBRID:
        const weighted = this.calculateWeightedScore(factors);
        const predicted = await this.model.predict(factors);
        return (weighted * 0.7 + predicted * 0.3);
      
      default:
        return this.calculateWeightedScore(factors);
    }
  }

  private calculateWeightedScore(factors: PriorityFactors): number {
    const w = this.config.weights;
    
    return (
      factors.relevanceScore * w.relevance +
      factors.freshnessScore * w.freshness +
      factors.engagementPotential * w.engagement +
      factors.sourceTrust * w.trust +
      factors.trendingScore * w.trending +
      factors.uniquenessScore * w.uniqueness +
      factors.completenessScore * w.completeness +
      factors.urgencyScore * w.urgency
    );
  }

  private scoreToPriority(score: number): ContentPriority {
    if (score >= 0.9) return ContentPriority.EMERGENCY;
    if (score >= 0.75) return ContentPriority.HIGH;
    if (score >= 0.5) return ContentPriority.MEDIUM;
    if (score >= 0.25) return ContentPriority.LOW;
    return ContentPriority.BACKLOG;
  }

  private explainPriority(factors: PriorityFactors, score: number): string[] {
    const reasons: string[] = [];

    if (factors.relevanceScore > 0.8) {
      reasons.push('Highly relevant content');
    }
    if (factors.freshnessScore > 0.9) {
      reasons.push('Very fresh/recent content');
    }
    if (factors.engagementPotential > 0.7) {
      reasons.push('High engagement potential');
    }
    if (factors.sourceTrust > 0.8) {
      reasons.push('Trusted source');
    }
    if (factors.trendingScore > 0.6) {
      reasons.push('Matches trending topics');
    }
    if (factors.uniquenessScore > 0.8) {
      reasons.push('Unique content');
    }
    if (factors.urgencyScore > 0.7) {
      reasons.push('Time-sensitive content');
    }

    if (score > 0.9) {
      reasons.push('Critical priority score');
    }

    return reasons;
  }

  private applyRules(content: PrioritizedContent): PrioritizedContent {
    for (const rule of this.config.rules) {
      if (this.evaluateRuleCondition(rule.condition, content)) {
        content = this.applyRuleAction(rule.action, content);
      }
    }
    return content;
  }

  private evaluateRuleCondition(
    condition: any,
    content: PrioritizedContent
  ): boolean {
    const value = this.getFieldValue(condition.field, content);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'greater_than':
        return value > condition.value;
      case 'less_than':
        return value < condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      default:
        return false;
    }
  }

  private getFieldValue(field: string, content: PrioritizedContent): any {
    if (field.startsWith('factors.')) {
      const factorName = field.substring(8);
      return (content.factors as any)[factorName];
    }
    if (field.startsWith('content.')) {
      const contentField = field.substring(8);
      return content.content[contentField];
    }
    return (content as any)[field];
  }

  private applyRuleAction(
    action: any,
    content: PrioritizedContent
  ): PrioritizedContent {
    switch (action.type) {
      case 'boost':
        content.finalScore = Math.min(1, content.finalScore * (1 + action.value));
        content.reasoning?.push(`Boosted by rule: +${action.value * 100}%`);
        break;
      
      case 'suppress':
        content.finalScore = Math.max(0, content.finalScore * (1 - action.value));
        content.reasoning?.push(`Suppressed by rule: -${action.value * 100}%`);
        break;
      
      case 'block':
        content.finalScore = 0;
        content.priority = ContentPriority.BACKLOG;
        content.reasoning?.push('Blocked by rule');
        break;
      
      case 'schedule':
        content.scheduledTime = new Date(action.value);
        content.reasoning?.push(`Scheduled for ${action.value}`);
        break;
    }

    // Recalculate priority after rule application
    content.priority = this.scoreToPriority(content.finalScore);
    
    return content;
  }

  async scheduleContent(
    content: PrioritizedContent[],
    startTime?: Date
  ): Promise<ScheduleSlot[]> {
    const slots: ScheduleSlot[] = [];
    const start = startTime || new Date();
    const { slotsPerHour, bufferMinutes } = this.config.scheduling;
    const slotDuration = 60 / slotsPerHour; // minutes per slot

    let currentTime = new Date(start);
    
    for (const item of content) {
      // Skip if already scheduled
      if (item.scheduledTime) {
        slots.push({
          id: `slot_${Date.now()}_${Math.random()}`,
          contentId: item.id,
          scheduledTime: item.scheduledTime,
          priority: item.priority,
          strategy: this.config.strategy,
          locked: false,
        });
        continue;
      }

      // Find next available slot
      while (this.isSlotOccupied(currentTime)) {
        currentTime = new Date(currentTime.getTime() + slotDuration * 60000);
      }

      const slot: ScheduleSlot = {
        id: `slot_${Date.now()}_${Math.random()}`,
        contentId: item.id,
        scheduledTime: new Date(currentTime),
        priority: item.priority,
        strategy: this.config.strategy,
        locked: false,
        metadata: {
          score: item.finalScore,
          reasoning: item.reasoning,
        },
      };

      slots.push(slot);
      this.schedule.set(slot.id, slot);

      // Move to next slot with buffer
      currentTime = new Date(
        currentTime.getTime() + (slotDuration + bufferMinutes) * 60000
      );
    }

    // Save schedule to database
    await this.saveSchedule(slots);

    this.emit('content:scheduled', {
      count: slots.length,
      nextSlot: slots[0]?.scheduledTime,
    });

    return slots;
  }

  private isSlotOccupied(time: Date): boolean {
    const tolerance = 5 * 60000; // 5 minutes
    
    for (const slot of this.schedule.values()) {
      const diff = Math.abs(slot.scheduledTime.getTime() - time.getTime());
      if (diff < tolerance) return true;
    }
    
    return false;
  }

  private async saveSchedule(slots: ScheduleSlot[]): Promise<void> {
    try {
      const records = slots.map(slot => ({
        id: slot.id,
        content_id: slot.contentId,
        scheduled_time: slot.scheduledTime.toISOString(),
        priority: slot.priority,
        strategy: slot.strategy,
        locked: slot.locked,
        metadata: slot.metadata,
        created_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('content_schedule')
        .upsert(records);

      if (error) throw error;
    } catch (error) {
      console.error('[Prioritizer] Error saving schedule:', error);
    }
  }

  private async processSchedule(): Promise<void> {
    const now = new Date();
    const upcoming: ScheduleSlot[] = [];

    // Find slots that are due
    this.schedule.forEach(slot => {
      if (slot.scheduledTime <= now && !slot.locked) {
        upcoming.push(slot);
      }
    });

    if (upcoming.length === 0) return;

    // Process scheduled content
    for (const slot of upcoming) {
      try {
        await this.publishContent(slot);
        
        // Remove from schedule
        this.schedule.delete(slot.id);
        
        // Mark as published in database
        await supabase
          .from('content_schedule')
          .update({ 
            published: true,
            published_at: new Date().toISOString(),
          })
          .eq('id', slot.id);

      } catch (error) {
        console.error(`[Prioritizer] Error publishing scheduled content:`, error);
      }
    }

    this.emit('schedule:processed', {
      count: upcoming.length,
      slots: upcoming.map(s => s.id),
    });
  }

  private async publishContent(slot: ScheduleSlot): Promise<void> {
    // Move content from queue to approved
    await supabase
      .from('content_queue')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        priority: slot.priority,
      })
      .eq('id', slot.contentId);

    this.emit('content:published', {
      contentId: slot.contentId,
      scheduledTime: slot.scheduledTime,
      actualTime: new Date(),
    });
  }

  async updatePriority(contentId: string, newPriority: ContentPriority): Promise<void> {
    // Find in queue
    const item = this.contentQueue.find(c => c.id === contentId);
    if (item) {
      item.priority = newPriority;
      
      // Update in database
      await supabase
        .from('content_queue')
        .update({ priority: newPriority })
        .eq('id', contentId);
    }
  }

  async trainModel(feedback: Array<{ contentId: string; actualEngagement: number }>) {
    // Collect training data
    const trainingData: Array<{ factors: PriorityFactors; score: number }> = [];

    for (const item of feedback) {
      const content = this.contentQueue.find(c => c.id === item.contentId);
      if (content) {
        trainingData.push({
          factors: content.factors,
          score: item.actualEngagement,
        });
      }
    }

    if (trainingData.length > 0) {
      await this.model.train(trainingData);
      
      // Save updated model
      if (this.config.mlModelPath) {
        await this.model.save(this.config.mlModelPath);
      }
    }
  }

  async addRule(rule: PriorityRule): Promise<void> {
    this.config.rules.push(rule);
    
    // Save to database
    await supabase
      .from('priority_rules')
      .insert({
        ...rule,
        created_at: new Date().toISOString(),
      });

    this.emit('rule:added', rule);
  }

  async removeRule(ruleId: string): Promise<void> {
    this.config.rules = this.config.rules.filter(r => r.id !== ruleId);
    
    // Remove from database
    await supabase
      .from('priority_rules')
      .delete()
      .eq('id', ruleId);

    this.emit('rule:removed', ruleId);
  }

  async updateSourceTrust(source: string, trustScore: number): Promise<void> {
    this.sourceReliability.set(source, trustScore);
    
    // Update in database
    await supabase
      .from('source_reliability')
      .upsert({
        source,
        trust_score: trustScore,
        updated_at: new Date().toISOString(),
      });
  }

  async updateTrendingTopics(topics: string[]): Promise<void> {
    this.trendingTopics = new Set(topics.map(t => t.toLowerCase()));
    
    // Update in database
    const records = topics.map((topic, index) => ({
      topic,
      trending_score: 1 - (index * 0.02), // Decreasing score by rank
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from('trending_topics')
      .upsert(records);
  }

  getSchedule(hours: number = 24): ScheduleSlot[] {
    const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    return Array.from(this.schedule.values())
      .filter(slot => slot.scheduledTime <= cutoff)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  getQueueStatus(): any {
    const byPriority = new Map<ContentPriority, number>();
    
    this.contentQueue.forEach(item => {
      const count = byPriority.get(item.priority) || 0;
      byPriority.set(item.priority, count + 1);
    });

    return {
      total: this.contentQueue.length,
      byPriority: Object.fromEntries(byPriority),
      scheduled: this.schedule.size,
      nextPublish: Array.from(this.schedule.values())
        .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())[0]?.scheduledTime,
    };
  }

  async stop(): Promise<void> {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    
    this.isRunning = false;
    this.emit('scheduler:stopped');
  }
}

// Export singleton
export const contentPrioritizer = new ContentPrioritizer();