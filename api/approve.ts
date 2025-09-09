import type { VercelRequest, VercelResponse } from '@vercel/node';
import { approvalService } from '../src/api/approve';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { itemId, action, reviewerNotes, reviewedBy } = req.body;

    if (!itemId || !action) {
      return res.status(400).json({ 
        error: 'Missing required fields: itemId and action' 
      });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ 
        error: 'Invalid action. Must be "approve" or "reject"' 
      });
    }

    const result = await approvalService.processApproval({
      itemId,
      action,
      reviewerNotes,
      reviewedBy
    });

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }

  } catch (error: any) {
    console.error('Approval API error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
}