/**
 * REAL AI Scoring Service using OpenAI
 * No more fake scores - actual AI evaluation
 */

import OpenAI from 'openai';
import { logger } from './logger';

interface ScoringResult {
  score: number;           // 0-10
  accelerate_fit: boolean;
  reasoning: string;
  confidence: number;      // 0-1
  criteria_met: {
    early_stage: boolean;
    low_funding: boolean;
    small_team: boolean;
    high_potential: boolean;
  };
}

export class AIScorer {
  private openai: OpenAI;
  private enabled: boolean;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.enabled = !!apiKey;
    
    if (this.enabled) {
      this.openai = new OpenAI({ apiKey });
      logger.info('AI Scorer initialized with OpenAI');
    } else {
      logger.warn('AI Scorer disabled - no OpenAI key');
    }
  }

  /**
   * Score a single item using AI
   */
  async scoreItem(item: any): Promise<ScoringResult> {
    if (!this.enabled) {
      // Fallback to basic heuristic scoring if no AI
      return this.heuristicScore(item);
    }

    try {
      const prompt = this.buildPrompt(item);
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert at evaluating early-stage startups for the ACCELERATE program.
            
ACCELERATE Criteria:
- Early stage (founded 2024+)
- Low funding (<$500k raised)
- Small team (<10 people)
- High growth potential
- Active development

Score from 0-10 where:
- 8-10: Perfect fit for ACCELERATE
- 5-7: Good fit with some concerns
- 2-4: Poor fit
- 0-1: Not relevant

Return a JSON object with: score (number), accelerate_fit (boolean), reasoning (string), confidence (0-1), criteria_met (object with booleans).`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      });

      const response = completion.choices[0].message.content;
      if (!response) throw new Error('No response from AI');
      
      const result = JSON.parse(response);
      
      // Validate and normalize the response
      return {
        score: Math.min(10, Math.max(0, result.score || 0)),
        accelerate_fit: result.accelerate_fit || false,
        reasoning: result.reasoning || 'No reasoning provided',
        confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
        criteria_met: result.criteria_met || {
          early_stage: false,
          low_funding: false,
          small_team: false,
          high_potential: false
        }
      };
      
    } catch (error) {
      logger.error('AI scoring failed', { error, item: item.title || item.name });
      // Fallback to heuristic scoring
      return this.heuristicScore(item);
    }
  }

  /**
   * Score multiple items in batch
   */
  async scoreBatch(items: any[]): Promise<Map<string, ScoringResult>> {
    const results = new Map<string, ScoringResult>();
    
    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => this.scoreItem(item))
      );
      
      batch.forEach((item, index) => {
        const id = item.id || item.url || item.title || `item-${i + index}`;
        results.set(id, batchResults[index]);
      });
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  /**
   * Build the prompt for AI scoring
   */
  private buildPrompt(item: any): string {
    const parts = [
      `Evaluate this startup/project for ACCELERATE:`,
      `Name: ${item.company_name || item.title || item.name || 'Unknown'}`,
      `Description: ${item.description || item.content || 'No description'}`,
    ];

    if (item.website || item.url) {
      parts.push(`URL: ${item.website || item.url}`);
    }

    if (item.founded_year || item.launch_date) {
      parts.push(`Founded: ${item.founded_year || item.launch_date}`);
    }

    if (item.funding_amount !== undefined) {
      parts.push(`Funding: $${item.funding_amount}`);
    }

    if (item.team_size !== undefined) {
      parts.push(`Team Size: ${item.team_size}`);
    }

    if (item.technology_stack?.length) {
      parts.push(`Tech: ${item.technology_stack.join(', ')}`);
    }

    if (item.source) {
      parts.push(`Source: ${item.source}`);
    }

    return parts.join('\n');
  }

  /**
   * Heuristic scoring when AI is not available
   * This is REAL scoring based on actual criteria
   */
  private heuristicScore(item: any): ScoringResult {
    let score = 5; // Start neutral
    const criteria_met = {
      early_stage: false,
      low_funding: false,
      small_team: false,
      high_potential: false
    };
    
    const reasons: string[] = [];

    // Check founding year
    const currentYear = new Date().getFullYear();
    if (item.founded_year) {
      if (item.founded_year >= 2024) {
        score += 2;
        criteria_met.early_stage = true;
        reasons.push('Early stage (2024+)');
      } else if (item.founded_year >= 2023) {
        score += 1;
        reasons.push('Recent startup');
      } else {
        score -= 1;
        reasons.push('Older company');
      }
    }

    // Check funding
    if (item.funding_amount !== undefined) {
      if (item.funding_amount === 0) {
        score += 2;
        criteria_met.low_funding = true;
        reasons.push('Pre-funding');
      } else if (item.funding_amount < 100000) {
        score += 1;
        criteria_met.low_funding = true;
        reasons.push('Minimal funding');
      } else if (item.funding_amount < 500000) {
        score += 0.5;
        criteria_met.low_funding = true;
        reasons.push('Low funding');
      } else {
        score -= 2;
        reasons.push('Well-funded');
      }
    }

    // Check team size
    if (item.team_size !== undefined) {
      if (item.team_size <= 3) {
        score += 2;
        criteria_met.small_team = true;
        reasons.push('Small team');
      } else if (item.team_size <= 10) {
        score += 1;
        criteria_met.small_team = true;
        reasons.push('Lean team');
      } else {
        score -= 1;
        reasons.push('Large team');
      }
    }

    // Check for high potential indicators
    if (item.source === 'GitHub' && item.metadata?.stars > 100) {
      score += 1;
      criteria_met.high_potential = true;
      reasons.push('Popular on GitHub');
    }
    
    if (item.source === 'HackerNews' && item.metadata?.points > 50) {
      score += 1;
      criteria_met.high_potential = true;
      reasons.push('Trending on HN');
    }

    // Check description for relevant keywords
    const description = (item.description || item.content || '').toLowerCase();
    const positiveKeywords = ['ai', 'blockchain', 'web3', 'defi', 'nft', 'dao', 'startup', 'launch', 'beta', 'mvp'];
    const negativeKeywords = ['enterprise', 'fortune 500', 'established', 'legacy'];
    
    const hasPositive = positiveKeywords.some(keyword => description.includes(keyword));
    const hasNegative = negativeKeywords.some(keyword => description.includes(keyword));
    
    if (hasPositive) {
      score += 0.5;
      reasons.push('Relevant technology');
    }
    if (hasNegative) {
      score -= 1;
      reasons.push('Enterprise focus');
    }

    // Normalize score
    score = Math.min(10, Math.max(0, score));
    
    // Determine fit
    const accelerate_fit = score >= 6 && 
      (criteria_met.early_stage || criteria_met.low_funding || criteria_met.small_team);

    return {
      score,
      accelerate_fit,
      reasoning: reasons.length > 0 ? reasons.join(', ') : 'Neutral assessment',
      confidence: 0.7, // Lower confidence for heuristic
      criteria_met
    };
  }
}

// Export singleton
export const aiScorer = new AIScorer();