#!/usr/bin/env npx tsx

/**
 * Validate environment variables and API keys
 * Run this to ensure all keys are properly configured
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// Load environment variables
const envFiles = ['.env.local', '.env.production', '.env'];
for (const file of envFiles) {
  if (existsSync(join(process.cwd(), file))) {
    config({ path: file });
    console.log(`✅ Loaded ${file}`);
  }
}

interface KeyValidation {
  name: string;
  value: string | undefined;
  required: boolean;
  validator?: (value: string) => boolean;
}

const keys: KeyValidation[] = [
  {
    name: 'OPENAI_API_KEY',
    value: process.env.OPENAI_API_KEY,
    required: true,
    validator: (v) => v.startsWith('sk-') && v.length > 20 && v !== 'Ctrl+C'
  },
  {
    name: 'SUPABASE_URL',
    value: process.env.SUPABASE_URL,
    required: true,
    validator: (v) => v.startsWith('https://') && v.includes('.supabase.co')
  },
  {
    name: 'SUPABASE_ANON_KEY',
    value: process.env.SUPABASE_ANON_KEY,
    required: true,
    validator: (v) => v.startsWith('eyJ') && v.length > 100
  },
  {
    name: 'SUPABASE_SERVICE_KEY',
    value: process.env.SUPABASE_SERVICE_KEY,
    required: false,
    validator: (v) => v.startsWith('eyJ') && v.length > 100
  }
];

console.log('\n🔐 API Keys Validation Report\n');
console.log('='.repeat(50));

let hasErrors = false;

for (const key of keys) {
  const status = [];
  
  if (!key.value) {
    status.push('❌ MISSING');
    if (key.required) hasErrors = true;
  } else if (key.value === 'Ctrl+C') {
    status.push('❌ INVALID (Ctrl+C placeholder)');
    if (key.required) hasErrors = true;
  } else if (key.validator && !key.validator(key.value)) {
    status.push('⚠️  INVALID FORMAT');
    if (key.required) hasErrors = true;
  } else {
    status.push('✅ SET');
  }
  
  const maskedValue = key.value 
    ? key.value.substring(0, 10) + '...' + (key.value.length > 20 ? key.value.slice(-4) : '')
    : 'NOT SET';
    
  console.log(`${key.name}:`);
  console.log(`  Status: ${status.join(', ')}`);
  console.log(`  Value: ${maskedValue}`);
  console.log(`  Required: ${key.required ? 'YES' : 'No'}`);
  console.log();
}

console.log('='.repeat(50));

if (hasErrors) {
  console.error('\n❌ VALIDATION FAILED - Critical keys missing or invalid');
  console.error('\nTo fix:');
  console.error('1. Add missing keys to .env.local');
  console.error('2. Update Vercel environment variables');
  console.error('3. Ensure keys are real values, not placeholders');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are properly configured');
  
  // Test OpenAI connection if key is present
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.log('\n🧪 Testing OpenAI connection...');
    fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    })
    .then(response => {
      if (response.ok) {
        console.log('✅ OpenAI API key is valid and working');
      } else {
        console.error(`❌ OpenAI API key is invalid: ${response.status} ${response.statusText}`);
      }
    })
    .catch(error => {
      console.error('❌ Could not connect to OpenAI:', error);
    });
  }
}