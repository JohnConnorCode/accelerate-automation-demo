/**
 * ACCELERATE Criteria Validator
 * 
 * Strict validation to ensure only qualified content enters the pipeline
 * Based on ACCELERATE_FINAL_CRITERIA.md requirements
 */

import { ContentItem } from '../types';

export interface ValidationResult {
  isValid: boolean;
  score: number;
  reasons: string[];
  category: 'perfect' | 'good' | 'maybe' | 'rejected';
}

export class AccelerateValidator {
  /**
   * Core ACCELERATE criteria
   */
  private static readonly CRITERIA = {
    // Projects must be from 2024 or later
    MIN_YEAR: 2024,
    
    // Maximum funding allowed
    MAX_FUNDING: 500000,
    
    // Team size limits
    MIN_TEAM: 1,
    MAX_TEAM: 10,
    
    // Minimum quality score
    MIN_SCORE: 30,
    
    // Required fields for different types
    REQUIRED_FIELDS: {
      project: ['url', 'title', 'description'],
      funding: ['url', 'name', 'organization', 'max_amount'],
      resource: ['url', 'title', 'content']
    }
  };

  /**
   * Validate a single item
   */
  static validate(item: ContentItem): ValidationResult {
    const reasons: string[] = [];
    let score = 0;

    // Check required fields
    if (!this.hasRequiredFields(item)) {
      return {
        isValid: false,
        score: 0,
        reasons: ['Missing required fields'],
        category: 'rejected'
      };
    }

    // Type-specific validation
    if (item.type === 'project') {
      return this.validateProject(item);
    } else if (item.type === 'funding') {
      return this.validateFunding(item);
    } else if (item.type === 'resource') {
      return this.validateResource(item);
    }

    // Unknown type
    return {
      isValid: false,
      score: 0,
      reasons: ['Unknown content type'],
      category: 'rejected'
    };
  }

  /**
   * Validate a project against ACCELERATE criteria
   */
  private static validateProject(item: ContentItem): ValidationResult {
    const reasons: string[] = [];
    let score = 100; // Start with perfect score
    const metadata = item.metadata || {};

    // 1. Check launch date (CRITICAL)
    if (metadata.launch_date) {
      const year = new Date(metadata.launch_date).getFullYear();
      if (year < this.CRITERIA.MIN_YEAR) {
        reasons.push(`Founded in ${year} (must be ${this.CRITERIA.MIN_YEAR}+)`);
        score -= 50; // Major penalty
      } else if (year === this.CRITERIA.MIN_YEAR) {
        score += 10; // Bonus for current year
      }
    } else {
      // No launch date - try to infer from other data
      if (item.created_at) {
        const createdYear = new Date(item.created_at).getFullYear();
        if (createdYear < this.CRITERIA.MIN_YEAR) {
          reasons.push('Appears to be pre-2024');
          score -= 30;
        }
      } else {
        reasons.push('No launch date available');
        score -= 20;
      }
    }

    // 2. Check funding amount (CRITICAL)
    if (metadata.funding_raised !== undefined) {
      if (metadata.funding_raised > this.CRITERIA.MAX_FUNDING) {
        reasons.push(`Funding: $${metadata.funding_raised.toLocaleString()} (max $${this.CRITERIA.MAX_FUNDING.toLocaleString()})`);
        return {
          isValid: false,
          score: 0,
          reasons,
          category: 'rejected'
        };
      } else if (metadata.funding_raised === 0) {
        score += 20; // Bonus for unfunded
      } else if (metadata.funding_raised < 100000) {
        score += 10; // Bonus for very early stage
      }
    }

    // 3. Check team size (IMPORTANT)
    if (metadata.team_size !== undefined) {
      if (metadata.team_size > this.CRITERIA.MAX_TEAM) {
        reasons.push(`Team size: ${metadata.team_size} (max ${this.CRITERIA.MAX_TEAM})`);
        score -= 40;
      } else if (metadata.team_size < this.CRITERIA.MIN_TEAM) {
        reasons.push('No team members');
        return {
          isValid: false,
          score: 0,
          reasons,
          category: 'rejected'
        };
      } else if (metadata.team_size <= 3) {
        score += 15; // Bonus for very small team
      }
    }

    // 4. Content quality checks
    if (!item.description || item.description.length < 50) {
      reasons.push('Description too short');
      score -= 15;
    }

    if (!item.url || !this.isValidUrl(item.url)) {
      reasons.push('Invalid or missing URL');
      score -= 20;
    }

    // 5. Source quality bonus
    const trustedSources = ['YCombinator', 'ProductHunt', 'HackerNews', 'GitHub'];
    if (trustedSources.includes(item.source)) {
      score += 10;
    }

    // 6. Check for Web3/blockchain focus (bonus)
    const web3Keywords = ['blockchain', 'crypto', 'defi', 'web3', 'nft', 'dao', 'ethereum', 'bitcoin'];
    const content = `${item.title} ${item.description}`.toLowerCase();
    if (web3Keywords.some(keyword => content.includes(keyword))) {
      score += 5;
    }

    // Determine category
    let category: 'perfect' | 'good' | 'maybe' | 'rejected';
    if (score >= 90) category = 'perfect';
    else if (score >= 70) category = 'good';
    else if (score >= 50) category = 'maybe';
    else category = 'rejected';

    return {
      isValid: score >= this.CRITERIA.MIN_SCORE,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      category
    };
  }

  /**
   * Validate a funding opportunity
   */
  private static validateFunding(item: ContentItem): ValidationResult {
    const reasons: string[] = [];
    let score = 80; // Funding opportunities start with good score
    const metadata = item.metadata || {};

    // Check max amount
    if (metadata.max_amount && metadata.max_amount > 1000000) {
      reasons.push('Funding amount too large for early-stage');
      score -= 20;
    }

    // Check if it's for early stage
    const earlyStageKeywords = ['seed', 'pre-seed', 'early', 'mvp', 'prototype', 'angel'];
    const content = `${item.title} ${item.description}`.toLowerCase();
    if (earlyStageKeywords.some(keyword => content.includes(keyword))) {
      score += 20;
    }

    // Check if active
    if (metadata.is_active === false) {
      return {
        isValid: false,
        score: 0,
        reasons: ['Funding program not active'],
        category: 'rejected'
      };
    }

    // Application deadline check
    if (metadata.application_deadline) {
      const deadline = new Date(metadata.application_deadline);
      if (deadline < new Date()) {
        return {
          isValid: false,
          score: 0,
          reasons: ['Application deadline passed'],
          category: 'rejected'
        };
      }
    }

    return {
      isValid: score >= 40,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      category: score >= 70 ? 'good' : 'maybe'
    };
  }

  /**
   * Validate a resource/article
   */
  private static validateResource(item: ContentItem): ValidationResult {
    const reasons: string[] = [];
    let score = 60; // Resources start with moderate score

    // Check content quality
    if (!item.content && !item.description) {
      reasons.push('No content available');
      score -= 30;
    }

    // Check if recent (prefer recent content)
    if (item.published_date) {
      const daysOld = (Date.now() - new Date(item.published_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld > 30) {
        reasons.push('Content is over 30 days old');
        score -= 10;
      } else if (daysOld <= 7) {
        score += 10; // Bonus for very recent
      }
    }

    // Check relevance to startups
    const relevantKeywords = ['startup', 'founder', 'launch', 'mvp', 'funding', 'investor', 'accelerator'];
    const content = `${item.title} ${item.description || item.content}`.toLowerCase();
    const keywordMatches = relevantKeywords.filter(keyword => content.includes(keyword)).length;
    score += keywordMatches * 5;

    return {
      isValid: score >= 40,
      score: Math.max(0, Math.min(100, score)),
      reasons,
      category: score >= 60 ? 'good' : 'maybe'
    };
  }

  /**
   * Check if item has required fields
   */
  private static hasRequiredFields(item: ContentItem): boolean {
    const requiredFields = this.CRITERIA.REQUIRED_FIELDS[item.type] || [];
    return requiredFields.every(field => {
      const value = (item as any)[field];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Validate URL format
   */
  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Batch validate items
   */
  static validateBatch(items: ContentItem[]): {
    valid: ContentItem[];
    rejected: ContentItem[];
    stats: {
      total: number;
      valid: number;
      rejected: number;
      byCategory: Record<string, number>;
    };
  } {
    const valid: ContentItem[] = [];
    const rejected: ContentItem[] = [];
    const byCategory: Record<string, number> = {
      perfect: 0,
      good: 0,
      maybe: 0,
      rejected: 0
    };

    items.forEach(item => {
      const result = this.validate(item);
      
      // Add validation metadata to item
      (item as any).validation = result;
      
      if (result.isValid) {
        valid.push(item);
      } else {
        rejected.push(item);
      }
      
      byCategory[result.category]++;
    });

    return {
      valid,
      rejected,
      stats: {
        total: items.length,
        valid: valid.length,
        rejected: rejected.length,
        byCategory
      }
    };
  }
}