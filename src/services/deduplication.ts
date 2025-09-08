/**
 * Deduplication service for content
 */
import crypto from 'crypto';
import { supabase } from '../lib/supabase';
import { logger } from './logger';

export class DeduplicationService {
  /**
   * Generate content hash for deduplication
   */
  generateHash(content: {
    title?: string;
    url?: string;
    description?: string;
  }): string {
    const normalized = {
      title: (content.title || '').toLowerCase().trim(),
      url: (content.url || '').toLowerCase().trim(),
      description: (content.description || '').toLowerCase().trim().substring(0, 200)
    };
    
    const str = `${normalized.title}|${normalized.url}|${normalized.description}`;
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Check if content already exists
   */
  async isDuplicate(content: any): Promise<boolean> {
    try {
      // Check BOTH queue AND curated tables for duplicates
      if (content.url) {
        // Check queue first (pending items)
        const { data: queueMatch } = await supabase
          .from('content_queue')
          .select('id')
          .eq('url', content.url)
          .limit(1);
        
        if (queueMatch && queueMatch.length > 0) {
          console.log(`🔁 Duplicate in QUEUE: ${content.url}`);
          logger.debug('Duplicate found in queue', { url: content.url });
          return true;
        }
        
        // Also check curated (approved items)
        const { data: curatedMatch } = await supabase
          .from('content_curated')
          .select('id')
          .eq('url', content.url)
          .limit(1);
        
        if (curatedMatch && curatedMatch.length > 0) {
          console.log(`🔁 Duplicate in CURATED: ${content.url}`);
          logger.debug('Duplicate found in curated', { url: content.url });
          return true;
        }
        
        console.log(`✨ NEW content: ${content.url}`);
      }

      // DISABLED: Hash checking is too aggressive, blocking good content
      // Only URL matching is needed to prevent true duplicates
      // Also disabling fuzzy title matching - it's too aggressive
      return false;
      
      /* DISABLED - TOO STRICT
      // Fuzzy matching for similar titles
      if (content.title) {
        const { data: titleMatch } = await supabase
          .from('content_curated')
          .select('id, title')
          .ilike('title', `%${content.title.substring(0, 50)}%`)
          .limit(5);
        
        if (titleMatch && titleMatch.length > 0) {
          for (const match of titleMatch) {
            const similarity = this.calculateSimilarity(content.title, match.title);
            if (similarity > 0.85) {
              logger.debug('Duplicate found by title similarity', { 
                title: content.title,
                match: match.title,
                similarity 
              });
              return true;
            }
          }
        }
      }

      return false;
      */
    } catch (error) {
      logger.error('Error checking for duplicates', error);
      return false; // Don't block on error
    }
  }

  /**
   * Calculate string similarity (Levenshtein distance)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Batch check for duplicates
   */
  async filterDuplicates(items: any[]): Promise<{
    unique: any[];
    duplicates: any[];
  }> {
    const unique = [];
    const duplicates = [];
    
    for (const item of items) {
      const isDupe = await this.isDuplicate(item);
      if (isDupe) {
        duplicates.push(item);
      } else {
        // Add hash to item for storage
        item.content_hash = this.generateHash(item);
        unique.push(item);
      }
    }
    
    logger.info('Deduplication complete', {
      total: items.length,
      unique: unique.length,
      duplicates: duplicates.length
    });
    
    return { unique, duplicates };
  }

  /**
   * Clean up old duplicates in database
   */
  async cleanupDuplicates(): Promise<number> {
    try {
      // Find duplicates by URL
      const { data: urlDupes } = await supabase
        .rpc('find_duplicate_urls');
      
      let removed = 0;
      
      if (urlDupes && urlDupes.length > 0) {
        for (const dupe of urlDupes) {
          // Keep the oldest, delete newer duplicates
          const { error } = await supabase
            .from('content_curated')
            .delete()
            .eq('url', dupe.url)
            .gt('created_at', dupe.min_created_at);
          
          if (!error) {
            removed += dupe.count - 1;
          }
        }
      }
      
      logger.info(`Cleaned up ${removed} duplicate entries`);
      return removed;
    } catch (error) {
      logger.error('Error cleaning duplicates', error);
      return 0;
    }
  }
}

// Export singleton
export const deduplicationService = new DeduplicationService();