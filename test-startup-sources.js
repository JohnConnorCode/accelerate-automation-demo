// Test REAL startup/funding sources - not GitHub bullshit
const sources = [
  // PRODUCT HUNT - The #1 source for launches
  {
    name: 'ProductHunt RSS Feed',
    url: 'https://www.producthunt.com/feed',
    description: 'Latest products launched'
  },
  {
    name: 'ProductHunt Today API',
    url: 'https://api.producthunt.com/v1/posts',
    description: 'Today\'s launches via API'
  },
  {
    name: 'ProductHunt Frontend API',
    url: 'https://www.producthunt.com/frontend/graphql',
    description: 'GraphQL endpoint'
  },
  
  // Y COMBINATOR - Actual startups
  {
    name: 'YC Companies Page',
    url: 'https://www.ycombinator.com/companies',
    description: 'All YC companies'
  },
  {
    name: 'YC Work at Startup',
    url: 'https://www.workatastartup.com/api/companies',
    description: 'YC companies hiring'
  },
  {
    name: 'HackerNews Jobs',
    url: 'https://hacker-news.firebaseio.com/v0/jobstories.json',
    description: 'Who is hiring posts'
  },
  
  // INDIE HACKERS - Real builders
  {
    name: 'IndieHackers Products',
    url: 'https://www.indiehackers.com/products.json',
    description: 'Indie products with revenue'
  },
  {
    name: 'IndieHackers API',
    url: 'https://api.indiehackers.com/products',
    description: 'Products API'
  },
  
  // BETALIST - Startup launches
  {
    name: 'BetaList Recent',
    url: 'https://betalist.com/api/startups',
    description: 'Recent beta launches'
  },
  
  // ANGELLIST/WELLFOUND
  {
    name: 'AngelList Startups',
    url: 'https://angel.co/api/startups',
    description: 'Startup profiles'
  },
  {
    name: 'Wellfound Trending',
    url: 'https://wellfound.com/api/trending',
    description: 'Trending startups'
  },
  
  // CRUNCHBASE (limited free)
  {
    name: 'CrunchBase ODM',
    url: 'https://api.crunchbase.com/api/v4/entities/organizations',
    description: 'Organization data'
  },
  
  // F6S - Accelerators and funding
  {
    name: 'F6S Programs',
    url: 'https://www.f6s.com/api/programs',
    description: 'Accelerator programs'
  },
  
  // GUST - Startup funding
  {
    name: 'Gust Accelerators',
    url: 'https://gust.com/api/accelerators',
    description: 'Accelerator list'
  },
  
  // Web3 specific
  {
    name: 'Web3 Grants',
    url: 'https://web3grants.net/api/grants',
    description: 'Web3 grant programs'
  },
  {
    name: 'CryptoJobsList',
    url: 'https://cryptojobslist.com/api/jobs',
    description: 'Crypto companies hiring'
  }
];

async function testSource(source) {
  console.log(`\n📡 Testing: ${source.name}`);
  console.log(`   ${source.description}`);
  console.log(`   URL: ${source.url}`);
  
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, application/xml',
      },
      redirect: 'follow'
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.status === 200) {
      const contentType = response.headers.get('content-type');
      const text = await response.text();
      
      // Check if it's real data
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        if (text.includes('product') || text.includes('startup') || text.includes('company')) {
          console.log(`   ✅ HTML with startup content (${text.length} bytes)`);
        } else {
          console.log(`   ⚠️ HTML but no startup content`);
        }
      } else if (text.startsWith('{') || text.startsWith('[')) {
        try {
          const json = JSON.parse(text);
          const count = Array.isArray(json) ? json.length : Object.keys(json).length;
          console.log(`   ✅ JSON data (${count} items/keys)`);
        } catch {
          console.log(`   ✅ Data returned (${text.length} bytes)`);
        }
      } else if (text.includes('<rss') || text.includes('<item>')) {
        const items = (text.match(/<item>/g) || []).length;
        console.log(`   ✅ RSS feed (${items} items)`);
      } else {
        console.log(`   ✅ Data returned (${text.length} bytes)`);
      }
      return true;
    } else if (response.status === 401) {
      console.log(`   🔐 Requires API key`);
    } else if (response.status === 403) {
      console.log(`   ❌ Forbidden/blocked`);
    } else if (response.status === 404) {
      console.log(`   ❌ Not found`);
    } else {
      console.log(`   ❌ Error ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
  }
  return false;
}

async function findWorkingSources() {
  console.log('🔍 FINDING REAL STARTUP/FUNDING SOURCES');
  console.log('=====================================');
  
  const working = [];
  for (const source of sources) {
    const works = await testSource(source);
    if (works) working.push(source);
  }
  
  console.log('\n📊 WORKING SOURCES:');
  console.log('==================');
  working.forEach(s => {
    console.log(`✅ ${s.name} - ${s.description}`);
  });
  
  console.log(`\nFound ${working.length} working sources`);
}

findWorkingSources();