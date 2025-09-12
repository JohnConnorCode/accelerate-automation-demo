import OpenAI from 'openai';
import { z } from 'zod';

// Lazy initialization - create OpenAI client on first use
let openai: OpenAI | null | undefined = undefined;

// Initialize on first access
function getOpenAIClient(): OpenAI | null {
  if (openai === undefined) {
    if (process.env.OPENAI_API_KEY) {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      console.log('✅ OpenAI client initialized with API key');
    } else {
      openai = null;
      console.log('❌ No OpenAI API key found');
    }
  }
  return openai;
}

// AI Scoring Response Schema
const AIScoreSchema = z.object({
  relevance: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  urgency: z.number().min(0).max(1),
  authority: z.number().min(0).max(1),
  overall: z.number().min(0).max(1),
  reasoning: z.string(),
  categories: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  recommendation: z.enum(['approve', 'review', 'reject']),
});

export type AIScore = z.infer<typeof AIScoreSchema>;

// Scoring weights
const SCORING_WEIGHTS = {
  relevance: 0.4,
  quality: 0.3,
  urgency: 0.2,
  authority: 0.1,
};

export class AIScorer {
  private model: string;
  
  constructor(model = process.env.AI_MODEL || 'gpt-4-turbo-preview') {
    this.model = model;
  }

  async scoreContent(content: any): Promise<AIScore | null> {
    const client = getOpenAIClient();
    if (!client) {
      console.log('⚠️ WARNING: Using MOCK AI scoring - no OpenAI client!');
      return this.getMockScore(content);
    }

    try {
      const prompt = this.buildPrompt(content);
      console.log('🤖 Making REAL OpenAI API call...');
      
      const response = await client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert content curator for Web3 builders. 
            Score content based on relevance to builders, quality, urgency, and authority.
            Return scores as JSON matching the exact schema provided.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      });

      const rawScore = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and parse with Zod
      const score = AIScoreSchema.parse(rawScore);
      
      // Calculate weighted overall score
      score.overall = this.calculateOverallScore(score);
      
      return score;
    } catch (error) {

      return this.getMockScore(content);
    }
  }

  async scoreBatch(contents: any[]): Promise<Map<string, AIScore>> {
    const results = new Map<string, AIScore>();
    
    // Process in batches of 5 to avoid rate limits
    for (let i = 0; i < contents.length; i += 5) {
      const batch = contents.slice(i, i + 5);
      const scores = await Promise.all(
        batch.map(content => this.scoreContent(content))
      );
      
      batch.forEach((content, index) => {
        if (content.url && scores[index]) {
          results.set(content.url, scores[index]);
        }
      });
      
      // Rate limiting delay
      if (i + 5 < contents.length) {
        await this.delay(1000);
      }
    }
    
    return results;
  }

  /**
   * Score multiple ContentItems and return them with AI metadata
   * This is the method expected by AccelerateDBPipeline
   */
  async scoreItems(items: any[]): Promise<any[]> {
    const client = getOpenAIClient();
    
    if (!client) {
      console.log('⚠️ No OpenAI client - returning items without AI scoring');
      return items;
    }

    console.log(`🤖 Scoring ${items.length} items with AI...`);
    
    // Score items in batches
    const scoredItems = [];
    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);
      
      for (const item of batch) {
        try {
          const score = await this.scoreContent(item);
          
          if (score) {
            // Add AI metadata to the item
            scoredItems.push({
              ...item,
              metadata: {
                ...item.metadata,
                ai_score: Math.round(score.overall * 100),
                ai_analysis: score.reasoning,
                ai_needs: score.categories.filter(c => c.includes('need')).join(', '),
                ai_strengths: score.categories.filter(c => !c.includes('need')).join(', '),
                ai_recommendation: score.recommendation,
              }
            });
          } else {
            scoredItems.push(item);
          }
        } catch (error) {
          console.error(`Error scoring item: ${error}`);
          scoredItems.push(item);
        }
      }
      
      // Rate limiting
      if (i + 5 < items.length) {
        await this.delay(1000);
      }
    }
    
    return scoredItems;
  }

  private buildPrompt(content: any): string {
    return `
    Score this content for the ACCELERATE platform (helps Web3 builders find funding and resources):
    
    Title: ${content.title}
    Description: ${content.description}
    URL: ${content.url}
    Tags: ${content.tags?.join(', ') || 'none'}
    Type: ${content.content_type || 'unknown'}
    Source: ${content.source || 'unknown'}
    
    ACCELERATE CONTEXT:
    - We track PROJECTS (startups seeking funding/cofounders/developers)
    - We track FUNDING (accelerators, grants, VCs offering capital)
    - We track RESOURCES (tools, guides, services for builders)
    
    SCORING CRITERIA:
    - Is this a legitimate Web3/startup PROJECT seeking funding or team?
    - Is this a FUNDING opportunity (grant, accelerator, VC)?
    - Is this a valuable RESOURCE for builders?
    - Does it have clear value for the Accelerate community?
    
    Return a JSON object with these exact fields:
    {
      "relevance": 0-1 score for relevance to Accelerate users,
      "quality": 0-1 score for legitimacy and professionalism,
      "urgency": 0-1 score for time sensitivity (deadlines, etc),
      "authority": 0-1 score for source credibility,
      "overall": 0-1 weighted average (will be calculated),
      "reasoning": "Why this is/isn't valuable for Accelerate",
      "categories": ["project", "funding", "resource", "web3", etc],
      "sentiment": "positive" | "neutral" | "negative",
      "recommendation": "approve" | "review" | "reject"
    }
    
    Be STRICT: Only approve content that clearly fits Accelerate's mission.
    Reject: news articles, random crypto tokens, low-quality content.
    Approve: Real startups, legitimate funding opportunities, useful builder tools.
    `;
  }

  private calculateOverallScore(score: Omit<AIScore, 'overall'>): number {
    return (
      score.relevance * SCORING_WEIGHTS.relevance +
      score.quality * SCORING_WEIGHTS.quality +
      score.urgency * SCORING_WEIGHTS.urgency +
      score.authority * SCORING_WEIGHTS.authority
    );
  }

  private getMockScore(content: any): AIScore {
    // Deterministic heuristic scoring for when AI is not available
    const text = `${content.title} ${content.description}`.toLowerCase();
    
    // Count relevant keywords for scoring
    const web3Keywords = ['web3', 'blockchain', 'defi', 'nft', 'smart contract', 'dao', 'dapp'];
    const keywordCount = web3Keywords.filter(kw => text.includes(kw)).length;
    
    // Calculate scores based on content characteristics
    const relevanceScore = Math.min(0.4 + (keywordCount * 0.15), 1.0);
    const hasUrl = content.url && content.url.length > 0;
    const hasDescription = content.description && content.description.length > 50;
    const qualityScore = (hasUrl ? 0.4 : 0.2) + (hasDescription ? 0.4 : 0.2);
    
    const score = {
      relevance: relevanceScore,
      quality: qualityScore,
      urgency: content.content_type === 'funding' ? 0.8 : 0.3,
      authority: content.source === 'github' ? 0.7 : 0.5,
      overall: 0,
      reasoning: 'Heuristic scoring based on content analysis',
      categories: content.tags || ['web3'],
      sentiment: 'neutral' as const,
      recommendation: relevanceScore > 0.6 ? 'review' as const : 'reject' as const,
    };
    
    score.overall = this.calculateOverallScore(score);
    
    if (score.overall > 0.75) score.recommendation = 'review'; // Changed from 'approve' since that's not in the enum
    else if (score.overall < 0.35) score.recommendation = 'reject';
    
    return score;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if content should be auto-approved
  shouldAutoApprove(score: AIScore): boolean {
    const threshold = parseFloat(
      process.env.AI_SCORE_THRESHOLD_AUTO_APPROVE || '0.8'
    );
    return score.overall >= threshold && score.recommendation === 'approve';
  }

  // Check if content should be auto-rejected
  shouldAutoReject(score: AIScore): boolean {
    const threshold = parseFloat(
      process.env.AI_SCORE_THRESHOLD_AUTO_REJECT || '0.3'
    );
    return score.overall <= threshold || score.recommendation === 'reject';
  }
}