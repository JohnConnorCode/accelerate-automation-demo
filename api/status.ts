import { VercelRequest, VercelResponse } from '@vercel/node';
import { orchestrator } from '../src/orchestrator';
import { getDatabaseStats, isSupabaseConfigured } from '../src/lib/supabase-client';

/**
 * STATUS ENDPOINT
 * GET /api/status
 * Returns current system status and statistics
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const status = await orchestrator.getStatus();
    
    // Add runtime information
    const enhanced = {
      ...status,
      runtime: {
        node_version: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      },
      configuration: {
        database_configured: isSupabaseConfigured,
        cache_enabled: process.env.CACHE_ENABLED === 'true',
        apis_configured: {
          github: !!process.env.GITHUB_TOKEN,
          twitter: !!process.env.TWITTER_BEARER_TOKEN,
          discord: !!process.env.DISCORD_BOT_TOKEN,
          neynar: !!process.env.NEYNAR_API_KEY,
        }
      },
      timestamp: new Date().toISOString()
    };

    // Get database stats if configured
    if (isSupabaseConfigured) {
      try {
        enhanced.database_stats = await getDatabaseStats();
      } catch (error) {
        enhanced.database_stats = { error: 'Failed to fetch stats' };
      }
    }

    return res.status(200).json(enhanced);

  } catch (error: any) {
    console.error('[API] Status check failed:', error);
    
    return res.status(500).json({
      error: 'Failed to get status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}