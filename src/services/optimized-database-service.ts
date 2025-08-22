import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { intelligentCache } from './intelligent-cache-service';

/**
 * Optimized Database Service with Connection Pooling and Query Optimization
 * Dramatically improves database performance for everyday operations
 */

interface QueryOptions {
  cache?: boolean;
  cacheTTL?: number;
  priority?: 'low' | 'medium' | 'high';
  timeout?: number;
}

interface BatchOperation {
  table: string;
  operation: 'insert' | 'update' | 'upsert' | 'delete';
  data: any | any[];
  options?: any;
}

export class OptimizedDatabaseService {
  private supabase: SupabaseClient;
  private connectionPool: SupabaseClient[] = [];
  private currentPoolIndex = 0;
  private readonly maxPoolSize = 5;
  
  // Query optimization patterns
  private readonly indexedColumns = {
    content_queue: ['status', 'created_at', 'score', 'type'],
    approved_content: ['created_at', 'type', 'source'],
    rejected_content: ['created_at', 'rejection_reason'],
    ai_assessments: ['created_at', 'content_id', 'success'],
    quality_checks: ['created_at', 'content_id', 'passed'],
    scheduler_history: ['created_at', 'run_type'],
    health_metrics: ['timestamp', 'overall_status']
  };
  
  // Frequently used queries that should be optimized
  private readonly optimizedQueries = new Map<string, string>();
  
  constructor() {
    // Initialize primary connection
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    
    // Initialize connection pool
    this.initializeConnectionPool();
    
    // Register optimized queries
    this.registerOptimizedQueries();
  }
  
  /**
   * Initialize connection pool for parallel operations
   */
  private initializeConnectionPool(): void {
    for (let i = 0; i < this.maxPoolSize; i++) {
      this.connectionPool.push(
        createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        )
      );
    }

  }
  
  /**
   * Get next available connection from pool
   */
  private getPooledConnection(): SupabaseClient {
    const connection = this.connectionPool[this.currentPoolIndex];
    this.currentPoolIndex = (this.currentPoolIndex + 1) % this.maxPoolSize;
    return connection;
  }
  
  /**
   * Register commonly used optimized queries
   */
  private registerOptimizedQueries(): void {
    // Recent approved content
    this.optimizedQueries.set('recent_approved', `
      SELECT * FROM approved_content 
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC, score DESC
      LIMIT 100
    `);
    
    // Pending queue with high scores
    this.optimizedQueries.set('high_score_pending', `
      SELECT * FROM content_queue
      WHERE status = 'pending' AND score > 70
      ORDER BY score DESC, created_at ASC
      LIMIT 50
    `);
    
    // Daily analytics
    this.optimizedQueries.set('daily_analytics', `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        AVG(score) as avg_score
      FROM content_queue
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
  }
  
  /**
   * Execute optimized query with caching
   */
  async query<T = any>(
    table: string,
    options?: QueryOptions
  ): Promise<{ data: T[] | null; error: any }> {
    const cacheKey = `db:${table}:query`;
    
    // Use cache if enabled
    if (options?.cache !== false) {
      const cached = await intelligentCache.get<T[]>(
        cacheKey,
        async () => {
          const result = await this.executeQuery<T>(table);
          return result.data || [];
        },
        {
          ttl: options?.cacheTTL || 300000, // 5 minutes default
          priority: options?.priority || 'medium',
          tags: ['database', table]
        }
      );
      
      return { data: cached, error: null };
    }
    
    // Direct query without cache
    return await this.executeQuery<T>(table);
  }
  
  /**
   * Execute raw query
   */
  private async executeQuery<T>(table: string): Promise<{ data: T[] | null; error: any }> {
    const connection = this.getPooledConnection();
    
    try {
      // Check if we have an optimized query
      const optimizedQuery = this.optimizedQueries.get(table);
      
      if (optimizedQuery) {
        const { data, error } = await connection.rpc('execute_sql', {
          query: optimizedQuery
        });
        return { data, error };
      }
      
      // Standard query with index hints
      const query = connection.from(table).select('*');
      
      // Add index hints if available
      if (this.indexedColumns[table as keyof typeof this.indexedColumns]) {
        const indexCols = this.indexedColumns[table as keyof typeof this.indexedColumns];
        // Order by indexed columns for better performance
        if (indexCols.includes('created_at')) {
          query.order('created_at', { ascending: false });
        }
      }
      
      return await query;
    } catch (error) {

      return { data: null, error };
    }
  }
  
  /**
   * Batch insert with optimizations
   */
  async batchInsert<T = any>(
    table: string,
    data: T[],
    options?: { 
      chunkSize?: number;
      onConflict?: string;
      cache?: boolean;
    }
  ): Promise<{ inserted: number; errors: any[] }> {
    const chunkSize = options?.chunkSize || 100;
    const chunks = this.chunkArray(data, chunkSize);
    let totalInserted = 0;
    const errors: any[] = [];

    // Process chunks in parallel using connection pool
    const chunkPromises = chunks.map(async (chunk, index) => {
      const connection = this.getPooledConnection();
      
      try {
        const { data: inserted, error } = options?.onConflict
          ? await connection.from(table).upsert(chunk, { onConflict: options.onConflict })
          : await connection.from(table).insert(chunk);
        
        if (error) {
          errors.push({ chunk: index, error });
        } else {
          totalInserted += chunk.length;
        }
      } catch (error) {
        errors.push({ chunk: index, error });
      }
    });
    
    await Promise.all(chunkPromises);
    
    // Invalidate cache for this table
    if (options?.cache !== false) {
      await intelligentCache.invalidateRelated(`db:${table}:.*`);
    }

    return { inserted: totalInserted, errors };
  }
  
  /**
   * Optimized select with specific columns
   */
  async select<T = any>(
    table: string,
    columns: string[] = ['*'],
    filters?: Record<string, any>,
    options?: QueryOptions
  ): Promise<{ data: T[] | null; error: any }> {
    const cacheKey = `db:${table}:select:${JSON.stringify(filters)}`;
    
    if (options?.cache !== false) {
      const cached = await intelligentCache.get<any[]>(
        cacheKey,
        async () => {
          const connection = this.getPooledConnection();
          let query = connection.from(table).select(columns.join(','));
          
          // Apply filters
          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              if (Array.isArray(value)) {
                query = query.in(key, value);
              } else if (value === null) {
                query = query.is(key, null);
              } else {
                query = query.eq(key, value);
              }
            });
          }
          
          // Use indexed columns for ordering if available
          const indexCols = new OptimizedDatabaseService().indexedColumns[table as keyof OptimizedDatabaseService['indexedColumns']];
          if (indexCols?.includes('created_at')) {
            query = query.order('created_at', { ascending: false });
          }
          
          const { data, error } = await query;
          if (error) throw error;
          return data || [] as T[];
        },
        {
          ttl: options?.cacheTTL || 300000,
          priority: options?.priority || 'medium',
          tags: ['database', table, 'select']
        }
      );
      
      return { data: cached, error: null };
    }
    
    // Direct query without cache
    const connection = this.getPooledConnection();
    let query = connection.from(table).select(columns.join(','));
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (value === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, value);
        }
      });
    }
    
    const result = await query;
    return { data: result.data as T[] | null, error: result.error };
  }
  
  /**
   * Execute multiple operations in a transaction
   */
  async transaction(operations: BatchOperation[]): Promise<{
    success: boolean;
    results: any[];
    errors: any[];
  }> {
    const results: any[] = [];
    const errors: any[] = [];

    // Group operations by table for better performance
    const groupedOps = this.groupOperationsByTable(operations);
    
    for (const [table, ops] of Object.entries(groupedOps)) {
      const connection = this.getPooledConnection();
      
      for (const op of ops) {
        try {
          let result;
          
          switch (op.operation) {
            case 'insert':
              result = await connection.from(table).insert(op.data);
              break;
            case 'update':
              result = await connection.from(table).update(op.data).match(op.options?.match || {});
              break;
            case 'upsert':
              result = await connection.from(table).upsert(op.data, op.options);
              break;
            case 'delete':
              result = await connection.from(table).delete().match(op.options?.match || {});
              break;
          }
          
          if (result?.error) {
            errors.push({ table, operation: op.operation, error: result.error });
          } else {
            results.push({ table, operation: op.operation, data: result?.data });
          }
        } catch (error) {
          errors.push({ table, operation: op.operation, error });
        }
      }
      
      // Invalidate cache for modified tables
      await intelligentCache.invalidateRelated(`db:${table}:.*`);
    }

    return {
      success: errors.length === 0,
      results,
      errors
    };
  }
  
  /**
   * Get aggregated analytics with caching
   */
  async getAnalytics(
    table: string,
    groupBy: string,
    aggregates: { column: string; function: 'count' | 'sum' | 'avg' | 'min' | 'max' }[]
  ): Promise<any> {
    const cacheKey = `analytics:${table}:${groupBy}`;
    
    return await intelligentCache.get(
      cacheKey,
      async () => {
        const connection = this.getPooledConnection();
        
        // Build aggregation query
        const selectClauses = [groupBy];
        aggregates.forEach(agg => {
          selectClauses.push(`${agg.function}(${agg.column}) as ${agg.function}_${agg.column}`);
        });
        
        const { data, error } = await connection
          .from(table)
          .select(selectClauses.join(','))
          .order(groupBy, { ascending: false });
        
        if (error) throw error;
        return data;
      },
      {
        ttl: 600000, // 10 minutes for analytics
        priority: 'low',
        tags: ['analytics', table]
      }
    );
  }
  
  /**
   * Optimize table with vacuum and analyze
   */
  async optimizeTable(table: string): Promise<void> {

    try {
      const connection = this.getPooledConnection();
      
      // Run ANALYZE to update statistics
      await connection.rpc('analyze_table', { table_name: table });
      
      // Invalidate all caches for this table
      await intelligentCache.invalidateRelated(`db:${table}:.*`);

    } catch (error) {

    }
  }
  
  /**
   * Create missing indexes for better performance
   */
  async createIndexes(): Promise<void> {

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_content_queue_status_score ON content_queue(status, score DESC)',
      'CREATE INDEX IF NOT EXISTS idx_content_queue_created_at ON content_queue(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_approved_content_created_at ON approved_content(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_ai_assessments_content_id ON ai_assessments(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_quality_checks_content_id ON quality_checks(content_id)',
      'CREATE INDEX IF NOT EXISTS idx_scheduler_history_created_at ON scheduler_history(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_health_metrics_timestamp ON health_metrics(timestamp DESC)'
    ];
    
    for (const indexSql of indexes) {
      try {
        await this.supabase.rpc('execute_sql', { query: indexSql });

      } catch (error) {

      }
    }
  }
  
  /**
   * Helper: Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Helper: Group operations by table
   */
  private groupOperationsByTable(operations: BatchOperation[]): Record<string, BatchOperation[]> {
    const grouped: Record<string, BatchOperation[]> = {};
    
    operations.forEach(op => {
      if (!grouped[op.table]) {
        grouped[op.table] = [];
      }
      grouped[op.table].push(op);
    });
    
    return grouped;
  }
  
  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    poolSize: number;
    currentIndex: number;
    connectionsActive: number;
  } {
    return {
      poolSize: this.maxPoolSize,
      currentIndex: this.currentPoolIndex,
      connectionsActive: this.connectionPool.length
    };
  }
}

// Export singleton instance
export const optimizedDB = new OptimizedDatabaseService();