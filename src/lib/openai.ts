import { supabase } from './supabase';

export interface ScoringResult {
  relevance_score: number;  // 0-10: How relevant for Web3 builders
  quality_score: number;    // 0-10: Overall quality and professionalism
  urgency_score: number;    // 0-10: Time-sensitive or deadline-driven
  utility_score?: number;   // For resources: How useful/practical
  team_score?: number;      // For projects: Team quality
  traction_score?: number;  // For projects: Market traction
  amount_score?: number;    // For funding: Funding amount attractiveness
  deadline_score?: number;  // For funding: Deadline urgency
  ai_summary: string;       // Brief AI-generated summary
  ai_reasoning: string;     // Why these scores were given
  confidence: number;       // 0-1: AI confidence in scoring
}

export async function scoreContent(
  content: any,
  contentType: 'resource' | 'project' | 'funding'
): Promise<ScoringResult | null> {
  try {
    // Call the deployed Edge Function
    const { data, error } = await supabase.functions.invoke('ai-enrichment', {
      body: {
        content,
        contentType
      }
    });

    if (error) {
      console.error('Error calling AI enrichment function:', error);
      return null;
    }

    return data as ScoringResult;
  } catch (error) {
    console.error('Error scoring content:', error);
    return null;
  }
}

// Legacy exports for backward compatibility
export const openai = null;
export async function getOpenAI(): Promise<null> {
  return null;
}