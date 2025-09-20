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
      // Check by URL since that's a reliable unique identifier
      const { data, error } = await supabase
        .from(table)
        .select('id')
        .eq('url', hash)
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
   * Filter out duplicates from an array of items
   */
  async filterDuplicates(items: Array<{
    title?: string;
    url?: string;
    description?: string;
    [key: string]: any;
  }>, table: string = 'content_queue'): Promise<{ unique: Array<any>, duplicates: Array<any> }> {
    if (!items || items.length === 0) {
      return { unique: [], duplicates: [] };
    }

    const duplicateMap = await this.batchCheckDuplicates(items, table);

    const unique: Array<any> = [];
    const duplicates: Array<any> = [];

    items.forEach(item => {
      const hash = this.generateHash(item);
      if (duplicateMap.get(hash)) {
        duplicates.push(item);
      } else {
        unique.push(item);
      }
    });

    return { unique, duplicates };
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

    // Check by URL and title for better deduplication
    try {
      const urls = items.map(item => item.url).filter(url => url);
      const titles = items.map(item => item.title || item.description?.substring(0, 100)).filter(title => title);

      // Check both URLs and titles
      let existingUrls = new Set<string>();
      let existingTitles = new Set<string>();

      if (urls.length > 0) {
        const { data: urlData, error: urlError } = await supabase
          .from(table)
          .select('url')
          .in('url', urls);

        if (!urlError && urlData) {
          existingUrls = new Set(urlData.map(d => d.url));
        }
      }

      if (titles.length > 0) {
        const { data: titleData, error: titleError } = await supabase
          .from(table)
          .select('title')
          .in('title', titles);

        if (!titleError && titleData) {
          existingTitles = new Set(titleData.map(d => d.title));
        }
      }

      // Mark as duplicate if URL or title matches
      items.forEach((item, index) => {
        const hash = hashes[index];
        const urlExists = item.url ? existingUrls.has(item.url) : false;
        const titleExists = item.title ? existingTitles.has(item.title) : false;
        const isDuplicate = urlExists || titleExists;
        results.set(hash, isDuplicate);
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