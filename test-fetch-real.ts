// Test what data we're ACTUALLY fetching - no BS
import { config } from 'dotenv';
config();

// Import the fetchers directly
import { GitcoinGrantsFetcher } from './src/fetchers/accelerate-specific/open-funding-opportunities';

async function testRealFetch() {
  console.log('🔍 TESTING REAL DATA FETCH - NO FAKES');
  console.log('=====================================\n');
  
  try {
    const fetcher = new GitcoinGrantsFetcher();
    console.log('📡 Fetching from Gitcoin Grants API...');
    
    const rawData = await fetcher.fetch();
    console.log(`✅ Fetched ${rawData.length} raw data items\n`);
    
    const transformed = await fetcher.transform(rawData);
    console.log(`✅ Transformed to ${transformed.length} items\n`);
    
    if (transformed.length > 0) {
      console.log('📊 SAMPLE REAL DATA (First item):');
      console.log('--------------------------------');
      const item = transformed[0];
      console.log('Title:', item.title);
      console.log('URL:', item.url);
      console.log('Type:', item.type);
      console.log('Source:', item.source);
      console.log('Description:', item.description?.substring(0, 100) + '...');
      console.log('Metadata:', JSON.stringify(item.metadata, null, 2));
      
      // Check if this is fake data
      console.log('\n🔍 AUTHENTICITY CHECK:');
      const isFake = 
        item.title.includes('Mock') ||
        item.title.includes('Test') ||
        item.title.includes('Example') ||
        item.url.includes('example.com') ||
        item.url.includes('localhost');
        
      if (isFake) {
        console.log('❌ WARNING: This looks like FAKE data!');
      } else {
        console.log('✅ This appears to be REAL data');
      }
      
      // Try to actually fetch the URL
      console.log('\n🌐 Verifying URL is real...');
      try {
        const response = await fetch(item.url, { method: 'HEAD' });
        if (response.ok) {
          console.log('✅ URL is REAL and accessible');
        } else {
          console.log(`⚠️ URL returned status ${response.status}`);
        }
      } catch (error) {
        console.log('❌ Could not access URL:', error.message);
      }
    } else {
      console.log('❌ No data returned - this might be fake!');
    }
    
  } catch (error) {
    console.log('❌ ERROR:', error);
  }
}

testRealFetch();