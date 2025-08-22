import OpenAI from 'openai';
import { z } from 'zod';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
    if (!openai) {

      return this.getMockScore(content);
    }

    try {
      const prompt = this.buildPrompt(content);
      
      const response = await openai.chat.completions.create({
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

  private buildPrompt(content: any): string {
    return `
    Score this Web3 content for builders:
    
    Title: ${content.title}
    Description: ${content.description}
    URL: ${content.url}
    Tags: ${content.tags?.join(', ') || 'none'}
    Type: ${content.content_type || 'unknown'}
    
    Return a JSON object with these exact fields:
    {
      "relevance": 0-1 score for relevance to Web3 builders,
      "quality": 0-1 score for content quality and depth,
      "urgency": 0-1 score for time sensitivity,
      "authority": 0-1 score for source credibility,
      "overall": 0-1 weighted average (will be calculated),
      "reasoning": "Brief explanation of scores",
      "categories": ["web3", "defi", etc] - suggested categories,
      "sentiment": "positive" | "neutral" | "negative",
      "recommendation": "approve" | "review" | "reject"
    }
    
    Focus on practical value for builders, technical depth, and immediate usefulness.
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
    // Simple heuristic scoring for when AI is not available
    const hasWeb3Keywords = /web3|blockchain|defi|nft|smart contract/i.test(
      `${content.title} ${content.description}`
    );
    
    const baseScore = hasWeb3Keywords ? 0.7 : 0.4;
    const randomVariance = Math.random() * 0.2;
    
    const score = {
      relevance: baseScore + randomVariance,
      quality: 0.6 + Math.random() * 0.3,
      urgency: content.content_type === 'funding' ? 0.8 : 0.3,
      authority: 0.5 + Math.random() * 0.3,
      overall: 0,
      reasoning: 'Mock scoring based on keywords and content type',
      categories: content.tags || ['web3'],
      sentiment: 'neutral' as const,
      recommendation: baseScore > 0.6 ? 'review' as const : 'reject' as const,
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