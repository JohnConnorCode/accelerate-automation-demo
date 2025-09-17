/**
 * Health Check Endpoint
 * Provides system status for monitoring
 */

import { Request, Response } from 'express';
import { supabase } from '../lib/typed-supabase';

export default async function handler(req: Request, res: Response) {
  const startTime = Date.now();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: false,
      queues: false,
      dataFlow: false
    },
    metrics: {
      queueProjects: 0,
      queueNews: 0,
      queueInvestors: 0,
      totalQueued: 0,
      responseTime: 0
    },
    errors: [] as string[]
  };

  try {
    // Check database connectivity
    const { error: dbError } = await supabase
      .from('queue_projects')
      .select('id')
      .limit(1);
    
    if (!dbError) {
      health.checks.database = true;
    } else {
      health.errors.push(`Database: ${dbError.message}`);
      health.status = 'degraded';
    }

    // Check queue tables
    const { count: projectCount } = await supabase
      .from('queue_projects')
      .select('*', { count: 'exact', head: true });
    
    const { count: newsCount } = await supabase
      .from('queue_news')
      .select('*', { count: 'exact', head: true });
    
    const { count: investorCount } = await supabase
      .from('queue_investors')
      .select('*', { count: 'exact', head: true });
    
    health.metrics.queueProjects = projectCount || 0;
    health.metrics.queueNews = newsCount || 0;
    health.metrics.queueInvestors = investorCount || 0;
    health.metrics.totalQueued = (projectCount || 0) + (newsCount || 0) + (investorCount || 0);
    
    if (health.metrics.totalQueued > 0) {
      health.checks.queues = true;
    }
    
    // Check if data is recent (within last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { count: recentCount } = await supabase
      .from('queue_news')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', yesterday.toISOString());
    
    if (recentCount && recentCount > 0) {
      health.checks.dataFlow = true;
    } else {
      health.status = 'degraded';
      health.errors.push('No recent data in last 24 hours');
    }
    
  } catch (error) {
    health.status = 'unhealthy';
    health.errors.push(`System error: ${error}`);
  }

  // Calculate response time
  health.metrics.responseTime = Date.now() - startTime;
  
  // Set overall status
  if (health.errors.length > 2) {
    health.status = 'unhealthy';
  }
  
  // Set appropriate HTTP status code
  const statusCode = health.status === 'healthy' ? 200 : 
                     health.status === 'degraded' ? 207 : 503;

  res.status(statusCode).json(health);
}