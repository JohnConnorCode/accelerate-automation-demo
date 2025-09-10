import 'dotenv/config';
import { stagingService } from './src/services/staging-service';

async function test() {
  console.log('Testing minimal staging insertion...\n');
  
  // Test project only - we know this works
  const projectItem = {
    title: 'TestProject' + Date.now(),
    description: 'A test project for verifying the staging pipeline works correctly. This is a comprehensive description that exceeds the minimum character requirements.',
    url: 'https://test' + Date.now() + '.com',
    source: 'Test',
    type: 'project' as const,
    score: 80,
    metadata: {
      launch_date: '2024-01-01',
      funding_raised: 100000,
      team_size: 3
    }
  };
  
  try {
    const result = await stagingService.insertToStaging([projectItem]);
    
    console.log('Result:', {
      success: result.success,
      inserted: result.inserted,
      errors: result.errors
    });
    
    if (result.inserted.projects > 0) {
      console.log('\n✅ SUCCESS! Project inserted to queue_projects table');
      
      // Now check queue stats
      const stats = await stagingService.getQueueStats();
      console.log('\nQueue Stats:');
      console.log('Projects:', stats.projects);
      console.log('Funding:', stats.funding);
      console.log('Resources:', stats.resources);
    } else {
      console.log('\n❌ FAILURE: No items inserted');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

test();