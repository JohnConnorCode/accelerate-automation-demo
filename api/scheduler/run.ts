import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SimpleOrchestrator } from '../../src/core/simple-orchestrator';
import { approvalService } from '../../src/api/approve';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Verify cron secret (if provided)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🚀 Starting scheduled content fetch...');
    
    // 1. Run the orchestrator
    const orchestrator = new SimpleOrchestrator();
    orchestrator.setBatchSize(50);
    orchestrator.setScoreThreshold(30);
    
    const result = await orchestrator.run();
    
    console.log(`✅ Fetched ${result.fetched} items, stored ${result.stored}`);
    
    // 2. Auto-approve high-quality items (score >= 70)
    const approvalResult = await approvalService.autoApprove(70);
    
    console.log(`✅ Auto-approved: ${approvalResult.message}`);
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      fetch: {
        fetched: result.fetched,
        scored: result.scored,
        stored: result.stored,
        rejected: result.rejected,
        duration: result.duration
      },
      approval: approvalResult,
      message: `Fetched ${result.stored} new items, auto-approved high-quality content`
    });

  } catch (error: any) {
    console.error('Scheduler error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Scheduler failed',
      message: error.message 
    });
  }
}