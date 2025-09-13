import type { VercelRequest, VercelResponse } from '@vercel/node';
import { UnifiedOrchestrator } from '../../src/core/unified-orchestrator';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('Starting automated content fetch...');
    const orchestrator = new UnifiedOrchestrator();
    const result = await orchestrator.run();
    
    console.log('Content fetch completed:', {
      fetched: result.fetched,
      validated: result.validated,
      unique: result.unique,
      inserted: result.inserted,
      duration: result.duration
    });

    return response.status(200).json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Content fetch failed:', error);
    return response.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}