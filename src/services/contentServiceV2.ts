import { supabase, TABLES } from '../lib/supabase'
import { OpenAI } from 'openai'

export type ContentCategory = 'projects' | 'funding' | 'resources'

export interface ContentItem {
  id: string
  title: string
  description: string
  source: string
  url?: string
  category: ContentCategory
  score: number
  status: 'pending' | 'approved' | 'rejected'
  enriched?: boolean
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface EnrichmentOptions {
  aiAnalysis?: boolean
  sentiment?: boolean
  keywords?: boolean
  category?: boolean
  summary?: boolean
  gptEnhancement?: boolean
}

export interface ContentValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

// Initialize OpenAI with error handling
const getOpenAIClient = () => {
  const apiKey = process.env.VITE_OPENAI_API_KEY || 
                process.env.OPENAI_API_KEY ||
                (typeof window !== 'undefined' && typeof localStorage !== 'undefined' 
                  ? localStorage.getItem('openai_api_key') 
                  : null)
  if (!apiKey) {
    console.warn('OpenAI API key not found. AI features will be limited.')
    return null
  }
  return new OpenAI({ 
    apiKey,
    dangerouslyAllowBrowser: true // For demo purposes only
  })
}

class ContentServiceV2 {
  private openai: OpenAI | null = null
  private retryConfig = {
    maxAttempts: 3,
    backoffMs: 1000,
    maxBackoffMs: 10000
  }

  constructor() {
    this.openai = getOpenAIClient()
  }

  // Validate content with comprehensive checks
  validateContent(item: Partial<ContentItem>): ContentValidation {
    const errors: string[] = []
    const warnings: string[] = []

    // Required fields
    if (!item.title || item.title.trim().length === 0) {
      errors.push('Title is required')
    } else if (item.title.length < 5) {
      errors.push('Title must be at least 5 characters')
    } else if (item.title.length > 200) {
      warnings.push('Title is very long (>200 characters)')
    }

    if (!item.description || item.description.trim().length === 0) {
      errors.push('Description is required')
    } else if (item.description.length < 50) {
      errors.push('Description must be at least 50 characters')
    } else if (item.description.length > 5000) {
      warnings.push('Description is very long (>5000 characters)')
    }

    if (!item.category || !['projects', 'funding', 'resources'].includes(item.category)) {
      errors.push('Valid category is required (projects, funding, or resources)')
    }

    // Optional but recommended fields
    if (!item.source) {
      warnings.push('Source is recommended for credibility')
    }

    if (item.url) {
      try {
        new URL(item.url)
      } catch {
        errors.push('Invalid URL format')
      }
    }

    // Sanitize content
    if (item.title) {
      item.title = this.sanitizeText(item.title)
    }
    if (item.description) {
      item.description = this.sanitizeText(item.description)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  // Sanitize text to prevent XSS and SQL injection
  private sanitizeText(text: string): string {
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim()
  }

  // Queue content with validation
  async queueContent(items: Partial<ContentItem>[]): Promise<{ success: boolean; queued: number; errors: any[] }> {
    const validItems: any[] = []
    const errors: any[] = []

    for (const item of items) {
      const validation = this.validateContent(item)
      
      if (validation.isValid) {
        // Calculate initial score
        const score = await this.calculateScore(item)
        
        validItems.push({
          ...item,
          score,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      } else {
        errors.push({
          item: item.title || 'Unknown',
          errors: validation.errors,
          warnings: validation.warnings
        })
      }
    }

    if (validItems.length === 0) {
      return { success: false, queued: 0, errors }
    }

    const { error } = await this.retryOperation(async () => 
      supabase.from(TABLES.CONTENT_QUEUE).insert(validItems)
    )

    if (error) {
      console.error('Failed to queue content:', error)
      return { success: false, queued: 0, errors: [...errors, { general: error.message }] }
    }

    return { success: true, queued: validItems.length, errors }
  }

  // Calculate content score using multiple factors
  private async calculateScore(item: Partial<ContentItem>): Promise<number> {
    let score = 50 // Base score

    // Length bonus
    if (item.description && item.description.length > 200) score += 10
    if (item.description && item.description.length > 500) score += 10

    // URL bonus
    if (item.url) score += 5

    // Source credibility (simplified)
    if (item.source) {
      const trustedSources = ['TechCrunch', 'VentureBeat', 'MIT', 'Stanford', 'Harvard']
      if (trustedSources.some(s => item.source!.toLowerCase().includes(s.toLowerCase()))) {
        score += 15
      }
    }

    // Keyword relevance
    const keywords = ['AI', 'blockchain', 'innovation', 'startup', 'funding', 'grant', 'technology']
    const text = `${item.title} ${item.description}`.toLowerCase()
    const matchedKeywords = keywords.filter(k => text.includes(k.toLowerCase()))
    score += matchedKeywords.length * 3

    // Cap at 100
    return Math.min(100, score)
  }

  // Approve content with automatic push to main app
  async approveContent(ids: string[]): Promise<{ success: boolean; approved: number; pushed: number }> {
    const { data: items, error: fetchError } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .select('*')
        .in('id', ids)
        .eq('status', 'pending')
    )

    if (fetchError || !items) {
      console.error('Failed to fetch items:', fetchError)
      return { success: false, approved: 0, pushed: 0 }
    }

    // Update status
    const { error: updateError } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .in('id', ids)
    )

    if (updateError) {
      console.error('Failed to update status:', updateError)
      return { success: false, approved: 0, pushed: 0 }
    }

    // Push to main app tables
    let pushed = 0
    for (const item of items) {
      try {
        await this.pushToMainApp(item)
        pushed++
      } catch (error) {
        console.error(`Failed to push item ${item.id}:`, error)
      }
    }

    return { success: true, approved: items.length, pushed }
  }

  // Push approved content to main app tables
  private async pushToMainApp(item: ContentItem): Promise<void> {
    const baseData = {
      title: item.title,
      description: item.description,
      source: item.source,
      url: item.url,
      created_at: new Date().toISOString(),
      metadata: item.metadata || {},
      automation_source: 'content_automation'
    }

    switch (item.category) {
      case 'projects':
        await supabase.from(TABLES.PROJECTS).insert({
          ...baseData,
          status: 'active',
          categories: item.metadata?.tags || [],
          technologies: item.metadata?.technologies || []
        })
        break

      case 'funding':
        await supabase.from(TABLES.FUNDING_OPPORTUNITIES).insert({
          ...baseData,
          amount: item.metadata?.amount,
          deadline: item.metadata?.deadline,
          requirements: item.metadata?.requirements || []
        })
        break

      case 'resources':
        await supabase.from(TABLES.RESOURCES).insert({
          ...baseData,
          type: item.metadata?.type || 'article',
          tags: item.metadata?.tags || []
        })
        break
    }
  }

  // Enrich content with AI (GPT-4/5)
  async enrichContent(id: string, options: EnrichmentOptions): Promise<{ success: boolean; enrichments: any }> {
    const { data: item, error: fetchError } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .select('*')
        .eq('id', id)
        .single()
    )

    if (fetchError || !item) {
      return { success: false, enrichments: null }
    }

    const enrichedData: any = { ...item.metadata }

    // GPT Enhancement
    if (options.gptEnhancement && this.openai) {
      try {
        const gptEnrichment = await this.enrichWithGPT(item)
        enrichedData.gptAnalysis = gptEnrichment
      } catch (error) {
        console.error('GPT enrichment failed:', error)
        enrichedData.gptAnalysis = { error: 'GPT enrichment failed' }
      }
    }

    // AI Analysis
    if (options.aiAnalysis) {
      enrichedData.aiAnalysis = {
        quality: await this.assessQuality(item),
        relevance: await this.assessRelevance(item),
        insights: await this.generateInsights(item)
      }
    }

    // Sentiment Analysis
    if (options.sentiment) {
      enrichedData.sentiment = await this.analyzeSentiment(item.description)
    }

    // Keyword Extraction
    if (options.keywords) {
      enrichedData.keywords = await this.extractKeywords(item)
    }

    // Category Suggestion
    if (options.category) {
      enrichedData.suggestedCategory = await this.suggestCategory(item)
    }

    // Summary Generation
    if (options.summary) {
      enrichedData.summary = await this.generateSummary(item)
    }

    // Update item with enriched data
    const { error: updateError } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .update({ 
          metadata: enrichedData, 
          enriched: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
    )

    if (updateError) {
      return { success: false, enrichments: enrichedData }
    }

    // Log enrichment
    await supabase.from(TABLES.ENRICHMENT_LOGS).insert({
      content_id: id,
      options: options,
      result: enrichedData,
      created_at: new Date().toISOString()
    })

    return { success: true, enrichments: enrichedData }
  }

  // GPT-4/5 Enhancement
  private async enrichWithGPT(item: ContentItem): Promise<any> {
    if (!this.openai) {
      return { error: 'OpenAI not configured' }
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content analyst for an innovation platform. Analyze content and provide structured insights.'
          },
          {
            role: 'user',
            content: `Analyze this content and provide insights:
              Title: ${item.title}
              Description: ${item.description}
              Category: ${item.category}
              
              Provide:
              1. Quality assessment (0-100)
              2. Key insights (3-5 points)
              3. Suggested improvements
              4. Relevant tags/keywords
              5. Target audience
              6. Potential impact score (0-100)
              
              Return as JSON.`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000
      })

      return JSON.parse(completion.choices[0].message.content || '{}')
    } catch (error) {
      console.error('GPT analysis failed:', error)
      throw error
    }
  }

  // Quality Assessment
  private async assessQuality(item: ContentItem): Promise<number> {
    let quality = 60

    // Check completeness
    if (item.description.length > 300) quality += 10
    if (item.url) quality += 5
    if (item.source) quality += 5
    if (item.metadata && Object.keys(item.metadata).length > 0) quality += 10

    // Check formatting
    const hasParagraphs = item.description.includes('\n\n')
    if (hasParagraphs) quality += 5

    // Check language quality (simplified)
    const hasProperCapitalization = /^[A-Z]/.test(item.title)
    if (hasProperCapitalization) quality += 5

    return Math.min(100, quality)
  }

  // Relevance Assessment
  private async assessRelevance(item: ContentItem): Promise<number> {
    const relevantKeywords = {
      projects: ['innovation', 'startup', 'technology', 'development', 'solution'],
      funding: ['grant', 'investment', 'funding', 'capital', 'accelerator'],
      resources: ['guide', 'tutorial', 'course', 'tool', 'framework']
    }

    const keywords = relevantKeywords[item.category] || []
    const text = `${item.title} ${item.description}`.toLowerCase()
    
    let matches = 0
    for (const keyword of keywords) {
      if (text.includes(keyword)) matches++
    }

    return Math.min(100, (matches / keywords.length) * 100)
  }

  // Generate Insights
  private async generateInsights(item: ContentItem): Promise<string[]> {
    const insights: string[] = []

    // Category-specific insights
    switch (item.category) {
      case 'projects':
        insights.push('Potential for innovation ecosystem impact')
        if (item.description.includes('AI') || item.description.includes('ML')) {
          insights.push('AI/ML technology component identified')
        }
        break
      case 'funding':
        insights.push('Funding opportunity for startups')
        if (item.metadata?.amount) {
          insights.push(`Funding amount: ${item.metadata.amount}`)
        }
        break
      case 'resources':
        insights.push('Educational resource for community')
        break
    }

    return insights
  }

  // Sentiment Analysis
  private async analyzeSentiment(text: string): Promise<string> {
    const positiveWords = ['great', 'excellent', 'amazing', 'innovative', 'breakthrough', 'success']
    const negativeWords = ['fail', 'problem', 'issue', 'challenge', 'difficult', 'risk']
    
    const lowerText = text.toLowerCase()
    let positiveCount = 0
    let negativeCount = 0

    for (const word of positiveWords) {
      if (lowerText.includes(word)) positiveCount++
    }

    for (const word of negativeWords) {
      if (lowerText.includes(word)) negativeCount++
    }

    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  // Extract Keywords
  private async extractKeywords(item: ContentItem): Promise<string[]> {
    const text = `${item.title} ${item.description}`.toLowerCase()
    const commonWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in', 'for', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once'])
    
    const words = text.split(/\W+/).filter(word => 
      word.length > 3 && !commonWords.has(word)
    )

    const wordFreq = new Map<string, number>()
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
    }

    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word)
  }

  // Suggest Category
  private async suggestCategory(item: ContentItem): Promise<ContentCategory> {
    const text = `${item.title} ${item.description}`.toLowerCase()
    
    const categoryKeywords = {
      projects: ['project', 'startup', 'company', 'platform', 'app', 'solution', 'product'],
      funding: ['fund', 'grant', 'investment', 'capital', 'money', 'finance', 'accelerator'],
      resources: ['guide', 'tutorial', 'learn', 'course', 'book', 'tool', 'resource']
    }

    const scores = {
      projects: 0,
      funding: 0,
      resources: 0
    }

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          scores[category as ContentCategory]++
        }
      }
    }

    // Return category with highest score, or original if tie
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore === 0) return item.category

    for (const [category, score] of Object.entries(scores)) {
      if (score === maxScore) return category as ContentCategory
    }

    return item.category
  }

  // Generate Summary
  private async generateSummary(item: ContentItem): Promise<string> {
    if (item.description.length <= 150) {
      return item.description
    }

    // Simple extractive summary (take first sentences)
    const sentences = item.description.split(/[.!?]+/)
    let summary = ''
    
    for (const sentence of sentences) {
      if (summary.length + sentence.length > 150) break
      summary += sentence.trim() + '. '
    }

    return summary.trim() || item.description.substring(0, 150) + '...'
  }

  // Retry operation with exponential backoff
  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      if (attempt >= this.retryConfig.maxAttempts) {
        throw error
      }

      const backoff = Math.min(
        this.retryConfig.backoffMs * Math.pow(2, attempt - 1),
        this.retryConfig.maxBackoffMs
      )

      console.log(`Retry attempt ${attempt} after ${backoff}ms`)
      await new Promise(resolve => setTimeout(resolve, backoff))

      return this.retryOperation(operation, attempt + 1)
    }
  }

  // Get content queue with filters
  async getQueue(filters?: { 
    status?: string; 
    category?: ContentCategory;
    enriched?: boolean;
    minScore?: number;
  }): Promise<ContentItem[]> {
    let query = supabase.from(TABLES.CONTENT_QUEUE).select('*')

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    if (filters?.enriched !== undefined) {
      query = query.eq('enriched', filters.enriched)
    }

    if (filters?.minScore) {
      query = query.gte('score', filters.minScore)
    }

    const { data, error } = await this.retryOperation(async () =>
      query.order('created_at', { ascending: false })
    )

    if (error) {
      console.error('Failed to fetch queue:', error)
      return []
    }

    return data || []
  }

  // Get comprehensive stats
  async getStats() {
    const { data, error } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .select('status, category, score, enriched')
    )

    if (error) {
      console.error('Failed to fetch stats:', error)
      return null
    }

    const stats = {
      total: data?.length || 0,
      pending: data?.filter(i => i.status === 'pending').length || 0,
      approved: data?.filter(i => i.status === 'approved').length || 0,
      rejected: data?.filter(i => i.status === 'rejected').length || 0,
      enriched: data?.filter(i => i.enriched).length || 0,
      avgScore: data?.reduce((acc, i) => acc + (i.score || 0), 0) / (data?.length || 1) || 0,
      byCategory: {
        projects: data?.filter(i => i.category === 'projects').length || 0,
        funding: data?.filter(i => i.category === 'funding').length || 0,
        resources: data?.filter(i => i.category === 'resources').length || 0
      },
      scoreDistribution: {
        high: data?.filter(i => i.score >= 80).length || 0,
        medium: data?.filter(i => i.score >= 50 && i.score < 80).length || 0,
        low: data?.filter(i => i.score < 50).length || 0
      }
    }

    return stats
  }

  // Auto-approve high-scoring content
  async autoApprove(minScore: number = 85): Promise<{ approved: number; pushed: number }> {
    const { data, error } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .select('id')
        .eq('status', 'pending')
        .gte('score', minScore)
    )

    if (error || !data || data.length === 0) {
      return { approved: 0, pushed: 0 }
    }

    const ids = data.map(item => item.id)
    const result = await this.approveContent(ids)
    
    return { approved: result.approved, pushed: result.pushed }
  }

  // Reject content
  async rejectContent(ids: string[], reason?: string): Promise<{ success: boolean; rejected: number }> {
    const { error } = await this.retryOperation(async () =>
      supabase
        .from(TABLES.CONTENT_QUEUE)
        .update({ 
          status: 'rejected', 
          updated_at: new Date().toISOString(),
          metadata: { 
            rejection_reason: reason || 'Manual rejection',
            rejected_at: new Date().toISOString()
          }
        })
        .in('id', ids)
    )

    if (error) {
      console.error('Failed to reject content:', error)
      return { success: false, rejected: 0 }
    }

    return { success: true, rejected: ids.length }
  }

  // Bulk operations
  async bulkEnrich(filters?: { category?: ContentCategory; minScore?: number }): Promise<{ enriched: number; failed: number }> {
    const items = await this.getQueue({ 
      status: 'pending', 
      enriched: false,
      ...filters 
    })

    let enriched = 0
    let failed = 0

    for (const item of items) {
      const result = await this.enrichContent(item.id, {
        aiAnalysis: true,
        keywords: true,
        sentiment: true,
        summary: true,
        gptEnhancement: !!this.openai
      })

      if (result.success) {
        enriched++
      } else {
        failed++
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return { enriched, failed }
  }

  // Settings management
  async updateSettings(key: string, value: any): Promise<boolean> {
    const { error } = await supabase
      .from(TABLES.AUTOMATION_SETTINGS)
      .upsert({ 
        key, 
        value, 
        updated_at: new Date().toISOString() 
      })

    return !error
  }

  async getSettings(key: string): Promise<any> {
    const { data, error } = await supabase
      .from(TABLES.AUTOMATION_SETTINGS)
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) return null
    return data.value
  }

  // Add content to queue
  async addToQueue(item: Partial<ContentItem>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // Validate content first
      const validation = this.validateContent(item)
      if (!validation.isValid) {
        return { 
          success: false, 
          error: `Validation failed: ${validation.errors.join(', ')}` 
        }
      }

      // Calculate score
      const score = await this.calculateScore(item as ContentItem)

      // Prepare data for insertion
      const queueItem = {
        title: this.sanitizeText(item.title || ''),
        description: this.sanitizeText(item.description || ''),
        category: item.category,
        source: item.source || 'Unknown',
        url: item.url || 'https://example.com',
        type: item.category || 'general',
        score,
        status: 'pending_review',
        metadata: item.metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Insert into queue
      const { data, error } = await supabase
        .from(TABLES.CONTENT_QUEUE)
        .insert(queueItem)
        .select()
        .single()

      if (error) {
        console.error('Failed to add to queue:', error)
        return { success: false, error: error.message }
      }

      return { success: true, id: data.id }
    } catch (error: any) {
      console.error('Error adding to queue:', error)
      return { success: false, error: error.message }
    }
  }

  // Process queue item (approve/reject)
  async processQueueItem(id: string, action: 'approve' | 'reject'): Promise<{ success: boolean; error?: string }> {
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      
      const { data, error } = await supabase
        .from(TABLES.CONTENT_QUEUE)
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error(`Failed to ${action} item:`, error)
        return { success: false, error: error.message }
      }

      // If approved, push to main app
      if (action === 'approve' && data) {
        try {
          await this.pushToMainApp(data)
        } catch (pushError: any) {
          console.error('Failed to push to main app:', pushError)
          // Don't fail the whole operation if push fails
        }
      }

      return { success: true }
    } catch (error: any) {
      console.error(`Error processing queue item:`, error)
      return { success: false, error: error.message }
    }
  }
}

export const contentServiceV2 = new ContentServiceV2()