import type { Database } from '../types/supabase';
import OpenAI from 'openai';
import { ContentItem } from '../lib/base-fetcher';
import { supabase } from '../lib/supabase-client';

interface QualityAssessment {
  score: number;
  legitimacy: number;
  relevance: number;
  quality: number;
  redFlags: string[];
  greenFlags: string[];
  recommendation: 'approve' | 'reject' | 'review';
  reasoning: string;
  improvements: string[];
}

interface TrendAnalysis {
  emergingTrends: string[];
  decliningTrends: string[];
  hotTopics: string[];
  recommendations: string[];
}

export class AIQualityService {
  private openai: OpenAI;
  private cache: Map<string, QualityAssessment> = new Map();
  private apiKey: string | null = null;
  
  constructor() {
    // Initialize without key - will fetch from Supabase
    this.openai = new OpenAI({
      apiKey: 'placeholder' // Will be replaced after fetching from Supabase
    });
    this.initializeApiKey();
  }

  private async initializeApiKey() {
    try {
      // Fetch OpenAI API key from Supabase
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'openai_api_key')
        .single();

      if (data?.value) {
        this.apiKey = data.value;
        this.openai = new OpenAI({
          apiKey: data.value
        });

      } else {

        // Fallback to environment variable
        const envKey = process.env.OPENAI_API_KEY;
        if (envKey) {
          this.apiKey = envKey;
          this.openai = new OpenAI({
            apiKey: envKey
          });
        }
      }
    } catch (error) {

    }
  }

  /**
   * Assess quality of a single item using GPT-4
   */
  async assessQuality(item: ContentItem): Promise<QualityAssessment> {
    // Check cache first
    const cacheKey = `${item.type}-${item.url}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const prompt = `
        Analyze this Web3 startup/resource for the Accelerate platform:
        
        Type: ${item.type}
        Title: ${item.title}
        Description: ${item.description}
        URL: ${item.url}
        Tags: ${item.tags.join(', ')}
        Metadata: ${JSON.stringify(item.metadata || {}, null, 2)}
        
        Our criteria:
        - Projects: Must be launched 2024+, <$500k funding, 1-10 team, no corporate backing
        - Funding: Must show 2025 activity, clear process, actual funding (not just mentorship)
        - Resources: Updated <6 months, actionable, relevant to Web3 builders
        
        Provide assessment in JSON format:
        {
          "score": 0-100,
          "legitimacy": 0-100 (likelihood of being real vs scam),
          "relevance": 0-100 (fit for our criteria),
          "quality": 0-100 (overall quality of opportunity),
          "redFlags": ["list of concerning issues"],
          "greenFlags": ["list of positive indicators"],
          "recommendation": "approve/reject/review",
          "reasoning": "brief explanation",
          "improvements": ["suggestions for the team"]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',  // GPT-5 mini: 2.4x better accuracy than GPT-4o, cost-efficient
        messages: [
          {
            role: 'system',
            content: 'You are an expert Web3 startup analyst helping curate high-quality opportunities for early-stage builders. Use extended reasoning to provide thorough analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500
      });

      const assessment = JSON.parse(response.choices[0].message.content || '{}') as QualityAssessment;
      
      // Cache the result
      this.cache.set(cacheKey, assessment);
      
      // Store in database for future reference
      await this.storeAssessment(item, assessment);
      
      return assessment;
    } catch (error) {

      // Fallback to basic assessment
      return this.basicAssessment(item);
    }
  }

  /**
   * Batch assess multiple items efficiently
   */
  async batchAssess(items: ContentItem[]): Promise<Map<string, QualityAssessment>> {
    const assessments = new Map<string, QualityAssessment>();
    
    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const promises = batch.map(item => 
        this.assessQuality(item).then(assessment => {
          assessments.set(item.url, assessment);
        })
      );
      
      await Promise.all(promises);
      
      // Rate limit pause
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return assessments;
  }

  /**
   * Detect scams and low-quality projects
   */
  async detectScams(item: ContentItem): Promise<{
    isScam: boolean;
    confidence: number;
    indicators: string[];
  }> {
    const prompt = `
      Analyze this project for scam indicators:
      ${JSON.stringify(item, null, 2)}
      
      Look for:
      - Unrealistic promises (1000x returns, guaranteed profits)
      - Anonymous team with no verifiable history
      - Copied whitepapers or content
      - Fake partnerships or endorsements
      - Missing technical documentation
      - Ponzi/pyramid scheme characteristics
      - Pump and dump signals
      
      Return JSON: {
        "isScam": boolean,
        "confidence": 0-100,
        "indicators": ["list of scam indicators found"]
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Using latest efficient model for scam detection
        messages: [
          {
            role: 'system',
            content: 'You are a Web3 security expert specializing in scam detection.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {

      return {
        isScam: false,
        confidence: 0,
        indicators: []
      };
    }
  }

  /**
   * Analyze trends across all content
   */
  async analyzeTrends(items: ContentItem[]): Promise<TrendAnalysis> {
    const recentItems = items.slice(0, 100); // Analyze last 100 items
    
    const prompt = `
      Analyze these ${recentItems.length} Web3 projects/resources for trends:
      
      ${recentItems.map(item => `- ${item.title}: ${item.description.slice(0, 100)}`).join('\n')}
      
      Identify:
      1. Emerging trends (what's gaining traction)
      2. Declining trends (what's losing interest)
      3. Hot topics (most discussed themes)
      4. Recommendations for what to look for next
      
      Return JSON: {
        "emergingTrends": ["list of emerging trends"],
        "decliningTrends": ["list of declining trends"],
        "hotTopics": ["list of hot topics"],
        "recommendations": ["list of recommendations"]
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Using latest model for trend analysis
        messages: [
          {
            role: 'system',
            content: 'You are a Web3 market analyst identifying trends for investors and builders.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 600
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {

      return {
        emergingTrends: [],
        decliningTrends: [],
        hotTopics: [],
        recommendations: []
      };
    }
  }

  /**
   * Generate detailed report for CEO
   */
  async generateExecutiveReport(
    items: ContentItem[],
    period: string = 'week'
  ): Promise<string> {
    const approved = items.filter(i => i.metadata?.status === 'approved');
    const rejected = items.filter(i => i.metadata?.status === 'rejected');
    const pending = items.filter(i => !i.metadata?.status || i.metadata.status === 'pending');
    
    const prompt = `
      Generate an executive summary for the Accelerate content pipeline:
      
      Period: Last ${period}
      Total items: ${items.length}
      Approved: ${approved.length}
      Rejected: ${rejected.length}
      Pending: ${pending.length}
      
      Top approved projects: ${approved.slice(0, 5).map(i => i.title).join(', ')}
      
      Create a concise executive report including:
      1. Key metrics and performance
      2. Quality insights
      3. Notable discoveries
      4. Areas of concern
      5. Recommendations for improvement
      
      Format as a professional report with clear sections.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Using latest model for executive reports
        messages: [
          {
            role: 'system',
            content: 'You are writing an executive report for the CEO of a Web3 accelerator.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      return response.choices[0].message.content || 'Report generation failed';
    } catch (error) {

      return 'Unable to generate report at this time.';
    }
  }

  /**
   * Suggest improvements for content
   */
  async suggestImprovements(item: ContentItem): Promise<string[]> {
    const prompt = `
      This project/resource was submitted to our Web3 accelerator:
      ${JSON.stringify(item, null, 2)}
      
      Suggest 3-5 specific, actionable improvements they could make to:
      1. Increase their chances of approval
      2. Better serve the Web3 builder community
      3. Improve their credibility and traction
      
      Return as JSON array of strings.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Using latest model for suggestions
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      return JSON.parse(response.choices[0].message.content || '[]');
    } catch (error) {

      return [];
    }
  }

  /**
   * Compare similar projects
   */
  async compareProjects(
    project1: ContentItem,
    project2: ContentItem
  ): Promise<{
    similarity: number;
    betterChoice: string;
    reasoning: string;
    differences: string[];
  }> {
    const prompt = `
      Compare these two Web3 projects:
      
      Project 1: ${project1.title}
      ${JSON.stringify(project1, null, 2)}
      
      Project 2: ${project2.title}
      ${JSON.stringify(project2, null, 2)}
      
      Analyze:
      1. Similarity score (0-100)
      2. Which is the better opportunity and why
      3. Key differences
      
      Return JSON: {
        "similarity": 0-100,
        "betterChoice": "project1" or "project2",
        "reasoning": "explanation",
        "differences": ["list of key differences"]
      }
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',  // Using latest model for comparisons
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 400
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {

      return {
        similarity: 0,
        betterChoice: 'unknown',
        reasoning: 'Comparison failed',
        differences: []
      };
    }
  }

  /**
   * Fallback assessment when AI is unavailable
   */
  private basicAssessment(item: ContentItem): QualityAssessment {
    let score = 50;
    const redFlags: string[] = [];
    const greenFlags: string[] = [];
    
    // Check for red flags
    if (!item.url || !item.url.startsWith('https://')) {
      redFlags.push('No secure URL');
      score -= 10;
    }
    
    if (item.description.length < 50) {
      redFlags.push('Description too short');
      score -= 10;
    }
    
    if (item.title.match(/🚀{3,}|💰{3,}|GUARANTEED|1000X/i)) {
      redFlags.push('Hyperbolic language');
      score -= 20;
    }
    
    // Check for green flags
    if (item.metadata?.github_url) {
      greenFlags.push('Has GitHub repository');
      score += 10;
    }
    
    if (item.metadata?.team_size && item.metadata.team_size <= 10) {
      greenFlags.push('Small team size');
      score += 10;
    }
    
    if (item.metadata?.amount_funded && item.metadata.amount_funded < 500000) {
      greenFlags.push('Early-stage funding');
      score += 15;
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      legitimacy: score,
      relevance: score,
      quality: score,
      redFlags,
      greenFlags,
      recommendation: score >= 70 ? 'approve' : score >= 50 ? 'review' : 'reject',
      reasoning: 'Basic algorithmic assessment',
      improvements: []
    };
  }

  /**
   * Store assessment in database
   */
  private async storeAssessment(
    item: ContentItem,
    assessment: QualityAssessment
  ): Promise<void> {
    try {
      await supabase.from('ai_assessments').insert({
        item_url: item.url,
        item_type: item.type,
        assessment: assessment,
        created_at: new Date().toISOString()
      });
    } catch (error) {

    }
  }
}