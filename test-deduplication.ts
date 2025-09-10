import 'dotenv/config';
import { deduplicationService } from './src/services/deduplication';

async function testDeduplication() {
  console.log('Testing Deduplication Service...\n');
  
  const testItems = [
    {
      title: 'Test Project 1',
      url: 'https://example.com/project1',
      type: 'project',
      description: 'A test project'
    },
    {
      title: 'Test Project 2',
      url: 'https://example.com/project2',
      type: 'project',
      description: 'Another test project'
    },
    {
      title: 'Duplicate Project',
      url: 'https://example.com/project1', // Same URL as first
      type: 'project',
      description: 'This should be marked as duplicate'
    }
  ];
  
  for (const item of testItems) {
    const isDupe = await deduplicationService.isDuplicate(item);
    console.log(`${item.title}: ${isDupe ? '🔁 DUPLICATE' : '✅ UNIQUE'}`);
  }
  
  // Test batch deduplication
  console.log('\nTesting batch deduplication...');
  const result = await deduplicationService.filterDuplicates(testItems);
  console.log(`Unique: ${result.unique.length}, Duplicates: ${result.duplicates.length}`);
  
  process.exit(0);
}

testDeduplication();