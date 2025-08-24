import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../src/lib/supabase-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get analytics for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch metrics
    const [projects, funding, resources] = await Promise.all([
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
      
      supabase
        .from('funding_programs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
      
      supabase
        .from('resources')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString()),
    ]);

    // Quality metrics
    const { count: highQualityCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .gte('score', 80)
      .gte('created_at', sevenDaysAgo.toISOString());

    // Source distribution
    const { data: sources } = await supabase
      .from('projects')
      .select('source')
      .gte('created_at', sevenDaysAgo.toISOString());
    
    const sourceCount = sources?.reduce((acc: any, item: any) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      period: '7_days',
      metrics: {
        total_items: (projects.count || 0) + (funding.count || 0) + (resources.count || 0),
        projects: projects.count || 0,
        funding: funding.count || 0,
        resources: resources.count || 0,
        high_quality: highQualityCount || 0,
        quality_rate: projects.count ? ((highQualityCount || 0) / projects.count * 100).toFixed(1) + '%' : '0%',
        daily_average: Math.round(((projects.count || 0) + (funding.count || 0) + (resources.count || 0)) / 7),
        source_distribution: sourceCount || {},
        coverage_estimate: '20%', // Will increase with API keys
        potential_with_apis: '60%'
      },
      recommendations: [
        'Add GitHub token for +20% coverage',
        'Add Twitter token for +15% coverage', 
        'Enable LinkedIn scraping for +10% coverage',
        'Add CrunchBase API for funding data'
      ]
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch analytics'
    });
  }
}