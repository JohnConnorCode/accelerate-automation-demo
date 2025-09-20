import { VercelRequest, VercelResponse } from '@vercel/node';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeaders(corsHeaders).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).setHeaders(corsHeaders).json({
      error: 'Method not allowed'
    });
  }

  try {
    const stats = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'production',
      version: '2.0.0'
    };

    return res.status(200).setHeaders(corsHeaders).json(stats);

  } catch (error: any) {
    console.error('Monitoring error:', error);

    return res.status(500).setHeaders(corsHeaders).json({
      error: 'Internal server error'
    });
  }
}