import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test database connection
    const { data, error } = await supabase
      .from('content_queue')
      .select('count')
      .limit(1);

    const dbConnected = !error;

    // Check AI service
    const aiAvailable = !!process.env.OPENAI_API_KEY;

    return res.status(200).json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbConnected,
        error: error?.message
      },
      aiService: {
        available: aiAvailable
      },
      environment: process.env.VERCEL_ENV || 'production'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}