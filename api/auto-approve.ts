import type { VercelRequest, VercelResponse } from '@vercel/node';
import { approvalService } from '../src/api/approve';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get minimum score from query or body (default 70)
    const minScore = parseInt(req.query.minScore as string) || 
                     req.body?.minScore || 
                     70;

    console.log(`Auto-approving items with score >= ${minScore}`);

    const result = await approvalService.autoApprove(minScore);

    if (result.success) {
      return res.status(200).json({
        ...result,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Auto-approval API error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
}