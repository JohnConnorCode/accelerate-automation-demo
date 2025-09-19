/**
 * Deduplication service for content
 */
import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase';
import { logger } from './logger';

export class DeduplicationService {
  /**
   * Generate content hash for deduplication
   * Using a browser-compatible approach
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

    // Simple browser-compatible hash function
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to hex string
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Check if content already exists
   */
  async checkDuplicate(hash: string, table: string = 'content_queue'): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('content_hash', hash)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error checking duplicate', { error, hash, table });
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Failed to check duplicate', { error });
      return false;
    }
  }

  /**
   * Find similar content by URL
   */
  async findSimilarByUrl(url: string, table: string = 'content_queue'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike('url', `%${url}%`)
        .limit(5);

      if (error) {
        logger.error('Error finding similar content', { error, url, table });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to find similar content', { error });
      return [];
    }
  }

  /**
   * Find similar content by title
   */
  async findSimilarByTitle(title: string, table: string = 'content_queue'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .ilike('title', `%${title}%`)
        .limit(5);

      if (error) {
        logger.error('Error finding similar by title', { error, title, table });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Failed to find similar by title', { error });
      return [];
    }
  }

  /**
   * Batch check for duplicates
   */
  async batchCheckDuplicates(items: Array<{
    title?: string;
    url?: string;
    description?: string;
  }>, table: string = 'content_queue'): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    // Generate hashes for all items
    const hashes = items.map(item => this.generateHash(item));

    try {
      const { data, error } = await supabase
        .from(table)
        .select('content_hash')
        .in('content_hash', hashes);

      if (error) {
        logger.error('Error batch checking duplicates', { error });
        // Return all as non-duplicates on error
        hashes.forEach(hash => results.set(hash, false));
        return results;
      }

      const existingHashes = new Set((data || []).map(d => d.content_hash));
      hashes.forEach(hash => {
        results.set(hash, existingHashes.has(hash));
      });

      return results;
    } catch (error) {
      logger.error('Failed to batch check duplicates', { error });
      hashes.forEach(hash => results.set(hash, false));
      return results;
    }
  }
}

// Export singleton instance
export const deduplicationService = new DeduplicationService();