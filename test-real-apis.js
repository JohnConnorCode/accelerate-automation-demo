// Test REAL APIs that might work for startup/funding data
const APIs = [
  // YCombinator - they have public data
  {
    name: 'YC Companies API',
    url: 'https://api.ycombinator.com/companies',
    test: 'https://www.ycombinator.com/companies.json'
  },
  
  // CrunchBase - has some public endpoints
  {
    name: 'CrunchBase ODM',
    url: 'https://api.crunchbase.com/odm/v4/searches/organizations',
    test: 'https://www.crunchbase.com/discover/organization.companies'
  },
  
  // AngelList/Wellfound - public job API
  {
    name: 'Wellfound Jobs',
    url: 'https://angel.co/api/jobs',
    test: 'https://wellfound.com/api/jobs'
  },
  
  // Dev.to - has startup articles
  {
    name: 'Dev.to API',
    url: 'https://dev.to/api/articles?tag=startup',
    test: 'https://dev.to/api/articles?tag=startup&per_page=5'
  },
  
  // Crypto/Web3 specific
  {
    name: 'CoinGecko Categories',
    url: 'https://api.coingecko.com/api/v3/coins/categories',
    test: 'https://api.coingecko.com/api/v3/coins/categories'
  },
  
  // GitHub - search for Web3 projects
  {
    name: 'GitHub Search',
    url: 'https://api.github.com/search/repositories?q=web3+created:>2024-01-01&sort=stars',
    test: 'https://api.github.com/search/repositories?q=web3+blockchain+created:>2024-01-01&sort=stars&per_page=5'
  },
  
  // DeFi Pulse - project list
  {
    name: 'DeFi Pulse',
    url: 'https://data.defipulse.com/api/projects',
    test: 'https://api.llama.fi/protocols'
  },
  
  // Web3 grants
  {
    name: 'Gitcoin Grants GraphQL',
    url: 'https://grants-stack-indexer-v2.gitcoin.co/graphql',
    test: 'https://grants-stack-indexer-v2.gitcoin.co/data/1/rounds.json'
  }
];

async function testAPI(api) {
  console.log(`\n📡 Testing: ${api.name}`);
  console.log(`   URL: ${api.test}`);
  
  try {
    const response = await fetch(api.test, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AccelerateBot/1.0)'
      }
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      console.log(`   Type: ${contentType}`);
      
      const text = await response.text();
      console.log(`   Size: ${text.length} bytes`);
      
      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) {
          console.log(`   ✅ Returns array with ${data.length} items`);
        } else if (data && typeof data === 'object') {
          console.log(`   ✅ Returns object with keys: ${Object.keys(data).slice(0, 5).join(', ')}`);
        }
      } catch {
        console.log(`   ⚠️ Not JSON format`);
      }
      
      return true;
    } else {
      console.log(`   ❌ Failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testAll() {
  console.log('🔍 TESTING REAL PUBLIC APIs FOR STARTUP/FUNDING DATA');
  console.log('=====================================================');
  
  const results = [];
  for (const api of APIs) {
    const works = await testAPI(api);
    results.push({ name: api.name, works });
  }
  
  console.log('\n📊 RESULTS SUMMARY:');
  console.log('===================');
  const working = results.filter(r => r.works);
  console.log(`✅ Working: ${working.length}`);
  working.forEach(r => console.log(`   - ${r.name}`));
  
  const broken = results.filter(r => !r.works);
  console.log(`❌ Not working: ${broken.length}`);
  broken.forEach(r => console.log(`   - ${r.name}`));
}

testAll();