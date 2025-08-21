import { VercelRequest, VercelResponse } from '@vercel/node';
import { orchestrator } from '../src/orchestrator';
import { isSupabaseConfigured } from '../src/lib/supabase-client';

/**
 * RUN ENDPOINT
 * POST /api/run
 * Triggers the orchestrator to fetch and process content
 * Can be called manually or via cron job
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow both GET (for cron) and POST (for manual trigger)
  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authorization for manual triggers
  const authHeader = req.headers.authorization;
  const cronSecret = req.headers['x-vercel-cron'];
  
  // Allow if it's a Vercel cron job or has valid auth
  const isAuthorized = cronSecret || authHeader === `Bearer ${process.env.API_SECRET}`;
  
  if (req.method === 'POST' && !isAuthorized && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Check if system is configured
  if (!isSupabaseConfigured) {
    return res.status(503).json({ 
      error: 'System not configured',
      message: 'Supabase credentials are required. Please configure SUPABASE_URL and SUPABASE_ANON_KEY'
    });
  }

  // Get category from query params (optional)
  const category = req.query.category as string;
  const validCategories = ['projects', 'funding', 'resources', 'metrics'];
  
  try {
    console.log(`[API] Starting orchestrator run${category ? ` for ${category}` : ''}`);
    
    let result;
    if (category && validCategories.includes(category)) {
      result = await orchestrator.runCategory(category as any);
    } else {
      result = await orchestrator.run();
    }

    // Log to Vercel's console
    console.log('[API] Run completed:', JSON.stringify(result.stats));

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      category: category || 'all',
      stats: result.stats,
      errors: result.errors
    });

  } catch (error: any) {
    console.error('[API] Run failed:', error);
    
    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Export config for Vercel
export const config = {
  maxDuration: 300, // 5 minutes max execution time
};