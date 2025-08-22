const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getOpenAIKey() {
  // Try to get OpenAI key from vault or settings
  const { data, error } = await supabase
    .from('decrypted_secrets')
    .select('decrypted_secret')
    .eq('name', 'openai_api_key')
    .single();
  
  if (data) {
    console.log('OpenAI key found in Supabase:', data.decrypted_secret ? 'Yes (hidden)' : 'No');
  } else {
    console.log('Error or not found:', error?.message || 'No OpenAI key in vault');
  }
}

getOpenAIKey();
