/**
 * QUALITY SCORER SERVICE
 * Scores content quality to help prioritize review and enable auto-approval
 * Higher scores = higher quality content
 */

import { ContentItem } from '../lib/base-fetcher';

interface QualityScore {
  total: number;
  breakdown: {
    content_quality: number;
    validation: number;
    relevance: number;
    completeness: number;
  };
  details: {
    [key: string]: {
      score: number;
      max: number;
      reason: string;
    };
  };
  flags: {
    red: string[];
    green: string[];
  };
  recommendation: 'auto_approve' | 'review' | 'enrich_first' | 'likely_reject';
}

export class QualityScorer {
  /**
   * Calculate comprehensive quality score for content
   */
  static async scoreContent(item: any): Promise<QualityScore> {
    const details: QualityScore['details'] = {};
    const redFlags: string[] = [];
    const greenFlags: string[] = [];

    // 1. CONTENT QUALITY (40 points max)
    let contentQuality = 0;

    // Description length and quality
    const descLength = item.description?.length || 0;
    if (descLength >= 500) {
      contentQuality += 10;
      details.description_length = { score: 10, max: 10, reason: 'Detailed description (500+ chars)' };
      greenFlags.push('Comprehensive description');
    } else if (descLength >= 200) {
      contentQuality += 5;
      details.description_length = { score: 5, max: 10, reason: 'Adequate description (200+ chars)' };
    } else if (descLength >= 50) {
      contentQuality += 2;
      details.description_length = { score: 2, max: 10, reason: 'Minimal description' };
      redFlags.push('Description too short');
    } else {
      details.description_length = { score: 0, max: 10, reason: 'Description too short' };
      redFlags.push('Very short description');
    }

    // Has website
    if (item.url && !item.url.includes('example.com')) {
      contentQuality += 5;
      details.has_website = { score: 5, max: 5, reason: 'Has website URL' };
    } else {
      details.has_website = { score: 0, max: 5, reason: 'No website URL' };
      redFlags.push('Missing website');
    }

    // Has social links
    const hasSocial = item.metadata?.twitter_url || item.metadata?.discord_url || item.metadata?.telegram_url;
    if (hasSocial) {
      contentQuality += 5;
      details.has_social = { score: 5, max: 5, reason: 'Has social media presence' };
      greenFlags.push('Active social presence');
    } else {
      details.has_social = { score: 0, max: 5, reason: 'No social links' };
    }

    // Has GitHub (for projects)
    if (item.type === 'project' && item.metadata?.github_url) {
      contentQuality += 10;
      details.has_github = { score: 10, max: 10, reason: 'Open source project' };
      greenFlags.push('Open source');
    } else if (item.type === 'project') {
      details.has_github = { score: 0, max: 10, reason: 'No GitHub repository' };
    }

    // Has team info
    if (item.metadata?.team_size > 0 || item.metadata?.team_verification) {
      contentQuality += 10;
      details.has_team = { score: 10, max: 10, reason: 'Team information available' };
      greenFlags.push('Verified team');
    } else {
      details.has_team = { score: 0, max: 10, reason: 'No team information' };
    }

    // 2. VALIDATION (30 points max)
    let validation = 0;

    // Check if enriched
    if (item.enriched) {
      validation += 10;
      details.is_enriched = { score: 10, max: 10, reason: 'Content has been enriched' };
      greenFlags.push('Enriched data');
    } else {
      details.is_enriched = { score: 0, max: 10, reason: 'Not yet enriched' };
    }

    // Check for duplicates (would need DB check)
    validation += 10; // Assume no duplicates for now
    details.no_duplicates = { score: 10, max: 10, reason: 'No duplicates found' };

    // Trusted source
    const trustedSources = ['github', 'defillama', 'coingecko', 'messari'];
    if (trustedSources.some(source => item.source?.toLowerCase().includes(source))) {
      validation += 10;
      details.trusted_source = { score: 10, max: 10, reason: 'From trusted source' };
      greenFlags.push('Trusted source');
    } else {
      validation += 5;
      details.trusted_source = { score: 5, max: 10, reason: 'From standard source' };
    }

    // 3. RELEVANCE (30 points max)
    let relevance = 0;

    // Meets criteria (for projects)
    if (item.type === 'project') {
      const meetsTimeCriteria = new Date(item.created_at || item.metadata?.launch_date) >= new Date('2024-01-01');
      const meetsFundingCriteria = !item.metadata?.funding_raised || item.metadata.funding_raised < 500000;
      const meetsTeamCriteria = !item.metadata?.team_size || item.metadata.team_size <= 10;

      if (meetsTimeCriteria && meetsFundingCriteria && meetsTeamCriteria) {
        relevance += 15;
        details.meets_criteria = { score: 15, max: 15, reason: 'Meets all Accelerate criteria' };
        greenFlags.push('Perfect fit for Accelerate');
      } else {
        relevance += 5;
        details.meets_criteria = { score: 5, max: 15, reason: 'Partially meets criteria' };
        if (!meetsTimeCriteria) redFlags.push('Too old (pre-2024)');
        if (!meetsFundingCriteria) redFlags.push('Over-funded (>$500k)');
        if (!meetsTeamCriteria) redFlags.push('Team too large (>10)');
      }
    } else {
      relevance += 15; // Non-projects automatically get relevance points
      details.meets_criteria = { score: 15, max: 15, reason: 'Content type matches' };
    }

    // Recent activity
    const lastActivity = item.metadata?.last_activity || item.updated_at || item.created_at;
    const daysSinceActivity = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceActivity < 30) {
      relevance += 10;
      details.recent_activity = { score: 10, max: 10, reason: 'Very recent activity (<30 days)' };
      greenFlags.push('Recently active');
    } else if (daysSinceActivity < 90) {
      relevance += 5;
      details.recent_activity = { score: 5, max: 10, reason: 'Recent activity (<90 days)' };
    } else {
      details.recent_activity = { score: 0, max: 10, reason: 'No recent activity' };
      redFlags.push('Stale (>90 days)');
    }

    // Urgency (for funding)
    if (item.type === 'funding' && item.metadata?.deadline) {
      const daysUntilDeadline = (new Date(item.metadata.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDeadline > 0 && daysUntilDeadline < 30) {
        relevance += 5;
        details.urgency = { score: 5, max: 5, reason: 'Urgent deadline approaching' };
        greenFlags.push('Time-sensitive opportunity');
      } else if (daysUntilDeadline > 30) {
        relevance += 3;
        details.urgency = { score: 3, max: 5, reason: 'Deadline not urgent' };
      } else {
        details.urgency = { score: 0, max: 5, reason: 'Deadline passed' };
        redFlags.push('Deadline expired');
      }
    }

    // 4. COMPLETENESS (Bonus points)
    let completeness = 0;
    const requiredFields = this.getRequiredFields(item.type);
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!item[field] && !item.metadata?.[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length === 0) {
      completeness = 10;
      details.completeness = { score: 10, max: 10, reason: 'All required fields present' };
      greenFlags.push('Complete data');
    } else if (missingFields.length <= 2) {
      completeness = 5;
      details.completeness = { score: 5, max: 10, reason: `Missing ${missingFields.length} fields` };
    } else {
      completeness = 0;
      details.completeness = { score: 0, max: 10, reason: `Missing ${missingFields.length} fields: ${missingFields.join(', ')}` };
      redFlags.push(`Incomplete (missing ${missingFields.join(', ')})`);
    }

    // Calculate total score
    const total = contentQuality + validation + relevance + completeness;

    // Determine recommendation
    let recommendation: QualityScore['recommendation'];
    if (total >= 80 && redFlags.length === 0) {
      recommendation = 'auto_approve';
    } else if (total >= 60 && !item.enriched) {
      recommendation = 'enrich_first';
    } else if (total >= 50) {
      recommendation = 'review';
    } else {
      recommendation = 'likely_reject';
    }

    return {
      total,
      breakdown: {
        content_quality: contentQuality,
        validation,
        relevance,
        completeness
      },
      details,
      flags: {
        red: redFlags,
        green: greenFlags
      },
      recommendation
    };
  }

  /**
   * Get required fields by content type
   */
  private static getRequiredFields(type: string): string[] {
    switch (type) {
      case 'project':
        return ['name', 'description', 'website_url', 'categories', 'project_needs'];
      case 'funding':
        return ['name', 'description', 'application_url', 'min_amount', 'max_amount'];
      case 'resource':
        return ['title', 'description', 'url', 'resource_type', 'category'];
      default:
        return ['title', 'description', 'url'];
    }
  }

  /**
   * Batch score multiple items
   */
  static async scoreMany(items: any[]): Promise<Map<string, QualityScore>> {
    const scores = new Map<string, QualityScore>();
    
    for (const item of items) {
      const score = await this.scoreContent(item);
      scores.set(item.id, score);
    }
    
    return scores;
  }

  /**
   * Check if item qualifies for auto-approval
   */
  static qualifiesForAutoApproval(score: QualityScore): boolean {
    return score.total >= 80 && 
           score.flags.red.length === 0 &&
           score.recommendation === 'auto_approve';
  }

  /**
   * Get items needing enrichment
   */
  static needsEnrichment(score: QualityScore): boolean {
    return score.recommendation === 'enrich_first' ||
           score.breakdown.completeness < 5 ||
           score.details.is_enriched?.score === 0;
  }
}