import { supabase, TABLES } from '../lib/supabase'

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
}

class ContentService {
  // Queue content for review
  async queueContent(items: Partial<ContentItem>[]): Promise<void> {
    const validItems = items.filter(item => 
      item.title && 
      item.description && 
      item.description.length >= 50 &&
      item.category
    )

    if (validItems.length === 0) return

    const { error } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .insert(validItems.map(item => ({
        ...item,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))

    if (error) throw error
  }

  // Approve content and push to main app
  async approveContent(ids: string[]): Promise<void> {
    // Update status to approved
    const { data: items, error: fetchError } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .select('*')
      .in('id', ids)
      .eq('status', 'pending')

    if (fetchError) throw fetchError
    if (!items || items.length === 0) return

    // Update status
    const { error: updateError } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .in('id', ids)

    if (updateError) throw updateError

    // Push to appropriate tables in main app
    for (const item of items) {
      await this.pushToMainApp(item)
    }
  }

  // Push approved content to main app tables
  private async pushToMainApp(item: ContentItem): Promise<void> {
    const baseData = {
      title: item.title,
      description: item.description,
      source: item.source,
      url: item.url,
      created_at: new Date().toISOString(),
      metadata: item.metadata || {}
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

  // Reject content
  async rejectContent(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .in('id', ids)

    if (error) throw error
  }

  // Enrich content with AI
  async enrichContent(id: string, options: EnrichmentOptions): Promise<void> {
    const { data: item, error: fetchError } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError
    if (!item) return

    const enrichedData: any = { ...item.metadata }

    // Simulate enrichment (in production, call AI services)
    if (options.aiAnalysis) {
      enrichedData.aiAnalysis = {
        quality: Math.random() * 100,
        relevance: Math.random() * 100,
        insights: 'AI-generated insights would go here'
      }
    }

    if (options.sentiment) {
      enrichedData.sentiment = ['positive', 'neutral', 'negative'][Math.floor(Math.random() * 3)]
    }

    if (options.keywords) {
      enrichedData.keywords = ['innovation', 'technology', 'funding', 'startup']
    }

    if (options.category) {
      enrichedData.suggestedCategory = item.category // Keep original for now
    }

    if (options.summary) {
      enrichedData.summary = item.description.substring(0, 150) + '...'
    }

    // Update item with enriched data
    const { error: updateError } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .update({ 
        metadata: enrichedData, 
        enriched: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    // Log enrichment
    await supabase.from(TABLES.ENRICHMENT_LOGS).insert({
      content_id: id,
      options: options,
      created_at: new Date().toISOString()
    })
  }

  // Get content queue
  async getQueue(filters?: { status?: string; category?: ContentCategory }): Promise<ContentItem[]> {
    let query = supabase.from(TABLES.CONTENT_QUEUE).select('*')

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.category) {
      query = query.eq('category', filters.category)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Get stats
  async getStats() {
    const { data, error } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .select('status, category, score')

    if (error) throw error

    const stats = {
      total: data?.length || 0,
      pending: data?.filter(i => i.status === 'pending').length || 0,
      approved: data?.filter(i => i.status === 'approved').length || 0,
      rejected: data?.filter(i => i.status === 'rejected').length || 0,
      avgScore: data?.reduce((acc, i) => acc + (i.score || 0), 0) / (data?.length || 1) || 0,
      byCategory: {
        projects: data?.filter(i => i.category === 'projects').length || 0,
        funding: data?.filter(i => i.category === 'funding').length || 0,
        resources: data?.filter(i => i.category === 'resources').length || 0
      }
    }

    return stats
  }

  // Auto-approve high-scoring content
  async autoApprove(minScore: number = 85): Promise<number> {
    const { data, error } = await supabase
      .from(TABLES.CONTENT_QUEUE)
      .select('id')
      .eq('status', 'pending')
      .gte('score', minScore)

    if (error) throw error
    if (!data || data.length === 0) return 0

    const ids = data.map(item => item.id)
    await this.approveContent(ids)
    
    return ids.length
  }
}

export const contentService = new ContentService()