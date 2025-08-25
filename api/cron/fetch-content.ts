import type { VercelRequest, VercelResponse } from '@vercel/node';
import { orchestrator } from '../../src/core/simple-orchestrator';

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
    const result = await orchestrator.run();
    
    console.log('Content fetch completed:', {
      fetched: result.fetched,
      scored: result.scored,
      stored: result.stored,
      rejected: result.rejected,
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