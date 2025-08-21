import { VercelRequest, VercelResponse } from '@vercel/node';
import { AIQualityService } from '../src/services/ai-quality-service';
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

  const aiService = new AIQualityService();

  // Assess single item
  if (req.method === 'POST' && req.body.action === 'assess') {
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
        description: item.description,
        url: item.website_url || item.application_url || item.url,
        tags: item.tags || [],
        metadata: {
          ...item,
          amount_funded: item.funding_amount,
          team_size: item.team_members?.length || 0,
          launched_date: item.created_at
        }
      };

      // Get AI assessment
      const assessment = await aiService.assessQuality(contentItem);
      
      // Update item with AI assessment
      await supabase
        .from(table)
        .update({
          ai_score: assessment.score,
          ai_assessment: assessment,
          ai_assessed_at: new Date().toISOString()
        })
        .eq('id', itemId);

      return res.status(200).json({
        success: true,
        assessment,
        itemId
      });
    } catch (error) {
      console.error('AI assessment failed:', error);
      return res.status(500).json({ 
        error: 'Assessment failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Batch assess multiple items
  if (req.method === 'POST' && req.body.action === 'batch_assess') {
    try {
      const { itemIds, type } = req.body;
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      
      // Fetch all items
      const { data: items, error } = await supabase
        .from(table)
        .select('*')
        .in('id', itemIds);

      if (error || !items) {
        return res.status(404).json({ error: 'Items not found' });
      }

      // Convert to ContentItems
      const contentItems = items.map((item: any) => ({
        source: item.source || 'database',
        type: type,
        title: item.name || item.title,
        description: item.description,
        url: item.website_url || item.application_url || item.url,
        tags: item.tags || [],
        metadata: item
      }));

      // Get batch assessments
      const assessments = await aiService.batchAssess(contentItems);
      
      // Update all items
      const updates = items.map((item: any) => {
        const assessment = assessments.get(item.website_url || item.application_url || item.url);
        return supabase
          .from(table)
          .update({
            ai_score: assessment?.score || 0,
            ai_assessment: assessment,
            ai_assessed_at: new Date().toISOString()
          })
          .eq('id', item.id);
      });

      await Promise.all(updates);

      return res.status(200).json({
        success: true,
        assessedCount: assessments.size,
        assessments: Array.from(assessments.entries())
      });
    } catch (error) {
      console.error('Batch assessment failed:', error);
      return res.status(500).json({ 
        error: 'Batch assessment failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Detect scams
  if (req.method === 'POST' && req.body.action === 'detect_scam') {
    try {
      const { itemId, type } = req.body;
      
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      const { data: item, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', itemId)
        .single();

      if (error || !item) {
        return res.status(404).json({ error: 'Item not found' });
      }

      const contentItem: ContentItem = {
        source: item.source || 'database',
        type: type,
        title: item.name || item.title,
        description: item.description,
        url: item.website_url || item.application_url || item.url,
        tags: item.tags || [],
        metadata: item
      };

      const scamDetection = await aiService.detectScams(contentItem);
      
      // Flag item if scam detected with high confidence
      if (scamDetection.isScam && scamDetection.confidence > 80) {
        await supabase
          .from(table)
          .update({
            status: 'rejected',
            rejection_reason: `AI Scam Detection: ${scamDetection.indicators.join(', ')}`,
            ai_scam_confidence: scamDetection.confidence
          })
          .eq('id', itemId);
      }

      return res.status(200).json({
        success: true,
        scamDetection,
        itemId
      });
    } catch (error) {
      console.error('Scam detection failed:', error);
      return res.status(500).json({ 
        error: 'Scam detection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Analyze trends
  if (req.method === 'GET' && req.query.action === 'trends') {
    try {
      // Fetch recent items from all tables
      const [projects, funding, resources] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('funding_programs').select('*').order('created_at', { ascending: false }).limit(30),
        supabase.from('resources').select('*').order('created_at', { ascending: false }).limit(20)
      ]);

      const allItems: ContentItem[] = [
        ...(projects.data || []).map((p: any) => ({
          source: 'projects',
          type: 'project' as const,
          title: p.name,
          description: p.description,
          url: p.website_url,
          tags: p.tags || []
        })),
        ...(funding.data || []).map((f: any) => ({
          source: 'funding',
          type: 'funding' as const,
          title: f.name,
          description: f.description,
          url: f.application_url,
          tags: f.tags || []
        })),
        ...(resources.data || []).map((r: any) => ({
          source: 'resources',
          type: 'resource' as const,
          title: r.title,
          description: r.description,
          url: r.url,
          tags: r.tags || []
        }))
      ];

      const trends = await aiService.analyzeTrends(allItems);

      return res.status(200).json({
        success: true,
        trends,
        analyzedItems: allItems.length
      });
    } catch (error) {
      console.error('Trend analysis failed:', error);
      return res.status(500).json({ 
        error: 'Trend analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Generate executive report
  if (req.method === 'GET' && req.query.action === 'executive_report') {
    try {
      const period = (req.query.period as string) || 'week';
      
      // Fetch all items with status
      const [projects, funding, resources] = await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('funding_programs').select('*'),
        supabase.from('resources').select('*')
      ]);

      const allItems: ContentItem[] = [
        ...(projects.data || []).map((p: any) => ({
          source: 'projects',
          type: 'project' as const,
          title: p.name,
          description: p.description,
          url: p.website_url,
          tags: p.tags || [],
          metadata: { status: p.status }
        })),
        ...(funding.data || []).map((f: any) => ({
          source: 'funding',
          type: 'funding' as const,
          title: f.name,
          description: f.description,
          url: f.application_url,
          tags: f.tags || [],
          metadata: { status: f.status }
        })),
        ...(resources.data || []).map((r: any) => ({
          source: 'resources',
          type: 'resource' as const,
          title: r.title,
          description: r.description,
          url: r.url,
          tags: r.tags || [],
          metadata: { status: r.status }
        }))
      ];

      const report = await aiService.generateExecutiveReport(allItems, period);

      return res.status(200).json({
        success: true,
        report,
        period,
        totalItems: allItems.length
      });
    } catch (error) {
      console.error('Report generation failed:', error);
      return res.status(500).json({ 
        error: 'Report generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Compare two projects
  if (req.method === 'POST' && req.body.action === 'compare') {
    try {
      const { itemId1, itemId2, type } = req.body;
      
      const table = type === 'project' ? 'projects' : type === 'funding' ? 'funding_programs' : 'resources';
      
      const [item1Result, item2Result] = await Promise.all([
        supabase.from(table).select('*').eq('id', itemId1).single(),
        supabase.from(table).select('*').eq('id', itemId2).single()
      ]);

      if (!item1Result.data || !item2Result.data) {
        return res.status(404).json({ error: 'Items not found' });
      }

      const contentItem1: ContentItem = {
        source: 'database',
        type: type,
        title: item1Result.data.name || item1Result.data.title,
        description: item1Result.data.description,
        url: item1Result.data.website_url || item1Result.data.url,
        tags: item1Result.data.tags || [],
        metadata: item1Result.data
      };

      const contentItem2: ContentItem = {
        source: 'database',
        type: type,
        title: item2Result.data.name || item2Result.data.title,
        description: item2Result.data.description,
        url: item2Result.data.website_url || item2Result.data.url,
        tags: item2Result.data.tags || [],
        metadata: item2Result.data
      };

      const comparison = await aiService.compareProjects(contentItem1, contentItem2);

      return res.status(200).json({
        success: true,
        comparison,
        item1: contentItem1.title,
        item2: contentItem2.title
      });
    } catch (error) {
      console.error('Comparison failed:', error);
      return res.status(500).json({ 
        error: 'Comparison failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}