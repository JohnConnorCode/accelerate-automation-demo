/**
 * Analytics and reporting service
 */
import { supabase } from '../lib/supabase';
import { logger } from './logger';

export class AnalyticsService {
  /**
   * Get comprehensive analytics
   */
  async getAnalytics(timeframe: '24h' | '7d' | '30d' | 'all' = '7d') {
    const startDate = this.getStartDate(timeframe);
    
    try {
      // Content metrics
      const contentMetrics = await this.getContentMetrics(startDate);
      
      // Source performance
      const sourcePerformance = await this.getSourcePerformance(startDate);
      
      // Score distribution
      const scoreDistribution = await this.getScoreDistribution(startDate);
      
      // Growth trends
      const growthTrends = await this.getGrowthTrends(startDate);
      
      // AI usage
      const aiUsage = await this.getAIUsage(startDate);
      
      return {
        timeframe,
        period: {
          start: startDate,
          end: new Date()
        },
        metrics: {
          content: contentMetrics,
          sources: sourcePerformance,
          scores: scoreDistribution,
          growth: growthTrends,
          ai: aiUsage
        },
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating analytics', error);
      throw error;
    }
  }

  /**
   * Get content metrics
   */
  private async getContentMetrics(startDate: Date) {
    const { data: content } = await supabase
      .from('content_curated')
      .select('*')
      .gte('created_at', startDate.toISOString());

    const { data: queue } = await supabase
      .from('content_queue')
      .select('*')
      .gte('created_at', startDate.toISOString());

    return {
      total_fetched: (content?.length || 0) + (queue?.length || 0),
      approved: content?.filter(c => c.recommendation === 'approve').length || 0,
      pending: queue?.filter(q => q.status === 'pending').length || 0,
      rejected: content?.filter(c => c.recommendation === 'reject').length || 0,
      avg_score: content?.reduce((acc, c) => acc + (c.score || 0), 0) / (content?.length || 1),
      unique_sources: [...new Set(content?.map(c => c.source) || [])]
    };
  }

  /**
   * Get source performance metrics
   */
  private async getSourcePerformance(startDate: Date) {
    const { data } = await supabase
      .from('content_curated')
      .select('source, score, recommendation')
      .gte('created_at', startDate.toISOString());

    const sourceMap = new Map();
    
    data?.forEach(item => {
      if (!sourceMap.has(item.source)) {
        sourceMap.set(item.source, {
          count: 0,
          total_score: 0,
          approved: 0,
          rejected: 0
        });
      }
      
      const stats = sourceMap.get(item.source);
      stats.count++;
      stats.total_score += item.score || 0;
      if (item.recommendation === 'approve') {stats.approved++;}
      if (item.recommendation === 'reject') {stats.rejected++;}
    });

    const performance = [];
    for (const [source, stats] of sourceMap) {
      performance.push({
        source,
        items: stats.count,
        avg_score: stats.total_score / stats.count,
        approval_rate: stats.approved / stats.count,
        rejection_rate: stats.rejected / stats.count
      });
    }

    return performance.sort((a, b) => b.avg_score - a.avg_score);
  }

  /**
   * Get score distribution
   */
  private async getScoreDistribution(startDate: Date) {
    const { data } = await supabase
      .from('content_curated')
      .select('score')
      .gte('created_at', startDate.toISOString());

    const distribution = {
      '0-2': 0,
      '3-4': 0,
      '5-6': 0,
      '7-8': 0,
      '9-10': 0
    };

    data?.forEach(item => {
      const score = item.score || 0;
      if (score <= 2) {distribution['0-2']++;}
      else if (score <= 4) {distribution['3-4']++;}
      else if (score <= 6) {distribution['5-6']++;}
      else if (score <= 8) {distribution['7-8']++;}
      else {distribution['9-10']++;}
    });

    return distribution;
  }

  /**
   * Get growth trends
   */
  private async getGrowthTrends(startDate: Date) {
    const { data } = await supabase
      .from('content_curated')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at');

    const dailyCounts = new Map();
    
    data?.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    });

    const trends = [];
    for (const [date, count] of dailyCounts) {
      trends.push({ date, count });
    }

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get AI usage metrics
   */
  private async getAIUsage(startDate: Date) {
    const { data } = await supabase
      .from('content_curated')
      .select('ai_enriched, confidence')
      .gte('created_at', startDate.toISOString());

    const enriched = data ? data.filter(d => d.ai_enriched).length : 0;
    const total = data?.length || 1;
    const avgConfidence = (data?.reduce((acc, d) => acc + (d.confidence || 0), 0) || 0) / total;

    return {
      enrichment_rate: enriched / total,
      avg_confidence: avgConfidence,
      total_enriched: enriched,
      api_calls: enriched // Approximate
    };
  }

  /**
   * Generate report
   */
  async generateReport(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<string> {
    const analytics = await this.getAnalytics(timeframe);
    
    const report = `
# Content Automation Analytics Report
Generated: ${new Date().toLocaleString()}
Period: ${timeframe}

## Content Metrics
- Total Fetched: ${analytics.metrics.content.total_fetched}
- Approved: ${analytics.metrics.content.approved}
- Pending: ${analytics.metrics.content.pending}
- Rejected: ${analytics.metrics.content.rejected}
- Average Score: ${analytics.metrics.content.avg_score.toFixed(2)}

## Top Performing Sources
${analytics.metrics.sources.slice(0, 5).map(s => 
  `- ${s.source}: ${s.items} items, avg score ${s.avg_score.toFixed(2)}`
).join('\n')}

## Score Distribution
${Object.entries(analytics.metrics.scores).map(([range, count]) => 
  `- Score ${range}: ${count} items`
).join('\n')}

## AI Enrichment
- Enrichment Rate: ${(analytics.metrics.ai.enrichment_rate * 100).toFixed(1)}%
- Average Confidence: ${analytics.metrics.ai.avg_confidence.toFixed(2)}
- Total API Calls: ${analytics.metrics.ai.api_calls}

## Growth Trend
${analytics.metrics.growth.slice(-7).map(g => 
  `- ${g.date}: ${g.count} items`
).join('\n')}
    `.trim();

    return report;
  }

  /**
   * Get start date for timeframe
   */
  private getStartDate(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0); // All time
    }
  }

  /**
   * Export analytics to CSV
   */
  async exportToCSV(timeframe: '24h' | '7d' | '30d' = '7d'): Promise<string> {
    const startDate = this.getStartDate(timeframe);
    
    const { data } = await supabase
      .from('content_curated')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      return 'No data available';
    }

    const headers = ['Date', 'Title', 'Source', 'Score', 'Confidence', 'Recommendation', 'URL'];
    const rows = data.map(item => [
      new Date(item.created_at).toLocaleString(),
      item.title,
      item.source,
      item.score,
      item.confidence,
      item.recommendation,
      item.url
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csv;
  }
}

// Export singleton
export const analyticsService = new AnalyticsService();