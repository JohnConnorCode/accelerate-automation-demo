import { supabase } from './supabase';
import crypto from 'crypto';

interface ContentItem {
  url: string;
  title: string;
  description: string;
  [key: string]: any;
}

interface DuplicateResult {
  isDuplicate: boolean;
  existingId?: string;
  similarity?: number;
  reason?: string;
}

export class DeduplicationService {
  private similarityThreshold: number;
  private checkDays: number;
  private urlCache: Map<string, string> = new Map();

  constructor() {
    this.similarityThreshold = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.7');
    this.checkDays = parseInt(process.env.DEDUP_CHECK_DAYS || '30');
  }

  // Normalize URL for consistent comparison
  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url.toLowerCase());
      
      // Remove common tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid'];
      trackingParams.forEach(param => u.searchParams.delete(param));
      
      // Remove www. and trailing slash
      const normalized = `${u.protocol}//${u.hostname.replace('www.', '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
      
      return normalized;
    } catch {
      return url.toLowerCase();
    }
  }

  // Generate content hash for exact duplicate detection
  private generateContentHash(content: ContentItem): string {
    const normalized = {
      url: this.normalizeUrl(content.url),
      title: content.title.toLowerCase().trim(),
      description: content.description?.toLowerCase().trim() || '',
    };
    
    const data = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Calculate Jaccard similarity between two texts
  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  // Calculate Levenshtein distance for string similarity
  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    const maxLen = Math.max(m, n);
    return maxLen > 0 ? 1 - (dp[m][n] / maxLen) : 1;
  }

  // Combined similarity score
  private calculateSimilarity(item1: ContentItem, item2: ContentItem): number {
    // URL similarity (exact match after normalization)
    const urlMatch = this.normalizeUrl(item1.url) === this.normalizeUrl(item2.url) ? 1 : 0;
    
    // Title similarity
    const titleJaccard = this.calculateJaccardSimilarity(item1.title, item2.title);
    const titleLevenshtein = this.calculateLevenshteinSimilarity(item1.title, item2.title);
    const titleSimilarity = (titleJaccard + titleLevenshtein) / 2;
    
    // Description similarity
    const descJaccard = this.calculateJaccardSimilarity(
      item1.description || '',
      item2.description || ''
    );
    const descLevenshtein = this.calculateLevenshteinSimilarity(
      item1.description || '',
      item2.description || ''
    );
    const descSimilarity = (descJaccard + descLevenshtein) / 2;
    
    // Weighted average (URL match is most important)
    return urlMatch * 0.5 + titleSimilarity * 0.3 + descSimilarity * 0.2;
  }

  // Check for duplicates in the database
  async checkDuplicate(item: ContentItem): Promise<DuplicateResult> {
    try {
      // First check exact URL match
      const normalizedUrl = this.normalizeUrl(item.url);
      
      const { data: exactMatch, error: exactError } = await supabase
        .from('content_queue')
        .select('id, url, title, description')
        .eq('url', item.url)
        .single();
      
      if (exactMatch) {
        return {
          isDuplicate: true,
          existingId: exactMatch.id,
          similarity: 1.0,
          reason: 'Exact URL match',
        };
      }

      // Check for similar content within the time window
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - this.checkDays);
      
      const { data: recentItems, error: recentError } = await supabase
        .from('content_queue')
        .select('id, url, title, description')
        .gte('created_at', checkDate.toISOString())
        .limit(1000);
      
      if (recentItems && recentItems.length > 0) {
        for (const existing of recentItems) {
          const similarity = this.calculateSimilarity(item, existing);
          
          if (similarity >= this.similarityThreshold) {
            return {
              isDuplicate: true,
              existingId: existing.id,
              similarity,
              reason: `High similarity (${(similarity * 100).toFixed(1)}%)`,
            };
          }
        }
      }

      // Check using PostgreSQL similarity function if available
      const { data: similarItems, error: similarError } = await supabase
        .rpc('find_similar_content', {
          p_title: item.title,
          p_description: item.description,
          p_threshold: this.similarityThreshold,
        });
      
      if (similarItems && similarItems.length > 0) {
        const mostSimilar = similarItems[0];
        return {
          isDuplicate: true,
          existingId: mostSimilar.id,
          similarity: mostSimilar.similarity_score,
          reason: 'Database similarity match',
        };
      }

      return {
        isDuplicate: false,
      };
    } catch (error) {
      console.error('[Dedup] Error checking duplicate:', error);
      // On error, assume not duplicate to avoid blocking content
      return {
        isDuplicate: false,
      };
    }
  }

  // Batch deduplication for multiple items
  async deduplicateBatch(items: ContentItem[]): Promise<ContentItem[]> {
    const unique: ContentItem[] = [];
    const seen = new Set<string>();
    
    // First pass: Remove duplicates within the batch
    for (const item of items) {
      const hash = this.generateContentHash(item);
      const normalizedUrl = this.normalizeUrl(item.url);
      
      if (!seen.has(hash) && !seen.has(normalizedUrl)) {
        seen.add(hash);
        seen.add(normalizedUrl);
        unique.push(item);
      }
    }
    
    // Second pass: Check against database
    const finalUnique: ContentItem[] = [];
    
    for (const item of unique) {
      const result = await this.checkDuplicate(item);
      
      if (!result.isDuplicate) {
        finalUnique.push(item);
      } else {
        console.log(`[Dedup] Duplicate found: ${item.title} - ${result.reason}`);
      }
    }
    
    console.log(`[Dedup] Processed ${items.length} items, ${finalUnique.length} unique`);
    return finalUnique;
  }

  // Clean up old duplicates from the database
  async cleanupDuplicates(): Promise<number> {
    try {
      // Find all duplicates
      const { data: allItems, error } = await supabase
        .from('content_queue')
        .select('id, url, title, description, created_at')
        .order('created_at', { ascending: true });
      
      if (error || !allItems) {
        throw error;
      }
      
      const duplicates: string[] = [];
      const seen = new Map<string, string>();
      
      for (const item of allItems) {
        const hash = this.generateContentHash(item);
        
        if (seen.has(hash)) {
          // Keep the older one, mark newer as duplicate
          duplicates.push(item.id);
        } else {
          seen.set(hash, item.id);
        }
      }
      
      if (duplicates.length > 0) {
        // Mark duplicates
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ status: 'duplicate' })
          .in('id', duplicates);
        
        if (updateError) {
          throw updateError;
        }
        
        console.log(`[Dedup] Marked ${duplicates.length} duplicates`);
      }
      
      return duplicates.length;
    } catch (error) {
      console.error('[Dedup] Cleanup error:', error);
      return 0;
    }
  }

  // Get deduplication statistics
  async getStats(): Promise<any> {
    try {
      const { data: stats, error } = await supabase
        .from('content_queue')
        .select('status')
        .eq('status', 'duplicate');
      
      const duplicateCount = stats?.length || 0;
      
      const { count: totalCount } = await supabase
        .from('content_queue')
        .select('*', { count: 'exact', head: true });
      
      return {
        duplicates: duplicateCount,
        total: totalCount || 0,
        duplicateRate: totalCount ? duplicateCount / totalCount : 0,
        threshold: this.similarityThreshold,
        checkDays: this.checkDays,
      };
    } catch (error) {
      console.error('[Dedup] Stats error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const deduplicationService = new DeduplicationService();