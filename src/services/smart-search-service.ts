import type { Database } from '../types/supabase';
import { supabase } from '../lib/supabase-client';
import { intelligentCache } from './intelligent-cache-service';

/**
 * Smart Search Service with Autocomplete and Advanced Filtering
 * Provides Google-like instant search experience
 */

interface SearchOptions {
  query: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'date' | 'score' | 'popularity';
  includeRelated?: boolean;
}

interface SearchFilters {
  type?: ('project' | 'funding' | 'resource')[];
  dateRange?: { from: Date; to: Date };
  scoreRange?: { min: number; max: number };
  status?: ('pending' | 'approved' | 'rejected')[];
  tags?: string[];
  source?: string[];
  teamSize?: { min: number; max: number };
  fundingAmount?: { min: number; max: number };
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
  score: number;
  highlights: {
    title?: string;
    description?: string;
  };
  metadata: any;
  relevance: number;
}

interface SearchSuggestion {
  text: string;
  type: 'query' | 'filter' | 'tag' | 'recent';
  count?: number;
  icon?: string;
}

interface SearchAnalytics {
  query: string;
  resultsCount: number;
  responseTime: number;
  clickedResults: string[];
  refinements: string[];
}

export class SmartSearchService {
  private searchHistory: Map<string, SearchAnalytics> = new Map();
  private popularSearches: string[] = [];
  private searchIndex: Map<string, Set<string>> = new Map(); // Inverted index
  
  // Common search shortcuts
  private shortcuts = {
    'new': { filter: { dateRange: { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), to: new Date() } } },
    'hot': { sortBy: 'popularity' as const },
    'funded': { filter: { type: ['funding'] } },
    'tools': { filter: { type: ['resource'] } },
    'ai': { filter: { tags: ['ai', 'machine-learning', 'ml'] } },
    'web3': { filter: { tags: ['web3', 'blockchain', 'crypto'] } },
    'high-score': { filter: { scoreRange: { min: 80, max: 100 } } }
  };
  
  constructor() {
    this.buildSearchIndex();
    this.loadPopularSearches();
  }
  
  /**
   * Perform smart search with relevance ranking
   */
  async search(options: SearchOptions): Promise<{
    results: SearchResult[];
    totalCount: number;
    suggestions: SearchSuggestion[];
    responseTime: number;
  }> {
    const startTime = Date.now();
    
    // Check for shortcuts in query
    const { query, filters } = this.parseSearchQuery(options.query, options.filters);
    
    // Try cache first
    const cacheKey = `search:${JSON.stringify({ query, filters, limit: options.limit })}`;
    
    const cachedResults = await intelligentCache.get<SearchResult[]>(
      cacheKey,
      async () => {
        return await this.performSearch(query, filters, options);
      },
      {
        ttl: 300000, // 5 minutes
        tags: ['search'],
        priority: 'high'
      }
    );
    
    const results = cachedResults || [];
    
    // Get suggestions based on current search
    const suggestions = await this.generateSuggestions(query, results);
    
    // Track search analytics
    this.trackSearch(query, results.length, Date.now() - startTime);
    
    return {
      results: results.slice(0, options.limit || 20),
      totalCount: results.length,
      suggestions,
      responseTime: Date.now() - startTime
    };
  }
  
  /**
   * Get autocomplete suggestions
   */
  async autocomplete(partial: string, limit: number = 10): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // Get from cache first
    const cached = await intelligentCache.get<SearchSuggestion[]>(
      `autocomplete:${partial}`,
      async () => {
        const allSuggestions: SearchSuggestion[] = [];
        
        // 1. Recent searches
        const recentSearches = Array.from(this.searchHistory.keys())
          .filter(q => q.toLowerCase().includes(partial.toLowerCase()))
          .slice(0, 3)
          .map(q => ({
            text: q,
            type: 'recent' as const,
            icon: '🕐'
          }));
        allSuggestions.push(...recentSearches);
        
        // 2. Popular searches
        const popularMatches = this.popularSearches
          .filter(q => q.toLowerCase().includes(partial.toLowerCase()))
          .slice(0, 3)
          .map(q => ({
            text: q,
            type: 'query' as const,
            icon: '🔥',
            count: 75 // Default popularity count
          }));
        allSuggestions.push(...popularMatches);
        
        // 3. Search index matches
        const indexMatches = await this.searchIndexLookup(partial);
        allSuggestions.push(...indexMatches.slice(0, 5));
        
        // 4. Smart filter suggestions
        if (partial.includes(':')) {
          const filterSuggestions = this.generateFilterSuggestions(partial);
          allSuggestions.push(...filterSuggestions);
        }
        
        // 5. Tag suggestions
        const tagSuggestions = await this.getTagSuggestions(partial);
        allSuggestions.push(...tagSuggestions.slice(0, 3));
        
        return allSuggestions;
      },
      {
        ttl: 60000, // 1 minute
        tags: ['autocomplete'],
        priority: 'medium'
      }
    );
    
    return (cached || []).slice(0, limit);
  }
  
  /**
   * Perform the actual search
   */
  private async performSearch(
    query: string,
    filters?: SearchFilters,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const searchTerms = this.tokenizeQuery(query);
    const results: SearchResult[] = [];
    
    // Build the database query
    let dbQuery = supabase.from('approved_content').select('*');
    
    // Apply filters
    if (filters?.type && filters.type.length > 0) {
      dbQuery = dbQuery.in('type', filters.type);
    }
    
    if (filters?.status && filters.status.length > 0) {
      dbQuery = dbQuery.in('status', filters.status);
    }
    
    if (filters?.dateRange) {
      dbQuery = dbQuery
        .gte('created_at', filters.dateRange.from.toISOString())
        .lte('created_at', filters.dateRange.to.toISOString());
    }
    
    if (filters?.scoreRange) {
      dbQuery = dbQuery
        .gte('score', filters.scoreRange.min)
        .lte('score', filters.scoreRange.max);
    }
    
    // Execute query
    const { data, error } = await dbQuery;
    
    if (error) {

      return [];
    }
    
    if (!data) {return [];}
    
    // Type assertion for approved_content table data
    const typedData = data as Array<{
      id: string;
      title?: string;
      name?: string;
      description?: string;
      content?: string;
      type: string;
      score?: number;
      [key: string]: any;
    }>;
    
    // Score and rank results
    for (const item of typedData) {
      const relevance = this.calculateRelevance(item, searchTerms, filters);
      
      if (relevance > 0) {
        results.push({
          id: item.id,
          title: item.title || item.name,
          description: item.description || item.content || '',
          type: item.type,
          score: item.score || 0,
          highlights: this.generateHighlights(item, searchTerms),
          metadata: item,
          relevance
        });
      }
    }
    
    // Sort by relevance or specified sort
    results.sort((a, b) => {
      switch (options?.sortBy) {
        case 'date':
          return new Date(b.metadata.created_at).getTime() - new Date(a.metadata.created_at).getTime();
        case 'score':
          return b.score - a.score;
        case 'popularity':
          return (b.metadata.views || 0) - (a.metadata.views || 0);
        default: // relevance
          return b.relevance - a.relevance;
      }
    });
    
    // Include related items if requested
    if (options?.includeRelated && results.length > 0) {
      const related = await this.findRelatedItems(results.slice(0, 5));
      results.push(...related);
    }
    
    return results;
  }
  
  /**
   * Calculate relevance score
   */
  private calculateRelevance(
    item: any,
    searchTerms: string[],
    filters?: SearchFilters
  ): number {
    let relevance = 0;
    
    const title = (item.title || item.name || '').toLowerCase();
    const description = (item.description || item.content || '').toLowerCase();
    const tags = (item.tags || []).join(' ').toLowerCase();
    
    for (const term of searchTerms) {
      const termLower = term.toLowerCase();
      
      // Title matches (highest weight)
      if (title.includes(termLower)) {
        relevance += title.startsWith(termLower) ? 10 : 7;
      }
      
      // Description matches (medium weight)
      if (description.includes(termLower)) {
        relevance += 4;
      }
      
      // Tag matches (medium weight)
      if (tags.includes(termLower)) {
        relevance += 5;
      }
      
      // Fuzzy matching for typos
      if (this.fuzzyMatch(termLower, title)) {
        relevance += 3;
      }
    }
    
    // Boost for filter matches
    if (filters?.tags) {
      const itemTags = item.tags || [];
      const matchingTags = filters.tags.filter(tag => itemTags.includes(tag));
      relevance += matchingTags.length * 3;
    }
    
    // Boost for recency
    const age = Date.now() - new Date(item.created_at).getTime();
    const daysSinceCreation = age / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {relevance += 2;}
    if (daysSinceCreation < 1) {relevance += 3;}
    
    // Boost for high quality score
    if (item.score > 80) {relevance += 2;}
    if (item.score > 90) {relevance += 3;}
    
    return relevance;
  }
  
  /**
   * Generate search result highlights
   */
  private generateHighlights(item: any, searchTerms: string[]): any {
    const highlights: any = {};
    
    const title = item.title || item.name || '';
    const description = item.description || item.content || '';
    
    // Highlight matching terms in title
    let highlightedTitle = title;
    for (const term of searchTerms) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedTitle = highlightedTitle.replace(regex, '<mark>$1</mark>');
    }
    if (highlightedTitle !== title) {
      highlights.title = highlightedTitle;
    }
    
    // Highlight matching terms in description (with context)
    for (const term of searchTerms) {
      const regex = new RegExp(`(.{0,50})(${term})(.{0,50})`, 'gi');
      const match = description.match(regex);
      if (match) {
        highlights.description = '...' + match[0].replace(
          new RegExp(`(${term})`, 'gi'),
          '<mark>$1</mark>'
        ) + '...';
        break;
      }
    }
    
    return highlights;
  }
  
  /**
   * Parse search query for shortcuts and filters
   */
  private parseSearchQuery(
    query: string,
    existingFilters?: SearchFilters
  ): { query: string; filters?: SearchFilters } {
    let processedQuery = query;
    let filters = { ...existingFilters };
    
    // Check for shortcuts
    for (const [shortcut, config] of Object.entries(this.shortcuts)) {
      if (query.includes(shortcut)) {
        processedQuery = query.replace(shortcut, '').trim();
        if ('filter' in config && config.filter) {
          filters = { ...filters, ...config.filter } as any;
        }
      }
    }
    
    // Parse inline filters (e.g., "type:project score:>80")
    const filterPattern = /(\w+):([<>]?)(\S+)/g;
    let match;
    
    while ((match = filterPattern.exec(query)) !== null) {
      const [fullMatch, field, operator, value] = match;
      processedQuery = processedQuery.replace(fullMatch, '').trim();
      
      switch (field) {
        case 'type':
          filters.type = filters.type || [];
          filters.type.push(value as any);
          break;
        case 'score':
          const scoreValue = parseInt(value);
          if (operator === '>') {
            filters.scoreRange = { min: scoreValue, max: 100 };
          } else if (operator === '<') {
            filters.scoreRange = { min: 0, max: scoreValue };
          }
          break;
        case 'tag':
          filters.tags = filters.tags || [];
          filters.tags.push(value);
          break;
        case 'source':
          filters.source = filters.source || [];
          filters.source.push(value);
          break;
      }
    }
    
    return { query: processedQuery, filters };
  }
  
  /**
   * Tokenize search query
   */
  private tokenizeQuery(query: string): string[] {
    // Remove special characters and split
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 1);
  }
  
  /**
   * Fuzzy string matching for typos
   */
  private fuzzyMatch(term: string, text: string): boolean {
    // Simple Levenshtein distance check
    const maxDistance = Math.floor(term.length / 3);
    
    for (let i = 0; i <= text.length - term.length; i++) {
      const substring = text.substr(i, term.length);
      if (this.levenshteinDistance(term, substring) <= maxDistance) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
    
    return matrix[b.length][a.length];
  }
  
  /**
   * Find related items
   */
  private async findRelatedItems(items: SearchResult[]): Promise<SearchResult[]> {
    const related: SearchResult[] = [];
    const tags = new Set<string>();
    
    // Collect tags from top results
    items.forEach(item => {
      (item.metadata.tags || []).forEach((tag: string) => tags.add(tag));
    });
    
    if (tags.size === 0) {return [];}
    
    // Find items with similar tags
    const { data } = await supabase
      .from('approved_content')
      .select('*')
      .contains('tags', Array.from(tags))
      .limit(10);
    
    if (data) {
      const typedData = data as Array<{
        id: string;
        title?: string;
        name?: string;
        description?: string;
        type: string;
        score?: number;
        [key: string]: any;
      }>;
      
      for (const item of typedData) {
        // Skip if already in results
        if (items.find(r => r.id === item.id)) {continue;}
        
        related.push({
          id: item.id,
          title: item.title || item.name,
          description: item.description || '',
          type: item.type,
          score: item.score || 0,
          highlights: {},
          metadata: item,
          relevance: 50 // Lower relevance for related items
        });
      }
    }
    
    return related;
  }
  
  /**
   * Generate search suggestions
   */
  private async generateSuggestions(
    query: string,
    results: SearchResult[]
  ): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    
    // Suggest filters based on results
    if (results.length > 0) {
      const types = new Set(results.map(r => r.type));
      if (types.size > 1) {
        types.forEach(type => {
          suggestions.push({
            text: `Filter by ${type}`,
            type: 'filter',
            count: results.filter(r => r.type === type).length
          });
        });
      }
      
      // Suggest date filters
      suggestions.push({
        text: 'Last 7 days',
        type: 'filter',
        icon: '📅'
      });
      
      // Suggest score filters
      if (results.some(r => r.score > 80)) {
        suggestions.push({
          text: 'High score only (80+)',
          type: 'filter',
          icon: '⭐'
        });
      }
    }
    
    // Suggest related searches
    if (query.length > 3) {
      const relatedSearches = await this.getRelatedSearches(query);
      suggestions.push(...relatedSearches);
    }
    
    return suggestions;
  }
  
  /**
   * Generate filter suggestions
   */
  private generateFilterSuggestions(partial: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];
    
    if (partial.startsWith('type:')) {
      ['project', 'funding', 'resource'].forEach(type => {
        suggestions.push({
          text: `type:${type}`,
          type: 'filter',
          icon: '🔍'
        });
      });
    }
    
    if (partial.startsWith('score:')) {
      ['score:>80', 'score:>90', 'score:<50'].forEach(filter => {
        suggestions.push({
          text: filter,
          type: 'filter',
          icon: '📊'
        });
      });
    }
    
    return suggestions;
  }
  
  /**
   * Get tag suggestions
   */
  private async getTagSuggestions(partial: string): Promise<SearchSuggestion[]> {
    const { data } = await supabase
      .from('tags')
      .select('name, count')
      .ilike('name', `${partial}%`)
      .order('count', { ascending: false })
      .limit(5);
    
    if (!data) {return [];}
    
    return data.map(tag => ({
      text: `#${tag.name}`,
      type: 'tag' as const,
      count: tag.count,
      icon: '🏷️'
    }));
  }
  
  /**
   * Build search index
   */
  private async buildSearchIndex(): Promise<void> {

    const { data } = await supabase
      .from('approved_content')
      .select('id, title, description, tags, type');
    
    if (!data) {return;}
    
    const typedData = data as Array<{
      id: string;
      title?: string;
      description?: string;
      tags?: string[];
      type: string;
      [key: string]: any;
    }>;
    
    for (const item of typedData) {
      const terms = new Set<string>();
      
      // Index title terms
      if (item.title) {
        this.tokenizeQuery(item.title).forEach(term => terms.add(term));
      }
      
      // Index description terms
      if (item.description) {
        this.tokenizeQuery(item.description).forEach(term => terms.add(term));
      }
      
      // Index tags
      (item.tags || []).forEach((tag: string) => terms.add(tag.toLowerCase()));
      
      // Store in inverted index
      terms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term)!.add(item.id);
      });
    }

  }
  
  /**
   * Search index lookup
   */
  private async searchIndexLookup(partial: string): Promise<SearchSuggestion[]> {
    const suggestions: SearchSuggestion[] = [];
    const partialLower = partial.toLowerCase();
    
    for (const [term, ids] of this.searchIndex.entries()) {
      if (term.startsWith(partialLower)) {
        suggestions.push({
          text: term,
          type: 'query',
          count: ids.size
        });
      }
    }
    
    return suggestions.sort((a, b) => (b.count || 0) - (a.count || 0));
  }
  
  /**
   * Load popular searches
   */
  private async loadPopularSearches(): Promise<void> {
    // In production, this would load from database
    this.popularSearches = [
      'ai tools',
      'blockchain projects',
      'funding opportunities',
      'open source',
      'web3 development',
      'machine learning',
      'startup resources',
      'developer tools',
      'grants 2024',
      'early stage'
    ];
  }
  
  /**
   * Get related searches
   */
  private async getRelatedSearches(query: string): Promise<SearchSuggestion[]> {
    // Simple related search suggestions
    const related: SearchSuggestion[] = [];
    
    if (query.includes('ai')) {
      related.push({ text: 'machine learning', type: 'query', icon: '🤖' });
      related.push({ text: 'neural networks', type: 'query', icon: '🧠' });
    }
    
    if (query.includes('web3')) {
      related.push({ text: 'blockchain', type: 'query', icon: '⛓️' });
      related.push({ text: 'defi', type: 'query', icon: '💰' });
    }
    
    if (query.includes('fund')) {
      related.push({ text: 'grants', type: 'query', icon: '💵' });
      related.push({ text: 'accelerator', type: 'query', icon: '🚀' });
    }
    
    return related;
  }
  
  /**
   * Track search for analytics
   */
  private trackSearch(query: string, resultsCount: number, responseTime: number): void {
    const analytics: SearchAnalytics = {
      query,
      resultsCount,
      responseTime,
      clickedResults: [],
      refinements: []
    };
    
    this.searchHistory.set(query, analytics);
    
    // Keep only last 100 searches
    if (this.searchHistory.size > 100) {
      const firstKey = this.searchHistory.keys().next().value;
      if (firstKey) {
        this.searchHistory.delete(firstKey);
      }
    }
    
    // Store in database for long-term analytics
    supabase.from('search_analytics').insert({
      query,
      results_count: resultsCount,
      response_time: responseTime,
      timestamp: new Date().toISOString()
    }).then(() => {}).then(undefined, console.error);
  }
  
  /**
   * Track clicked result
   */
  trackClick(query: string, resultId: string): void {
    const analytics = this.searchHistory.get(query);
    if (analytics) {
      analytics.clickedResults.push(resultId);
    }
  }
  
  /**
   * Export search functionality for API
   */
  getSearchStats(): {
    totalSearches: number;
    averageResponseTime: number;
    popularQueries: string[];
    indexSize: number;
  } {
    const searches = Array.from(this.searchHistory.values());
    
    return {
      totalSearches: searches.length,
      averageResponseTime: searches.reduce((sum, s) => sum + s.responseTime, 0) / searches.length || 0,
      popularQueries: this.popularSearches.slice(0, 10),
      indexSize: this.searchIndex.size
    };
  }
}

// Export singleton instance
export const smartSearch = new SmartSearchService();