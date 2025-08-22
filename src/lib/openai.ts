import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {

}

export const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

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
  if (!openai) {

    return null;
  }

  try {
    const prompt = `
Analyze this ${contentType} for Web3 builders and provide scores (0-10):

Title: ${content.title}
Description: ${content.description}
${contentType === 'funding' ? `Amount: ${content.funding_amount_min}-${content.funding_amount_max}` : ''}
${contentType === 'funding' ? `Deadline: ${content.deadline}` : ''}
${contentType === 'project' ? `Team Size: ${content.team_size}` : ''}
${contentType === 'project' ? `Funding Raised: ${content.funding_raised}` : ''}

Provide scores in JSON format:
{
  "relevance_score": 0-10,
  "quality_score": 0-10,
  "urgency_score": 0-10,
  ${contentType === 'resource' ? '"utility_score": 0-10,' : ''}
  ${contentType === 'project' ? '"team_score": 0-10, "traction_score": 0-10,' : ''}
  ${contentType === 'funding' ? '"amount_score": 0-10, "deadline_score": 0-10,' : ''}
  "ai_summary": "One sentence summary",
  "ai_reasoning": "Brief explanation of scores",
  "confidence": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini', // Using GPT-5 mini as requested
      messages: [
        {
          role: 'system',
          content: 'You are an expert at evaluating Web3 content for builders. Provide accurate, helpful scores.'
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

    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result as ScoringResult;
  } catch (error) {

    return null;
  }
}