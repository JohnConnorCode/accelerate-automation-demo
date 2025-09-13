import { ContentItem } from '../lib/base-fetcher';

/**
 * ENTITY RESOLVER SERVICE
 * Matches and merges data about the same entity from multiple sources
 * Creates unified profiles with the richest possible data
 */

interface EntityMatch {
  confidence: number; // 0-1 confidence score
  reason: string; // Why we think these match
  items: ContentItem[]; // All items that match
}

interface UnifiedEntity {
  id: string;
  canonical_name: string;
  aliases: string[];
  domains: string[];
  social_handles: {
    twitter?: string;
    github?: string;
    discord?: string;
    linkedin?: string;
  };
  sources: string[];
  items: ContentItem[];
  merged_metadata: Record<string, any>;
  confidence_score: number;
  last_verified: Date;
}

export class EntityResolver {
  /**
   * Resolve and merge entities from multiple content items
   */
  public resolveEntities(items: ContentItem[]): UnifiedEntity[] {
    const entities: UnifiedEntity[] = [];
    const processed = new Set<number>();
    
    // Group items by potential matches
    for (let i = 0; i < items.length; i++) {
      if (processed.has(i)) {continue;}
      
      const matches: ContentItem[] = [items[i]];
      processed.add(i);
      
      // Find all potential matches for this item
      for (let j = i + 1; j < items.length; j++) {
        if (processed.has(j)) {continue;}
        
        const matchScore = this.calculateMatchScore(items[i], items[j]);
        
        if (matchScore.confidence > 0.7) {
          matches.push(items[j]);
          processed.add(j);
        }
      }
      
      // Create unified entity from matches
      if (matches.length > 0) {
        const entity = this.createUnifiedEntity(matches);
        entities.push(entity);
      }
    }
    
    console.log(`🔗 Resolved ${items.length} items into ${entities.length} unique entities`);
    
    return entities;
  }
  
  /**
   * Calculate match confidence between two items
   */
  private calculateMatchScore(item1: ContentItem, item2: ContentItem): { confidence: number; reason: string } {
    const reasons: string[] = [];
    let score = 0;
    
    // 1. Exact name match (high confidence)
    if (this.normalizeCompanyName(item1.title) === this.normalizeCompanyName(item2.title)) {
      score += 0.5;
      reasons.push('exact name match');
    }
    
    // 2. Domain match (very high confidence)
    const domain1 = this.extractDomain(item1.url);
    const domain2 = this.extractDomain(item2.url);
    if (domain1 && domain2 && domain1 === domain2) {
      score += 0.6;
      reasons.push('same domain');
    }
    
    // 3. Fuzzy name match
    const similarity = this.stringSimilarity(
      this.normalizeCompanyName(item1.title),
      this.normalizeCompanyName(item2.title)
    );
    if (similarity > 0.8) {
      score += similarity * 0.3;
      reasons.push('similar name');
    }
    
    // 4. Social handle match
    const social1 = this.extractSocialHandles(item1);
    const social2 = this.extractSocialHandles(item2);
    
    if (social1.twitter && social2.twitter && social1.twitter === social2.twitter) {
      score += 0.4;
      reasons.push('same Twitter');
    }
    
    if (social1.github && social2.github && social1.github === social2.github) {
      score += 0.4;
      reasons.push('same GitHub');
    }
    
    // 5. Founder name match
    const founders1 = this.extractFounderNames(item1);
    const founders2 = this.extractFounderNames(item2);
    
    const commonFounders = founders1.filter(f => founders2.includes(f));
    if (commonFounders.length > 0) {
      score += 0.3;
      reasons.push('same founders');
    }
    
    // 6. Description similarity
    const descSimilarity = this.stringSimilarity(
      item1.description.substring(0, 200),
      item2.description.substring(0, 200)
    );
    if (descSimilarity > 0.7) {
      score += descSimilarity * 0.2;
      reasons.push('similar description');
    }
    
    // 7. YC batch match (high confidence for YC companies)
    if (item1.metadata?.yc_batch && item2.metadata?.yc_batch && 
        item1.metadata.yc_batch === item2.metadata.yc_batch) {
      // If same batch and similar name, very likely same company
      if (similarity > 0.6) {
        score += 0.5;
        reasons.push('same YC batch');
      }
    }
    
    // 8. Temporal proximity (launched around same time)
    const date1 = new Date(item1.metadata?.launch_date || item1.published || 0);
    const date2 = new Date(item2.metadata?.launch_date || item2.published || 0);
    const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 30 && similarity > 0.6) {
      score += 0.1;
      reasons.push('launched same month');
    }
    
    return {
      confidence: Math.min(1, score),
      reason: reasons.join(', ')
    };
  }
  
  /**
   * Create a unified entity from multiple matching items
   */
  private createUnifiedEntity(items: ContentItem[]): UnifiedEntity {
    // Sort by data richness (prefer items with more metadata)
    const sortedItems = items.sort((a, b) => {
      const scoreA = this.calculateDataRichness(a);
      const scoreB = this.calculateDataRichness(b);
      return scoreB - scoreA;
    });
    
    const primary = sortedItems[0];
    
    // Collect all unique values
    const names = new Set<string>();
    const domains = new Set<string>();
    const sources = new Set<string>();
    const socialHandles: any = {};
    
    // Merge metadata, preferring non-null values
    const mergedMetadata: Record<string, any> = {};
    
    for (const item of sortedItems) {
      // Collect names
      names.add(item.title);
      if (item.metadata?.startup_name) {names.add(item.metadata.startup_name);}
      
      // Collect domains
      const domain = this.extractDomain(item.url);
      if (domain) {domains.add(domain);}
      
      // Collect sources
      sources.add(item.source);
      
      // Collect social handles
      const handles = this.extractSocialHandles(item);
      if (handles.twitter) {socialHandles.twitter = handles.twitter;}
      if (handles.github) {socialHandles.github = handles.github;}
      if (handles.discord) {socialHandles.discord = handles.discord;}
      
      // Merge metadata (prefer non-null, higher values for scores)
      if (item.metadata) {
        for (const [key, value] of Object.entries(item.metadata)) {
          if (value !== null && value !== undefined) {
            // For scores, take the maximum
            if (key.includes('score') || key === 'funding_raised' || key === 'team_size') {
              mergedMetadata[key] = Math.max(mergedMetadata[key] || 0, value as number);
            }
            // For arrays, combine unique values
            else if (Array.isArray(value)) {
              mergedMetadata[key] = [...new Set([
                ...(mergedMetadata[key] || []),
                ...value
              ])];
            }
            // For other values, prefer from richer sources
            else if (!mergedMetadata[key]) {
              mergedMetadata[key] = value;
            }
          }
        }
      }
    }
    
    // Calculate unified confidence
    const avgConfidence = sortedItems.reduce((sum, item) => {
      return sum + (item.metadata?.credibility_score || 50) / 100;
    }, 0) / sortedItems.length;
    
    return {
      id: `entity-${this.generateHash(primary.title)}`,
      canonical_name: this.selectCanonicalName(Array.from(names)),
      aliases: Array.from(names),
      domains: Array.from(domains),
      social_handles: socialHandles,
      sources: Array.from(sources),
      items: sortedItems,
      merged_metadata: mergedMetadata,
      confidence_score: avgConfidence,
      last_verified: new Date(),
    };
  }
  
  /**
   * Calculate how rich/complete an item's data is
   */
  private calculateDataRichness(item: ContentItem): number {
    let score = 0;
    
    // Basic fields
    if (item.title) {score += 1;}
    if (item.description?.length > 100) {score += 2;}
    if (item.url && !item.url.includes('reddit.com')) {score += 2;}
    
    // Metadata fields
    const meta = item.metadata || {};
    if (meta.funding_raised) {score += 3;}
    if (meta.team_size) {score += 2;}
    if (meta.yc_batch) {score += 5;} // YC data is high quality
    if (meta.github_url) {score += 2;}
    if (meta.twitter_url) {score += 2;}
    if (meta.launch_date) {score += 1;}
    if (meta.accelerate_score > 50) {score += 2;}
    if (meta.ai_score) {score += 3;}
    
    // Source quality
    if (item.source === 'YCombinator') {score += 5;}
    if (item.source === 'Wellfound') {score += 4;}
    if (item.source === 'ProductHunt') {score += 3;}
    if (item.source === 'HackerNews') {score += 2;}
    
    return score;
  }
  
  /**
   * Normalize company name for matching
   */
  private normalizeCompanyName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s*(inc|llc|ltd|corp|company|co|io|ai|app|labs?|\.com|\.io|\.ai)\s*/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }
  
  /**
   * Extract domain from URL
   */
  private extractDomain(url?: string): string | null {
    if (!url) {return null;}
    
    try {
      const u = new URL(url);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
  
  /**
   * Extract social handles from item
   */
  private extractSocialHandles(item: ContentItem): {
    twitter?: string;
    github?: string;
    discord?: string;
    linkedin?: string;
  } {
    const handles: any = {};
    
    // From metadata
    if (item.metadata?.twitter_url) {
      const match = item.metadata.twitter_url.match(/twitter\.com\/([^\/]+)/);
      if (match) {handles.twitter = match[1];}
    }
    
    if (item.metadata?.github_url) {
      const match = item.metadata.github_url.match(/github\.com\/([^\/]+)/);
      if (match) {handles.github = match[1];}
    }
    
    // From description
    const twitterMatch = item.description.match(/@([A-Za-z0-9_]+)/);
    if (twitterMatch) {handles.twitter = twitterMatch[1];}
    
    return handles;
  }
  
  /**
   * Extract founder names from item
   */
  private extractFounderNames(item: ContentItem): string[] {
    const names: string[] = [];
    
    // From author field
    if (item.author && !item.author.includes('Bot')) {
      names.push(item.author.toLowerCase());
    }
    
    // From description (look for "founded by", "created by", etc.)
    const founderMatch = item.description.match(/(?:founded|created|built) by ([A-Z][a-z]+ [A-Z][a-z]+)/);
    if (founderMatch) {
      names.push(founderMatch[1].toLowerCase());
    }
    
    return names;
  }
  
  /**
   * Calculate string similarity (Levenshtein-based)
   */
  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {return 1.0;}
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  /**
   * Calculate Levenshtein distance
   */
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
  
  /**
   * Select the best canonical name from aliases
   */
  private selectCanonicalName(names: string[]): string {
    // Prefer shorter, cleaner names
    const sorted = names.sort((a, b) => {
      // Prefer names without special characters
      const cleanA = a.match(/^[A-Za-z0-9\s]+$/) ? 0 : 1;
      const cleanB = b.match(/^[A-Za-z0-9\s]+$/) ? 0 : 1;
      if (cleanA !== cleanB) {return cleanA - cleanB;}
      
      // Prefer shorter names
      return a.length - b.length;
    });
    
    return sorted[0];
  }
  
  /**
   * Generate a hash for entity ID
   */
  private generateHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Convert unified entities back to enriched ContentItems
   */
  public entitiesToContentItems(entities: UnifiedEntity[]): ContentItem[] {
    return entities.map(entity => {
      // Use the richest item as base
      const baseItem = entity.items[0];
      
      return {
        ...baseItem,
        title: entity.canonical_name,
        description: this.mergeDescriptions(entity.items),
        url: entity.domains[0] ? `https://${entity.domains[0]}` : baseItem.url,
        source: entity.sources.join(', '),
        tags: this.mergeTags(entity.items),
        metadata: {
          ...entity.merged_metadata,
          entity_id: entity.id,
          merged_from_sources: entity.sources,
          match_confidence: entity.confidence_score,
          social_handles: entity.social_handles,
          aliases: entity.aliases,
          data_completeness: this.calculateCompleteness(entity.merged_metadata),
        }
      };
    });
  }
  
  /**
   * Merge descriptions from multiple items
   */
  private mergeDescriptions(items: ContentItem[]): string {
    // Use longest description, or combine if they're different
    const descriptions = items.map(i => i.description).filter(d => d?.length > 50);
    
    if (descriptions.length === 0) {return items[0].description;}
    
    // Sort by length and richness
    descriptions.sort((a, b) => b.length - a.length);
    
    return descriptions[0];
  }
  
  /**
   * Merge tags from multiple items
   */
  private mergeTags(items: ContentItem[]): string[] {
    const allTags = new Set<string>();
    
    for (const item of items) {
      if (item.tags) {
        for (const tag of item.tags) {
          allTags.add(tag.toLowerCase());
        }
      }
    }
    
    return Array.from(allTags);
  }
  
  /**
   * Calculate how complete the merged data is
   */
  private calculateCompleteness(metadata: Record<string, any>): number {
    const importantFields = [
      'launch_date', 'team_size', 'funding_raised', 'funding_stage',
      'github_url', 'twitter_url', 'website', 'location',
      'yc_batch', 'accelerate_score', 'ai_score'
    ];
    
    const present = importantFields.filter(field => 
      metadata[field] !== null && metadata[field] !== undefined
    ).length;
    
    return Math.round((present / importantFields.length) * 100);
  }
}