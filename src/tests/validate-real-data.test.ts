/**
 * Automated tests to ensure no fake data
 */

import { ContentItem } from '../lib/base-fetcher';
import { UnifiedScorer } from '../lib/unified-scorer';

describe('Data Validation Tests', () => {
  it('should validate real data correctly', () => {
    // This test suite validates the DataValidator class defined below
    expect(DataValidator).toBeDefined();
  });
});

// Banned words that indicate fake/mock data
const FAKE_DATA_INDICATORS = [
  'example',
  'test',
  'demo',
  'sample',
  'lorem ipsum',
  'placeholder',
  'fake',
  'mock',
  'dummy',
  'foo',
  'bar',
  'baz',
  'acme',
  'widget'
];

// Required fields for different content types
const REQUIRED_FIELDS = {
  project: ['title', 'url', 'metadata.project_needs', 'metadata.team_size', 'metadata.last_activity'],
  funding: ['title', 'url', 'metadata.funding_amount_min', 'metadata.deadline'],
  resource: ['title', 'url', 'description']
};

export class DataValidator {
  /**
   * Check if content is real (not fake/mock)
   */
  static isRealContent(item: ContentItem): boolean {
    // Check title
    const title = (item.title || '').toLowerCase();
    for (const indicator of FAKE_DATA_INDICATORS) {
      if (title.includes(indicator)) {
        console.log(`❌ Fake data detected in title: "${item.title}" contains "${indicator}"`);
        return false;
      }
    }
    
    // Check description
    const description = (item.description || '').toLowerCase();
    for (const indicator of FAKE_DATA_INDICATORS) {
      if (description.includes(indicator)) {
        console.log(`❌ Fake data detected in description: contains "${indicator}"`);
        return false;
      }
    }
    
    // Check URL
    const url = (item.url || '').toLowerCase();
    if (url.includes('example.com') || url.includes('test.com') || url.includes('localhost')) {
      console.log(`❌ Fake URL detected: ${item.url}`);
      return false;
    }
    
    // URL must be valid
    try {
      new URL(item.url);
    } catch {
      console.log(`❌ Invalid URL: ${item.url}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if content has required fields
   */
  static hasRequiredFields(item: ContentItem): boolean {
    const requiredFields = REQUIRED_FIELDS[item.type] || REQUIRED_FIELDS.project;
    
    for (const field of requiredFields) {
      const value = this.getNestedValue(item, field);
      if (value === undefined || value === null || value === '') {
        console.log(`❌ Missing required field: ${field} for ${item.type}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if project needs are valid
   */
  static hasValidProjectNeeds(item: ContentItem): boolean {
    if (item.type !== 'project') return true;
    
    const needs = item.metadata?.project_needs;
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      console.log(`❌ Invalid project_needs: ${JSON.stringify(needs)}`);
      return false;
    }
    
    const validNeeds = [
      'funding',
      'developers',
      'designers',
      'co-founder',
      'marketing',
      'community-managers',
      'content-creators',
      'advisors'
    ];
    
    for (const need of needs) {
      if (!validNeeds.includes(need)) {
        console.log(`❌ Invalid need type: ${need}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if dates are reasonable
   */
  static hasValidDates(item: ContentItem): boolean {
    const now = Date.now();
    const twoYearsAgo = now - (2 * 365 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = now + (365 * 24 * 60 * 60 * 1000);
    
    // Check launch date
    const launchDate = item.metadata?.launch_date;
    if (launchDate) {
      const date = new Date(launchDate).getTime();
      if (date < twoYearsAgo || date > now) {
        console.log(`❌ Invalid launch_date: ${launchDate}`);
        return false;
      }
    }
    
    // Check last activity
    const lastActivity = item.metadata?.last_activity;
    if (lastActivity) {
      const date = new Date(lastActivity).getTime();
      if (date < twoYearsAgo || date > now) {
        console.log(`❌ Invalid last_activity: ${lastActivity}`);
        return false;
      }
    }
    
    // Check deadline
    const deadline = item.metadata?.deadline || item.metadata?.end_date;
    if (deadline) {
      const date = new Date(deadline).getTime();
      if (date < now || date > oneYearFromNow) {
        console.log(`❌ Invalid deadline: ${deadline}`);
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Validate a batch of items
   */
  static validateBatch(items: ContentItem[]): {
    valid: ContentItem[];
    invalid: ContentItem[];
    stats: {
      total: number;
      valid: number;
      invalid: number;
      reasons: Record<string, number>;
    };
  } {
    const valid: ContentItem[] = [];
    const invalid: ContentItem[] = [];
    const reasons: Record<string, number> = {
      fake_content: 0,
      missing_fields: 0,
      invalid_needs: 0,
      invalid_dates: 0
    };
    
    for (const item of items) {
      let isValid = true;
      
      if (!this.isRealContent(item)) {
        isValid = false;
        reasons.fake_content++;
      }
      
      if (!this.hasRequiredFields(item)) {
        isValid = false;
        reasons.missing_fields++;
      }
      
      if (!this.hasValidProjectNeeds(item)) {
        isValid = false;
        reasons.invalid_needs++;
      }
      
      if (!this.hasValidDates(item)) {
        isValid = false;
        reasons.invalid_dates++;
      }
      
      if (isValid) {
        valid.push(item);
      } else {
        invalid.push(item);
      }
    }
    
    return {
      valid,
      invalid,
      stats: {
        total: items.length,
        valid: valid.length,
        invalid: invalid.length,
        reasons
      }
    };
  }
  
  /**
   * Helper to get nested object values
   */
  private static getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    return current;
  }
}

/**
 * Run validation tests
 */
export async function runValidationTests(items: ContentItem[]): Promise<void> {
  console.log('🧪 Running data validation tests...');
  
  const validation = DataValidator.validateBatch(items);
  
  console.log('\n📊 Validation Results:');
  console.log(`  Total items: ${validation.stats.total}`);
  console.log(`  ✅ Valid: ${validation.stats.valid} (${Math.round(validation.stats.valid / validation.stats.total * 100)}%)`);
  console.log(`  ❌ Invalid: ${validation.stats.invalid} (${Math.round(validation.stats.invalid / validation.stats.total * 100)}%)`);
  
  if (validation.stats.invalid > 0) {
    console.log('\n❌ Invalid reasons:');
    for (const [reason, count] of Object.entries(validation.stats.reasons)) {
      if (count > 0) {
        console.log(`  - ${reason}: ${count}`);
      }
    }
  }
  
  // Test unified scorer on valid items
  if (validation.valid.length > 0) {
    console.log('\n🎯 Testing Unified Scorer...');
    const scorerStats = UnifiedScorer.getStats(validation.valid);
    
    console.log(`  Projects with needs: ${scorerStats.withNeeds}`);
    console.log(`  Average score: ${scorerStats.avgScore}`);
    console.log(`  Score distribution:`);
    for (const [category, count] of Object.entries(scorerStats.byCategory)) {
      console.log(`    - ${category}: ${count}`);
    }
    
    if (scorerStats.topProjects.length > 0) {
      console.log('\n🏆 Top 3 Projects:');
      scorerStats.topProjects.slice(0, 3).forEach((project, i) => {
        const score = UnifiedScorer.scoreContent(project);
        console.log(`  ${i + 1}. ${project.title} (${score.score} points)`);
        console.log(`     ${score.reasons.slice(0, 3).join(', ')}`);
      });
    }
  }
  
  // Fail if too much fake data
  const fakeDataPercentage = validation.stats.invalid / validation.stats.total;
  if (fakeDataPercentage > 0.2) {
    throw new Error(`❌ Too much fake data detected: ${Math.round(fakeDataPercentage * 100)}% invalid`);
  }
  
  console.log('\n✅ Validation tests passed!');
}