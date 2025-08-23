"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const supabase_client_1 = require("../src/lib/supabase-client");
const cache_service_1 = require("../src/lib/cache-service");
/**
 * HEALTH CHECK ENDPOINT
 * GET /api/health
 * Returns system health status
 */
async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {
            database: {
                configured: supabase_client_1.isSupabaseConfigured,
                connected: false,
                stats: null
            },
            cache: {
                enabled: process.env.CACHE_ENABLED === 'true',
                stats: null
            },
            apis: {
                github: !!process.env.GITHUB_TOKEN,
                twitter: !!process.env.TWITTER_BEARER_TOKEN,
                discord: !!process.env.DISCORD_BOT_TOKEN,
                neynar: !!process.env.NEYNAR_API_KEY
            },
            fetchers: {
                total: 14,
                categories: ['projects', 'funding', 'resources', 'metrics']
            }
        },
        checks: []
    };
    // Test database connection
    if (supabase_client_1.isSupabaseConfigured) {
        const dbConnected = await (0, supabase_client_1.testConnection)();
        health.services.database.connected = dbConnected;
        if (dbConnected) {
            health.services.database.stats = await (0, supabase_client_1.getDatabaseStats)();
            health.checks.push({ name: 'database', status: 'pass' });
        }
        else {
            health.checks.push({ name: 'database', status: 'fail', message: 'Connection failed' });
            health.status = 'degraded';
        }
    }
    else {
        health.checks.push({ name: 'database', status: 'skip', message: 'Not configured' });
    }
    // Check cache
    if (process.env.CACHE_ENABLED === 'true') {
        try {
            health.services.cache.stats = await cache_service_1.cache.getStats();
            health.checks.push({ name: 'cache', status: 'pass' });
        }
        catch (error) {
            health.checks.push({ name: 'cache', status: 'fail', message: 'Cache error' });
        }
    }
    // Check API configurations
    const apiCount = Object.values(health.services.apis).filter(Boolean).length;
    if (apiCount === 0) {
        health.checks.push({ name: 'apis', status: 'warn', message: 'No API keys configured' });
        health.status = 'degraded';
    }
    else {
        health.checks.push({
            name: 'apis',
            status: 'pass',
            message: `${apiCount} APIs configured`
        });
    }
    // Set appropriate status code
    const statusCode = health.status === 'healthy' ? 200 :
        health.status === 'degraded' ? 206 : 503;
    res.status(statusCode).json(health);
}
