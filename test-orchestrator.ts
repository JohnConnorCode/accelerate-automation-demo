// Test the AccelerateOrchestrator directly
import { config } from 'dotenv';
config();

import { orchestrator } from './src/orchestrator';

async function testOrchestrator() {
  console.log('Testing AccelerateOrchestrator...');
  console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? '✅ Present' : '❌ Missing');
  console.log('GitHub Token:', process.env.GITHUB_TOKEN ? '✅ Present' : '❌ Missing');
  
  try {
    // Run just the project fetchers
    console.log('\n📦 Running PROJECT fetchers only...');
    const result = await orchestrator.runCategory('projects');
    
    console.log('\n✅ Results:');
    console.log('- Processed:', result.processed);
    console.log('- Inserted:', result.inserted);
    console.log('- Updated:', result.updated);
    console.log('- Rejected:', result.rejected);
    console.log('- Errors:', result.errors?.length || 0);
    
    if (result.errors?.length > 0) {
      console.log('\n⚠️ Errors:');
      result.errors.forEach((err: string) => console.log('  -', err));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testOrchestrator();