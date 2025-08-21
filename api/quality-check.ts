import { VercelRequest, VercelResponse } from '@vercel/node';
import { AutomatedQualityChecks } from '../src/services/automated-quality-checks';
import { supabase } from '../src/lib/supabase-client';
import { ContentItem } from '../src/lib/base-fetcher';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const qualityChecker = new AutomatedQualityChecks();

  // Run quality check on single item
  if (req.method === 'POST' && req.body.action === 'check_single') {
    try {
      const { itemId, type } = req.body;
      
      // Fetch item from database
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      const { data: item, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', itemId)
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      // Convert to ContentItem format
      const contentItem: ContentItem = {
        source: item.source || 'database',
        type: type,
        title: item.name || item.title,
        description: item.description || '',
        url: item.website_url || item.application_url || item.url || '',
        tags: item.tags || [],
        metadata: item
      };

      // Run quality checks
      const result = await qualityChecker.runFullQualityCheck(contentItem);
      
      // Update database with quality check results
      const updateData: any = {
        quality_score: result.score,
        quality_checks: result.checks,
        quality_checked_at: new Date().toISOString()
      };

      // Apply auto-action if configured
      if (req.body.applyAutoAction) {
        if (result.autoAction === 'approve') {
          updateData.status = 'approved';
          updateData.approved_at = new Date().toISOString();
          updateData.approval_reason = result.reasoning;
        } else if (result.autoAction === 'reject') {
          updateData.status = 'rejected';
          updateData.rejected_at = new Date().toISOString();
          updateData.rejection_reason = result.reasoning;
        } else {
          updateData.status = 'review';
          updateData.review_notes = result.reasoning;
        }
      }

      await supabase
        .from(table)
        .update(updateData)
        .eq('id', itemId);

      return res.status(200).json({
        success: true,
        result,
        itemId
      });
    } catch (error) {
      console.error('Quality check failed:', error);
      return res.status(500).json({ 
        error: 'Quality check failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Run batch quality checks on all pending items
  if (req.method === 'POST' && req.body.action === 'check_batch') {
    try {
      const limit = req.body.limit || 50;
      const stats = await qualityChecker.runBatchQualityChecks(limit);

      return res.status(200).json({
        success: true,
        stats,
        message: `Processed ${stats.processed} items: ${stats.approved} approved, ${stats.rejected} rejected, ${stats.review} for review`
      });
    } catch (error) {
      console.error('Batch quality check failed:', error);
      return res.status(500).json({ 
        error: 'Batch quality check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get quality check statistics
  if (req.method === 'GET' && req.query.action === 'stats') {
    try {
      const [projects, funding, resources] = await Promise.all([
        supabase
          .from('projects')
          .select('status, quality_score')
          .not('quality_score', 'is', null),
        supabase
          .from('funding_programs')
          .select('status, quality_score')
          .not('quality_score', 'is', null),
        supabase
          .from('resources')
          .select('status, quality_score')
          .not('quality_score', 'is', null)
      ]);

      const allItems = [
        ...(projects.data || []),
        ...(funding.data || []),
        ...(resources.data || [])
      ];

      const stats = {
        totalChecked: allItems.length,
        averageScore: allItems.reduce((sum, item) => sum + (item.quality_score || 0), 0) / allItems.length,
        approved: allItems.filter(i => i.status === 'approved').length,
        rejected: allItems.filter(i => i.status === 'rejected').length,
        review: allItems.filter(i => i.status === 'review').length,
        pending: allItems.filter(i => !i.status || i.status === 'pending').length,
        scoreDistribution: {
          excellent: allItems.filter(i => (i.quality_score || 0) >= 80).length,
          good: allItems.filter(i => (i.quality_score || 0) >= 60 && (i.quality_score || 0) < 80).length,
          fair: allItems.filter(i => (i.quality_score || 0) >= 40 && (i.quality_score || 0) < 60).length,
          poor: allItems.filter(i => (i.quality_score || 0) < 40).length
        }
      };

      return res.status(200).json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Failed to get stats:', error);
      return res.status(500).json({ 
        error: 'Failed to get statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get items that need review
  if (req.method === 'GET' && req.query.action === 'review_queue') {
    try {
      const [projects, funding, resources] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .eq('status', 'review')
          .order('quality_score', { ascending: false })
          .limit(20),
        supabase
          .from('funding_programs')
          .select('*')
          .eq('status', 'review')
          .order('quality_score', { ascending: false })
          .limit(20),
        supabase
          .from('resources')
          .select('*')
          .eq('status', 'review')
          .order('quality_score', { ascending: false })
          .limit(20)
      ]);

      const reviewQueue = [
        ...(projects.data || []).map(p => ({ ...p, type: 'project' })),
        ...(funding.data || []).map(f => ({ ...f, type: 'funding' })),
        ...(resources.data || []).map(r => ({ ...r, type: 'resource' }))
      ].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));

      return res.status(200).json({
        success: true,
        items: reviewQueue,
        count: reviewQueue.length
      });
    } catch (error) {
      console.error('Failed to get review queue:', error);
      return res.status(500).json({ 
        error: 'Failed to get review queue',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Configure quality check thresholds
  if (req.method === 'POST' && req.body.action === 'configure') {
    try {
      const { autoApproveThreshold, autoRejectThreshold } = req.body;
      
      await supabase
        .from('system_settings')
        .upsert([
          {
            key: 'quality_auto_approve_threshold',
            value: autoApproveThreshold || 80,
            updated_at: new Date().toISOString()
          },
          {
            key: 'quality_auto_reject_threshold',
            value: autoRejectThreshold || 40,
            updated_at: new Date().toISOString()
          }
        ], { onConflict: 'key' });

      return res.status(200).json({
        success: true,
        message: 'Quality check thresholds updated'
      });
    } catch (error) {
      console.error('Failed to update configuration:', error);
      return res.status(500).json({ 
        error: 'Failed to update configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}