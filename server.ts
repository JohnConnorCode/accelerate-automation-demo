import dotenv from 'dotenv'
// Load environment variables FIRST before any other imports
dotenv.config({ path: '.env' })
dotenv.config({ path: '.env.local' }) // Also load .env.local which might have additional keys

import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { contentServiceV2 } from './src/services/contentServiceV2'
import { supabase } from './src/lib/supabase'
import { requireApiKey, rateLimit } from './src/middleware/auth'
import { requireAdmin, verifyToken } from './src/middleware/authJWT'
import { logger, logAuditEvent, logError } from './src/services/logger'
import { scheduler } from './src/services/scheduler'
import { metricsService } from './src/services/metrics'
import { monitoringService } from './src/services/monitoring-service'
import { cacheService } from './src/services/cache-service'
import { processManager } from './src/utils/process-manager'

// Initialize process manager for error recovery
processManager.initialize()

const app = express()
const PORT = process.env.PORT || 3002

// Initialize scheduler
scheduler.initialize()

// Security: Restrict CORS in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3001', 'http://localhost:3002'],
  credentials: true
}

app.use(cors(corsOptions))
app.use(express.json())

// Error handler for malformed JSON
app.use((err: any, req: Request, res: Response, next: Function) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON',
      error: 'Request body must be valid JSON'
    });
  }
  next();
})

// Apply rate limiting to all routes
app.use(rateLimit(100, 60000)) // 100 requests per minute

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'content-automation-api'
  })
})

// Monitoring dashboard endpoint
app.get('/api/monitoring', async (req, res) => {
  try {
    const dashboard = await monitoringService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    logger.error('Failed to get monitoring dashboard', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
})

// System health endpoint
app.get('/api/monitoring/health', async (req, res) => {
  try {
    const health = await monitoringService.getSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : 
                       health.status === 'degraded' ? 503 : 500;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
})

// Cache management endpoint
app.post('/api/cache/clear', (req, res) => {
  cacheService.clearAll();
  logger.info('Cache cleared via API');
  res.json({ success: true, message: 'Cache cleared' });
});

// Status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const stats = await contentServiceV2.getStats()
    res.json({
      status: 'operational',
      uptime: process.uptime(),
      stats
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Test manual controls endpoint
app.post('/api/test-controls', async (req, res) => {
  const { testManualControls } = await import('./src/api/test-controls')
  return testManualControls(req, res)
})

// Dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
  try {
    const stats = await contentServiceV2.getStats()
    const { data: queueItems } = await supabase
      .from('content_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    res.json({
      stats,
      items: queueItems || [],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const { data: analytics } = await supabase
      .from('content_queue')
      .select('status, category, created_at')
    
    const statusCounts = analytics?.reduce((acc: any, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1
      return acc
    }, {})
    
    const categoryCounts = analytics?.reduce((acc: any, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {})
    
    res.json({
      totalItems: analytics?.length || 0,
      statusBreakdown: statusCounts || {},
      categoryBreakdown: categoryCounts || {},
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Admin operations endpoint - PROTECTED with JWT
app.post('/api/admin', requireAdmin, async (req, res) => {
  try {
    const { action, items, ids } = req.body
    
    switch (action) {
      case 'queue':
        if (!items || !Array.isArray(items)) {
          return res.status(400).json({ error: 'Items array required' })
        }
        
        const queueResults = await Promise.all(
          items.map(item => contentServiceV2.addToQueue(item))
        )
        
        // Audit log the action
        logAuditEvent(
          req.user!.id,
          'QUEUE_CONTENT',
          'content_queue',
          { 
            itemCount: items.length,
            success: queueResults.filter(r => r.success).length,
            ip: req.ip,
            userAgent: req.headers['user-agent']
          }
        )
        
        res.json({ 
          success: true, 
          queued: queueResults.filter(r => r.success).length,
          failed: queueResults.filter(r => !r.success).length
        })
        break
        
      case 'approve':
        if (!ids || !Array.isArray(ids)) {
          return res.status(400).json({ error: 'IDs array required' })
        }
        
        const approveResults = await Promise.all(
          ids.map(id => contentServiceV2.processQueueItem(id, 'approve'))
        )
        
        res.json({
          success: true,
          approved: approveResults.filter(r => r.success).length,
          failed: approveResults.filter(r => !r.success).length
        })
        break
        
      case 'reject':
        if (!ids || !Array.isArray(ids)) {
          return res.status(400).json({ error: 'IDs array required' })
        }
        
        const rejectResults = await Promise.all(
          ids.map(id => contentServiceV2.processQueueItem(id, 'reject'))
        )
        
        res.json({
          success: true,
          rejected: rejectResults.filter(r => r.success).length,
          failed: rejectResults.filter(r => !r.success).length
        })
        break
        
      default:
        res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Enrichment endpoint
app.post('/api/enrich', async (req, res) => {
  try {
    const { id, options } = req.body
    
    if (!id) {
      return res.status(400).json({ error: 'ID required' })
    }
    
    // Get the item from queue
    const { data: item, error } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', id)
      .single()
    
    if (error || !item) {
      return res.status(404).json({ error: 'Item not found' })
    }
    
    // Check if OpenAI key is configured
    const apiKey = process.env.OPENAI_API_KEY || 
                   (typeof window !== 'undefined' ? localStorage.getItem('openai_api_key') : null)
    
    if (!apiKey) {
      return res.json({
        success: false,
        message: 'OpenAI API key not configured. Add it in Settings to enable enrichment.',
        item
      })
    }
    
    // Here we would normally call the enrichment service
    // For now, return a mock enriched response
    res.json({
      success: true,
      enriched: true,
      item: {
        ...item,
        enrichment_data: {
          aiAnalysis: options?.aiAnalysis ? 'High quality content relevant to builders' : null,
          keywords: options?.keywords ? ['AI', 'startup', 'innovation'] : null,
          sentiment: 'positive',
          quality_score: 85
        },
        enriched_at: new Date().toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// AI assessment endpoint
app.post('/api/ai-assess', async (req, res) => {
  try {
    const { content } = req.body
    
    if (!content) {
      return res.status(400).json({ error: 'Content required' })
    }
    
    // Validate the content
    const validation = contentServiceV2.validateContent(content)
    
    if (!validation.isValid) {
      return res.json({
        success: false,
        errors: validation.errors,
        assessment: null
      })
    }
    
    // Mock AI assessment (would normally use GPT-4)
    const assessment = {
      quality_score: 82,
      relevance: 'high',
      insights: [
        'Content is highly relevant to the builder community',
        'Contains innovative technology concepts',
        'Good potential for engagement'
      ],
      recommendations: [
        'Consider adding more technical details',
        'Include team information if available'
      ],
      categories_suggested: ['AI/ML', 'Healthcare Tech'],
      auto_approve: false
    }
    
    res.json({
      success: true,
      assessment,
      validation
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Performance report endpoint with real metrics
app.get('/api/performance', async (req, res) => {
  try {
    const stats = await contentServiceV2.getStats()
    const metrics = await metricsService.getPerformanceSummary()
    
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats,
      performance: metrics.metrics,
      health: metrics.health,
      lastFetch: metrics.lastFetch,
      totalProcessed: metrics.totalProcessed
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Search endpoint
app.post('/api/search', async (req, res) => {
  try {
    const { query } = req.body
    
    if (!query) {
      return res.status(400).json({ error: 'Query required' })
    }
    
    const { data: results, error } = await supabase
      .from('content_queue')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20)
    
    if (error) {
      throw error
    }
    
    res.json({
      query,
      results: results || [],
      count: results?.length || 0
    })
  } catch (error) {
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Scheduler endpoints
// Temporarily removing auth for development - TODO: Re-enable for production
app.get('/api/scheduler/status', async (req, res) => {
  const tasks = scheduler.getActiveTasks();
  res.json({
    active: true,
    tasks,
    count: tasks.length
  });
});

app.post('/api/scheduler/run', async (req, res) => {
  const { task } = req.body;
  
  try {
    const result = await scheduler.runTaskNow(task);
    // Log without user ID for now
    logger.info('Manual task run', { task, result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Task run failed', { task, error });
    res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Approval endpoint
app.post('/api/approve', async (req, res) => {
  try {
    // Input sanitization - prevent crashes from malformed data
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request format',
        error: 'Request body must be a JSON object'
      });
    }
    
    // Sanitize string fields to prevent injection
    const sanitizedBody = {
      id: req.body.id,
      type: typeof req.body.type === 'string' ? req.body.type.replace(/[^a-z_]/gi, '') : req.body.type,
      action: typeof req.body.action === 'string' ? req.body.action.replace(/[^a-z]/gi, '') : req.body.action,
      reviewerNotes: typeof req.body.reviewerNotes === 'string' ? req.body.reviewerNotes : undefined,
      reviewedBy: typeof req.body.reviewedBy === 'string' ? req.body.reviewedBy : undefined
    };
    
    const { approvalService } = await import('./src/services/approval-service');
    const result = await approvalService.processApproval(sanitizedBody);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logger.error('Approval failed', { error });
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get pending items for review
app.get('/api/pending', async (req, res) => {
  try {
    const { approvalService } = await import('./src/services/approval-service');
    const { type } = req.query;
    const pending = await approvalService.getPendingItems(type as string);
    res.json(pending);
  } catch (error) {
    logger.error('Failed to get pending items', { error });
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get available data sources
app.get('/api/sources', async (req, res) => {
  try {
    const sources = [
      { name: 'GitHub Trending', active: true, type: 'projects' },
      { name: 'HackerNews', active: true, type: 'news' },
      { name: 'Product Hunt', active: false, type: 'projects', note: 'API key required' },
      { name: 'CrunchBase', active: false, type: 'projects', note: 'API key required' },
      { name: 'AngelList', active: false, type: 'investors', note: 'API key required' },
      { name: 'RSS Feeds', active: true, type: 'news' },
      { name: 'Manual Entry', active: true, type: 'all' }
    ];
    
    res.json({
      sources,
      total: sources.length,
      active: sources.filter(s => s.active).length,
      inactive: sources.filter(s => !s.active).length
    });
  } catch (error) {
    logger.error('Failed to get sources', { error });
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get queue items by type
app.get('/api/queue/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['projects', 'investors', 'news'];
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      });
    }
    
    const { data, error } = await supabase
      .from(`queue_${type}`)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      throw error;
    }
    
    res.json(data || []);
  } catch (error) {
    logger.error('Failed to get queue items', { error });
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
  console.log('Available endpoints:')
  console.log('  GET  /api/health')
  console.log('  GET  /api/monitoring')
  console.log('  GET  /api/monitoring/health')
  console.log('  GET  /api/status')
  console.log('  GET  /api/dashboard')
  console.log('  GET  /api/analytics')
  console.log('  GET  /api/performance')
  console.log('  POST /api/admin')
  console.log('  POST /api/enrich')
  console.log('  POST /api/ai-assess')
  console.log('  POST /api/search')
  console.log('  GET  /api/scheduler/status')
  console.log('  POST /api/scheduler/run')
})

// Register graceful shutdown
processManager.onShutdown(async () => {
  logger.info('Closing server connections...');
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});