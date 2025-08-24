import { supabase } from './supabase';

/**
 * Retrieve OpenAI API key from environment
 * In Supabase, this should be set in the Edge Function Secrets or Project Settings
 */
export async function getOpenAIKey(): Promise<string | null> {
  // In production on Vercel/Supabase, this will be set as an environment variable
  const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
  
  if (!apiKey) {
    console.warn('OpenAI API key not found. Set OPENAI_API_KEY in environment variables.')
    return null
  }
  
  return apiKey
}

/**
 * Update OpenAI API key in Supabase
 */
export async function updateOpenAIKey(apiKey: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'openai_api_key',
        value: apiKey,
        updated_at: new Date().toISOString()
      })
    
    if (error) {
      console.error('Error updating OpenAI key:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error updating OpenAI key:', error)
    return false
  }
}