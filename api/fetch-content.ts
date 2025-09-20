import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { UnifiedOrchestrator } from '../src/core/unified-orchestrator';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeaders(corsHeaders).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).setHeaders(corsHeaders).json({
      error: 'Method not allowed'
    });
  }

  try {
    // Initialize orchestrator
    const orchestrator = new UnifiedOrchestrator();

    // Run the pipeline
    const result = await orchestrator.runPipeline();

    return res.status(200).setHeaders(corsHeaders).json({
      success: true,
      result
    });

  } catch (error: any) {
    console.error('Fetch content error:', error);

    return res.status(500).setHeaders(corsHeaders).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}