import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { query, filters = {} } = req.body;

    if (!query || query.trim() === '') {
      return res.status(400).setHeaders(corsHeaders).json({
        error: 'Query required'
      });
    }

    // Search in content_queue
    let searchQuery = supabase
      .from('content_queue')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,company_name.ilike.%${query}%`);

    // Apply filters
    if (filters.status) {
      searchQuery = searchQuery.eq('status', filters.status);
    }
    if (filters.source) {
      searchQuery = searchQuery.eq('source', filters.source);
    }
    if (filters.minScore) {
      searchQuery = searchQuery.gte('accelerate_score', filters.minScore);
    }

    const { data, error } = await searchQuery
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return res.status(200).setHeaders(corsHeaders).json({
      success: true,
      results: data || [],
      count: data?.length || 0
    });

  } catch (error: any) {
    console.error('Search error:', error);

    return res.status(500).setHeaders(corsHeaders).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}