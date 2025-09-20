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
    // Get stats from various tables
    const [queueProjects, liveProjects, fundingPrograms, resources] = await Promise.all([
      supabase.from('queue_projects').select('*', { count: 'exact', head: true }),
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('funding_programs').select('*', { count: 'exact', head: true }),
      supabase.from('resources').select('*', { count: 'exact', head: true })
    ]);

    const stats = {
      totalProjects: liveProjects.count || 0,
      pendingApproval: queueProjects.count || 0,
      fundingPrograms: fundingPrograms.count || 0,
      resources: resources.count || 0,
      lastUpdated: new Date().toISOString()
    };

    // Get recent items for activity feed
    const { data: recentQueue } = await supabase
      .from('queue_projects')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentApproved } = await supabase
      .from('projects')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return res.status(200).json({
      success: true,
      stats,
      activity: {
        recentQueue: recentQueue || [],
        recentApproved: recentApproved || []
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}