// Test a single fetcher to debug the issue
const { ProductHuntEarlyStageFetcher } = require('./dist/fetchers/accelerate-specific/early-stage-projects');

async function testFetcher() {
  console.log('Testing ProductHunt Early Stage Fetcher...');
  
  try {
    const fetcher = new ProductHuntEarlyStageFetcher();
    console.log('Fetcher created');
    
    const data = await fetcher.fetch();
    console.log(`Fetched ${data.length} items`);
    
    const transformed = await fetcher.transform(data);
    console.log(`Transformed ${transformed.length} items`);
    
    if (transformed.length > 0) {
      console.log('Sample item:', JSON.stringify(transformed[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFetcher();