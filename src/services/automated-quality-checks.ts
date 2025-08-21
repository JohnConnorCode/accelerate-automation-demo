import { supabase } from '../lib/supabase-client';
import { AIQualityService } from './ai-quality-service';
import { DuplicateDetector } from '../lib/duplicate-detector';
import { AccelerateScorer } from '../lib/accelerate-scorer';
import { ContentItem } from '../lib/base-fetcher';

interface QualityCheckResult {
  passed: boolean;
  score: number;
  checks: {
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }[];
  autoAction?: 'approve' | 'reject' | 'review';
  reasoning: string;
}

export class AutomatedQualityChecks {
  private aiService: AIQualityService;
  private duplicateDetector: DuplicateDetector;
  
  constructor() {
    this.aiService = new AIQualityService();
    this.duplicateDetector = new DuplicateDetector();
  }

  /**
   * Run comprehensive quality checks on a content item
   */
  async runFullQualityCheck(item: ContentItem): Promise<QualityCheckResult> {
    const checks: QualityCheckResult['checks'] = [];
    let totalScore = 0;
    let criticalFailures = 0;
    
    // 1. Required Fields Check
    const fieldsCheck = this.checkRequiredFields(item);
    checks.push(fieldsCheck);
    if (!fieldsCheck.passed) criticalFailures++;
    
    // 2. URL Validation
    const urlCheck = this.checkURL(item);
    checks.push(urlCheck);
    if (!urlCheck.passed) criticalFailures++;
    
    // 3. Description Quality
    const descCheck = this.checkDescription(item);
    checks.push(descCheck);
    totalScore += descCheck.passed ? 10 : 0;
    
    // 4. Date Validation
    const dateCheck = this.checkDates(item);
    checks.push(dateCheck);
    totalScore += dateCheck.passed ? 10 : 0;
    
    // 5. Funding Criteria
    if (item.type === 'project') {
      const fundingCheck = this.checkFundingCriteria(item);
      checks.push(fundingCheck);
      totalScore += fundingCheck.passed ? 20 : 0;
      
      const teamCheck = this.checkTeamSize(item);
      checks.push(teamCheck);
      totalScore += teamCheck.passed ? 15 : 0;
    }
    
    // 6. Duplicate Check
    const dupCheck = await this.checkForDuplicates(item);
    checks.push(dupCheck);
    if (!dupCheck.passed) criticalFailures++;
    
    // 7. Spam/Scam Detection
    const spamCheck = await this.checkForSpam(item);
    checks.push(spamCheck);
    if (!spamCheck.passed) criticalFailures++;
    
    // 8. AI Quality Assessment
    const aiCheck = await this.runAIQualityCheck(item);
    checks.push(aiCheck);
    totalScore += Math.floor(aiCheck.passed ? 35 : 10);
    
    // 9. Social Proof Check
    if (item.metadata?.social_score) {
      const socialCheck = this.checkSocialProof(item);
      checks.push(socialCheck);
      totalScore += socialCheck.passed ? 10 : 0;
    }
    
    // Calculate final score and determine action
    const passed = criticalFailures === 0 && totalScore >= 60;
    let autoAction: QualityCheckResult['autoAction'] = 'review';
    
    if (criticalFailures > 0) {
      autoAction = 'reject';
    } else if (totalScore >= 80) {
      autoAction = 'approve';
    } else if (totalScore >= 60) {
      autoAction = 'review';
    } else {
      autoAction = 'reject';
    }
    
    const reasoning = this.generateReasoning(checks, totalScore, criticalFailures);
    
    return {
      passed,
      score: Math.min(100, totalScore),
      checks,
      autoAction,
      reasoning
    };
  }

  /**
   * Check required fields
   */
  private checkRequiredFields(item: ContentItem): QualityCheckResult['checks'][0] {
    const required = ['title', 'description', 'url', 'type', 'source'];
    const missing = [];
    
    if (!item.title || item.title.trim().length === 0) missing.push('title');
    if (!item.description || item.description.trim().length === 0) missing.push('description');
    if (!item.url || item.url.trim().length === 0) missing.push('url');
    if (!item.type) missing.push('type');
    if (!item.source) missing.push('source');
    
    return {
      name: 'Required Fields',
      passed: missing.length === 0,
      message: missing.length === 0 
        ? 'All required fields present' 
        : `Missing fields: ${missing.join(', ')}`,
      severity: missing.length === 0 ? 'info' : 'error'
    };
  }

  /**
   * Check URL validity and security
   */
  private checkURL(item: ContentItem): QualityCheckResult['checks'][0] {
    try {
      const url = new URL(item.url);
      
      // Must be HTTPS for security
      if (url.protocol !== 'https:') {
        return {
          name: 'URL Security',
          passed: false,
          message: 'URL must use HTTPS protocol',
          severity: 'warning'
        };
      }
      
      // Check for suspicious domains
      const suspiciousDomains = ['bit.ly', 'tinyurl.com', 'goo.gl', 'ow.ly'];
      if (suspiciousDomains.some(domain => url.hostname.includes(domain))) {
        return {
          name: 'URL Security',
          passed: false,
          message: 'URL uses suspicious shortener service',
          severity: 'warning'
        };
      }
      
      return {
        name: 'URL Security',
        passed: true,
        message: 'URL is valid and secure',
        severity: 'info'
      };
    } catch (error) {
      return {
        name: 'URL Security',
        passed: false,
        message: 'Invalid URL format',
        severity: 'error'
      };
    }
  }

  /**
   * Check description quality
   */
  private checkDescription(item: ContentItem): QualityCheckResult['checks'][0] {
    const desc = item.description;
    
    // Minimum length requirement
    if (desc.length < 50) {
      return {
        name: 'Description Quality',
        passed: false,
        message: `Description too short (${desc.length} chars, min 50)`,
        severity: 'warning'
      };
    }
    
    // Check for excessive emojis (spam indicator)
    const emojiCount = (desc.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 5) {
      return {
        name: 'Description Quality',
        passed: false,
        message: `Excessive emojis detected (${emojiCount})`,
        severity: 'warning'
      };
    }
    
    // Check for hyperbolic language
    const hyperbolicWords = ['guaranteed', '1000x', 'get rich', 'easy money', 'no risk'];
    const hasHyperbole = hyperbolicWords.some(word => 
      desc.toLowerCase().includes(word)
    );
    
    if (hasHyperbole) {
      return {
        name: 'Description Quality',
        passed: false,
        message: 'Hyperbolic/scam language detected',
        severity: 'error'
      };
    }
    
    return {
      name: 'Description Quality',
      passed: true,
      message: `Good description (${desc.length} chars)`,
      severity: 'info'
    };
  }

  /**
   * Check date criteria
   */
  private checkDates(item: ContentItem): QualityCheckResult['checks'][0] {
    if (item.type !== 'project') {
      return {
        name: 'Date Validation',
        passed: true,
        message: 'Date check not applicable',
        severity: 'info'
      };
    }
    
    const launchedDate = item.metadata?.launched_date;
    if (!launchedDate) {
      return {
        name: 'Date Validation',
        passed: true,
        message: 'No launch date provided',
        severity: 'info'
      };
    }
    
    const date = new Date(launchedDate);
    const year2024 = new Date('2024-01-01');
    
    if (date < year2024) {
      return {
        name: 'Date Validation',
        passed: false,
        message: `Launched before 2024 (${date.getFullYear()})`,
        severity: 'error'
      };
    }
    
    return {
      name: 'Date Validation',
      passed: true,
      message: `Launched ${date.toLocaleDateString()}`,
      severity: 'info'
    };
  }

  /**
   * Check funding criteria
   */
  private checkFundingCriteria(item: ContentItem): QualityCheckResult['checks'][0] {
    const funding = item.metadata?.amount_funded || 0;
    
    if (funding > 500000) {
      return {
        name: 'Funding Criteria',
        passed: false,
        message: `Funding exceeds limit ($${funding.toLocaleString()} > $500k)`,
        severity: 'error'
      };
    }
    
    if (item.metadata?.corporate_backing) {
      return {
        name: 'Funding Criteria',
        passed: false,
        message: 'Has corporate backing',
        severity: 'error'
      };
    }
    
    return {
      name: 'Funding Criteria',
      passed: true,
      message: funding > 0 
        ? `Funding: $${funding.toLocaleString()}` 
        : 'No funding data',
      severity: 'info'
    };
  }

  /**
   * Check team size criteria
   */
  private checkTeamSize(item: ContentItem): QualityCheckResult['checks'][0] {
    const teamSize = item.metadata?.team_size || 0;
    
    if (teamSize > 10) {
      return {
        name: 'Team Size',
        passed: false,
        message: `Team too large (${teamSize} > 10)`,
        severity: 'error'
      };
    }
    
    if (teamSize === 0) {
      return {
        name: 'Team Size',
        passed: true,
        message: 'Team size not specified',
        severity: 'info'
      };
    }
    
    return {
      name: 'Team Size',
      passed: true,
      message: `Team size: ${teamSize}`,
      severity: 'info'
    };
  }

  /**
   * Check for duplicates
   */
  private async checkForDuplicates(item: ContentItem): Promise<QualityCheckResult['checks'][0]> {
    try {
      const { duplicates } = await this.duplicateDetector.checkDuplicates([item]);
      
      if (duplicates.length > 0) {
        return {
          name: 'Duplicate Check',
          passed: false,
          message: `Duplicate found (${duplicates[0].similarity}% match)`,
          severity: 'error'
        };
      }
      
      return {
        name: 'Duplicate Check',
        passed: true,
        message: 'No duplicates found',
        severity: 'info'
      };
    } catch (error) {
      return {
        name: 'Duplicate Check',
        passed: true,
        message: 'Duplicate check skipped',
        severity: 'info'
      };
    }
  }

  /**
   * Check for spam/scam patterns
   */
  private async checkForSpam(item: ContentItem): Promise<QualityCheckResult['checks'][0]> {
    try {
      const scamResult = await this.aiService.detectScams(item);
      
      if (scamResult.isScam && scamResult.confidence > 70) {
        return {
          name: 'Spam/Scam Detection',
          passed: false,
          message: `Likely scam (${scamResult.confidence}% confidence): ${scamResult.indicators.join(', ')}`,
          severity: 'error'
        };
      }
      
      if (scamResult.confidence > 50) {
        return {
          name: 'Spam/Scam Detection',
          passed: true,
          message: `Potential concerns: ${scamResult.indicators.join(', ')}`,
          severity: 'warning'
        };
      }
      
      return {
        name: 'Spam/Scam Detection',
        passed: true,
        message: 'No scam indicators detected',
        severity: 'info'
      };
    } catch (error) {
      // Simple pattern-based fallback
      const text = `${item.title} ${item.description}`.toLowerCase();
      const scamPatterns = [
        '100% guaranteed',
        'risk free',
        'limited time only',
        'act now',
        'get rich quick',
        'passive income guarantee'
      ];
      
      const hasScamPattern = scamPatterns.some(pattern => text.includes(pattern));
      
      return {
        name: 'Spam/Scam Detection',
        passed: !hasScamPattern,
        message: hasScamPattern ? 'Spam patterns detected' : 'No spam patterns',
        severity: hasScamPattern ? 'error' : 'info'
      };
    }
  }

  /**
   * Run AI quality assessment
   */
  private async runAIQualityCheck(item: ContentItem): Promise<QualityCheckResult['checks'][0]> {
    try {
      const assessment = await this.aiService.assessQuality(item);
      
      if (assessment.score < 50) {
        return {
          name: 'AI Quality Assessment',
          passed: false,
          message: `Low AI score (${assessment.score}/100): ${assessment.reasoning}`,
          severity: 'warning'
        };
      }
      
      return {
        name: 'AI Quality Assessment',
        passed: true,
        message: `AI score: ${assessment.score}/100 - ${assessment.recommendation}`,
        severity: 'info'
      };
    } catch (error) {
      return {
        name: 'AI Quality Assessment',
        passed: true,
        message: 'AI assessment unavailable',
        severity: 'info'
      };
    }
  }

  /**
   * Check social proof
   */
  private checkSocialProof(item: ContentItem): QualityCheckResult['checks'][0] {
    const socialScore = item.metadata?.social_score || 0;
    const twitterFollowers = item.metadata?.twitter_followers || 0;
    const githubStars = item.metadata?.github_stars || 0;
    
    if (socialScore < 30 && twitterFollowers < 100 && githubStars < 10) {
      return {
        name: 'Social Proof',
        passed: false,
        message: 'Low social engagement',
        severity: 'warning'
      };
    }
    
    return {
      name: 'Social Proof',
      passed: true,
      message: `Social score: ${socialScore}, Twitter: ${twitterFollowers}, GitHub: ${githubStars}`,
      severity: 'info'
    };
  }

  /**
   * Generate reasoning for the quality check result
   */
  private generateReasoning(
    checks: QualityCheckResult['checks'], 
    score: number, 
    criticalFailures: number
  ): string {
    const failedChecks = checks.filter(c => !c.passed);
    const warnings = checks.filter(c => c.severity === 'warning');
    
    if (criticalFailures > 0) {
      return `Critical failures detected: ${failedChecks.map(c => c.name).join(', ')}. This item does not meet minimum requirements.`;
    }
    
    if (score >= 80) {
      return `High quality item with score ${score}/100. ${warnings.length > 0 ? `Minor concerns: ${warnings.map(w => w.name).join(', ')}` : 'No concerns found.'}`;
    }
    
    if (score >= 60) {
      return `Moderate quality item with score ${score}/100. Review recommended for: ${failedChecks.map(c => c.name).join(', ')}.`;
    }
    
    return `Low quality item with score ${score}/100. Multiple issues found: ${failedChecks.map(c => c.message).join('; ')}.`;
  }

  /**
   * Run automated quality checks on all pending items
   */
  async runBatchQualityChecks(limit: number = 50): Promise<{
    processed: number;
    approved: number;
    rejected: number;
    review: number;
    errors: number;
  }> {
    const stats = {
      processed: 0,
      approved: 0,
      rejected: 0,
      review: 0,
      errors: 0
    };

    try {
      // Fetch pending items from all tables
      const [projects, funding, resources] = await Promise.all([
        supabase
          .from('projects')
          .select('*')
          .or('status.is.null,status.eq.pending')
          .limit(limit),
        supabase
          .from('funding_programs')
          .select('*')
          .or('status.is.null,status.eq.pending')
          .limit(limit),
        supabase
          .from('resources')
          .select('*')
          .or('status.is.null,status.eq.pending')
          .limit(limit)
      ]);

      const allItems: Array<{item: any, type: string, table: string}> = [
        ...(projects.data || []).map(p => ({ item: p, type: 'project', table: 'projects' })),
        ...(funding.data || []).map(f => ({ item: f, type: 'funding', table: 'funding_programs' })),
        ...(resources.data || []).map(r => ({ item: r, type: 'resource', table: 'resources' }))
      ];

      for (const { item, type, table } of allItems) {
        try {
          // Convert to ContentItem format
          const contentItem: ContentItem = {
            source: item.source || 'database',
            type: type as any,
            title: item.name || item.title,
            description: item.description || '',
            url: item.website_url || item.application_url || item.url || '',
            tags: item.tags || [],
            metadata: item
          };

          // Run quality checks
          const result = await this.runFullQualityCheck(contentItem);
          
          // Update database based on result
          const updateData: any = {
            quality_score: result.score,
            quality_checks: result.checks,
            quality_checked_at: new Date().toISOString()
          };

          if (result.autoAction === 'approve') {
            updateData.status = 'approved';
            updateData.approved_at = new Date().toISOString();
            updateData.approval_reason = result.reasoning;
            stats.approved++;
          } else if (result.autoAction === 'reject') {
            updateData.status = 'rejected';
            updateData.rejected_at = new Date().toISOString();
            updateData.rejection_reason = result.reasoning;
            stats.rejected++;
          } else {
            updateData.status = 'review';
            updateData.review_notes = result.reasoning;
            stats.review++;
          }

          await supabase
            .from(table)
            .update(updateData)
            .eq('id', item.id);

          stats.processed++;
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          stats.errors++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Batch quality check failed:', error);
      throw error;
    }
  }
}