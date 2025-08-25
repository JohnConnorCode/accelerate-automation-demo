import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from "https://deno.land/x/openai@v4.20.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { platform, topic, style, dataSource } = await req.json()

    // Initialize OpenAI with API key from environment
    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!,
    })

    // Generate content based on platform
    const prompts = {
      twitter: `Write a compelling Twitter thread (3-5 tweets) about ${topic} for Web3 builders and founders. Style: ${style || 'informative'}. Make it engaging and actionable.`,
      linkedin: `Write a professional LinkedIn post about ${topic} for startup founders and developers. Style: ${style || 'thought leadership'}. Include insights and actionable advice.`,
      blog: `Write a concise blog post intro (200 words) about ${topic} for the Web3 developer community. Style: ${style || 'educational'}. Focus on practical value.`,
      discord: `Write an announcement for a Discord community about ${topic}. Style: ${style || 'casual'}. Keep it brief and engaging.`
    }

    const prompt = prompts[platform as keyof typeof prompts] || prompts.twitter

    // Generate content using GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a content strategist for Web3 startups, developers, and founders. Create engaging, valuable content that helps builders succeed."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const generatedContent = completion.choices[0].message.content

    // Score the content
    const scoringCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Score this content from 0-100 based on: relevance to Web3 builders (40%), engagement potential (30%), actionable insights (30%). Return only a number."
        },
        {
          role: "user",
          content: generatedContent || ""
        }
      ],
      temperature: 0,
      max_tokens: 10
    })

    const score = parseInt(scoringCompletion.choices[0].message.content || "70")

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Save to content_queue table
    const { data, error } = await supabase
      .from('content_queue')
      .insert({
        platform,
        topic,
        content: generatedContent,
        score,
        status: 'pending',
        metadata: {
          style,
          dataSource,
          model: 'gpt-4-turbo-preview',
          generatedAt: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        content: generatedContent,
        score,
        id: data.id,
        status: 'pending'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Failed to generate content. Check your API key and try again.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})