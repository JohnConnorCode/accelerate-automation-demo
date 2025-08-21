import { supabase } from './supabase-client';
import { ContentItem } from './base-fetcher';

export class DuplicateDetector {
  // Check for duplicates before inserting new items
  async checkDuplicates(items: ContentItem[]): Promise<{
    unique: ContentItem[];
    duplicates: Array<{ item: ContentItem; existingId: string; similarity: number }>;
  }> {
    const unique: ContentItem[] = [];
    const duplicates: Array<{ item: ContentItem; existingId: string; similarity: number }> = [];

    for (const item of items) {
      const isDuplicate = await this.isDuplicate(item);
      
      if (isDuplicate) {
        duplicates.push(isDuplicate);
      } else {
        unique.push(item);
      }
    }

    return { unique, duplicates };
  }

  private async isDuplicate(item: ContentItem): Promise<{ 
    item: ContentItem; 
    existingId: string; 
    similarity: number 
  } | null> {
    const table = this.getTableName(item.type);
    
    // Check by exact URL match
    if (item.url) {
      const { data: exactMatch } = await supabase
        .from(table)
        .select('id, name, url')
        .or(`url.eq.${item.url},website_url.eq.${item.url},github_url.eq.${item.url}`)
        .single();

      if (exactMatch) {
        return {
          item,
          existingId: exactMatch.id,
          similarity: 100
        };
      }
    }

    // Check by name similarity
    const { data: nameMatches } = await supabase
      .from(table)
      .select('id, name, description')
      .ilike('name', `%${this.sanitizeName(item.title)}%`)
      .limit(5);

    if (nameMatches && nameMatches.length > 0) {
      for (const match of nameMatches) {
        const similarity = this.calculateSimilarity(item, match);
        
        if (similarity > 85) { // 85% similarity threshold
          return {
            item,
            existingId: match.id,
            similarity
          };
        }
      }
    }

    // Check by description similarity for high confidence matches
    if (item.description && item.description.length > 50) {
      const descriptionWords = this.extractKeywords(item.description);
      
      if (descriptionWords.length > 3) {
        const searchQuery = descriptionWords.slice(0, 3).join(' & ');
        
        const { data: descMatches } = await supabase
          .from(table)
          .select('id, name, description')
          .textSearch('description', searchQuery)
          .limit(3);

        if (descMatches && descMatches.length > 0) {
          for (const match of descMatches) {
            const similarity = this.calculateDescriptionSimilarity(
              item.description,
              match.description
            );
            
            if (similarity > 90) { // High threshold for description matching
              return {
                item,
                existingId: match.id,
                similarity
              };
            }
          }
        }
      }
    }

    return null;
  }

  private getTableName(type: string): string {
    switch (type) {
      case 'project':
        return 'projects';
      case 'funding':
        return 'funding_programs';
      case 'resource':
        return 'resources';
      default:
        return 'projects';
    }
  }

  private sanitizeName(title: string): string {
    // Remove common suffixes and clean the name for matching
    return title
      .toLowerCase()
      .replace(/\s+(inc|llc|ltd|corp|co|labs?|protocol|finance|defi|dao|network|platform|app|io)\.?$/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
  }

  private calculateSimilarity(item: ContentItem, existingItem: any): number {
    let score = 0;
    let factors = 0;

    // Name similarity (40% weight)
    if (item.title && existingItem.name) {
      const nameSim = this.stringSimilarity(
        this.sanitizeName(item.title),
        this.sanitizeName(existingItem.name)
      );
      score += nameSim * 40;
      factors += 40;
    }

    // Description similarity (30% weight)
    if (item.description && existingItem.description) {
      const descSim = this.calculateDescriptionSimilarity(
        item.description,
        existingItem.description
      );
      score += descSim * 30;
      factors += 30;
    }

    // URL domain similarity (30% weight)
    if (item.url && (existingItem.url || existingItem.website_url)) {
      const itemDomain = this.extractDomain(item.url);
      const existingDomain = this.extractDomain(existingItem.url || existingItem.website_url);
      
      if (itemDomain === existingDomain) {
        score += 30;
        factors += 30;
      }
    }

    return factors > 0 ? (score / factors) * 100 : 0;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
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

  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = this.extractKeywords(desc1);
    const words2 = this.extractKeywords(desc2);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return union.length > 0 ? (intersection.length / union.length) * 100 : 0;
  }

  private extractKeywords(text: string): string[] {
    // Extract meaningful keywords from text
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'been', 'be',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very'
    ]);

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 20); // Limit to top 20 keywords
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  // Merge duplicate items intelligently
  async mergeDuplicates(
    newItem: ContentItem,
    existingId: string
  ): Promise<void> {
    const table = this.getTableName(newItem.type);
    
    // Fetch existing item
    const { data: existing } = await supabase
      .from(table)
      .select('*')
      .eq('id', existingId)
      .single();

    if (!existing) return;

    // Merge data - keep better/more complete information
    const merged = {
      ...existing,
      // Update with non-null new values
      description: newItem.description && newItem.description.length > (existing.description?.length || 0)
        ? newItem.description
        : existing.description,
      
      // Merge URLs
      website_url: newItem.url || existing.website_url,
      github_url: newItem.metadata?.github_url || existing.github_url,
      
      // Update scores if higher (using metadata)
      score: Math.max(newItem.metadata?.score || 0, existing.score || 0),
      
      // Merge categories/tags
      categories: [...new Set([
        ...(existing.categories || []),
        ...(newItem.metadata?.categories || [])
      ])],
      
      // Update metadata
      last_seen: new Date().toISOString(),
      sources: [...new Set([
        ...(existing.sources || []),
        newItem.source
      ])],
      
      // Increment duplicate count
      duplicate_count: (existing.duplicate_count || 0) + 1
    };

    // Update the existing record
    await supabase
      .from(table)
      .update(merged)
      .eq('id', existingId);
  }
}