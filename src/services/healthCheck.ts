import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { logger } from './logger';
import os from 'os';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  services: {
    database: ServiceHealth
    api: ServiceHealth
    auth: ServiceHealth
    storage: ServiceHealth
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      load: number[]
      cores: number
    }
    disk: {
      used: number
      free: number
    }
  }
  metrics: {
    requestsPerMinute: number
    averageResponseTime: number
    errorRate: number
    activeUsers: number
  }
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
}

// Track metrics
const metrics = {
  requests: [] as number[],
  responseTimes: [] as number[],
  errors: [] as number[],
  users: new Set<string>()
};

/**
 * Check database health
 */
const checkDatabase = async (): Promise<ServiceHealth> => {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)
      .single();
    
    if (error) {throw error;}
    
    return {
      status: 'up',
      responseTime: Date.now() - start
    };
  } catch (error) {
    logger.error('Database health check failed', { error });
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Check auth service health
 */
const checkAuth = async (): Promise<ServiceHealth> => {
  const start = Date.now();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    return {
      status: 'up',
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Get system metrics
 */
const getSystemMetrics = () => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  return {
    memory: {
      used: Math.round(usedMemory / 1024 / 1024), // MB
      total: Math.round(totalMemory / 1024 / 1024), // MB
      percentage: Math.round((usedMemory / totalMemory) * 100)
    },
    cpu: {
      load: os.loadavg(),
      cores: os.cpus().length
    },
    disk: {
      used: 0, // Would need additional library for disk usage
      free: 0
    }
  };
};

/**
 * Calculate request metrics
 */
const getRequestMetrics = () => {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Filter metrics to last minute
  const recentRequests = metrics.requests.filter(t => t > oneMinuteAgo);
  const recentErrors = metrics.errors.filter(t => t > oneMinuteAgo);
  const recentResponseTimes = metrics.responseTimes.filter(t => t > 0);
  
  return {
    requestsPerMinute: recentRequests.length,
    averageResponseTime: recentResponseTimes.length > 0 
      ? Math.round(recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length)
      : 0,
    errorRate: recentRequests.length > 0
      ? Math.round((recentErrors.length / recentRequests.length) * 100)
      : 0,
    activeUsers: metrics.users.size
  };
};

/**
 * Perform comprehensive health check
 */
export const performHealthCheck = async (): Promise<HealthStatus> => {
  const [database, auth] = await Promise.all([
    checkDatabase(),
    checkAuth()
  ]);
  
  const services = {
    database,
    api: { status: 'up' as const },
    auth,
    storage: { status: 'up' as const }
  };
  
  // Determine overall status
  const serviceStatuses = Object.values(services).map(s => s.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  
  if (serviceStatuses.includes('down')) {
    overallStatus = 'unhealthy';
  } else if (serviceStatuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
    system: getSystemMetrics(),
    metrics: getRequestMetrics()
  };
};

/**
 * Track request metrics
 */
export const trackRequest = (userId?: string, responseTime?: number, error?: boolean) => {
  const now = Date.now();
  
  metrics.requests.push(now);
  
  if (responseTime) {
    metrics.responseTimes.push(responseTime);
  }
  
  if (error) {
    metrics.errors.push(now);
  }
  
  if (userId) {
    metrics.users.add(userId);
  }
  
  // Clean up old metrics (keep last 5 minutes)
  const fiveMinutesAgo = now - 300000;
  metrics.requests = metrics.requests.filter(t => t > fiveMinutesAgo);
  metrics.errors = metrics.errors.filter(t => t > fiveMinutesAgo);
  
  // Keep only last 100 response times
  if (metrics.responseTimes.length > 100) {
    metrics.responseTimes = metrics.responseTimes.slice(-100);
  }
};

/**
 * Clear inactive users from metrics
 */
setInterval(() => {
  metrics.users.clear();
}, 300000); // Clear every 5 minutes

export default performHealthCheck;