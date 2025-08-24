import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.20.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get OpenAI API key from environment (securely stored in Supabase)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured in Edge Function environment')
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    })

    // Get request body
    const { content, contentType } = await req.json()

    // Create the scoring prompt
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
  "ai_summary": "1-2 sentence summary",
  "ai_reasoning": "Brief explanation of scores",
  "confidence": 0.0-1.0
}`

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in AI enrichment:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})