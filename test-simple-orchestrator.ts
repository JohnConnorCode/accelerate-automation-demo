import 'dotenv/config';
import { SimpleOrchestrator } from './src/core/simple-orchestrator';

async function testSimpleOrchestrator() {
  console.log('🚀 Testing Simple Orchestrator...\n');
  
  const orchestrator = new SimpleOrchestrator();
  
  try {
    const result = await orchestrator.fetchAndProcessContent();
    
    console.log('\n📊 ORCHESTRATOR RESULTS:');
    console.log('=======================');
    console.log('Total fetched:', result.fetched);
    console.log('After deduplication:', result.deduplicated);
    console.log('After scoring:', result.scored);
    console.log('Inserted to queue:', result.inserted);
    console.log('Errors:', result.errors.length);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.forEach(err => console.log('  -', err));
    }
    
    const successRate = result.fetched > 0 ? (result.inserted / result.fetched * 100).toFixed(1) : 0;
    console.log(`\n📈 Success Rate: ${successRate}%`);
    
    if (result.inserted > 0) {
      console.log('✅ SUCCESS! Items inserted to queue tables');
    } else {
      console.log('❌ FAILURE: No items inserted');
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

testSimpleOrchestrator();