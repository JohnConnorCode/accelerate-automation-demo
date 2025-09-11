import { stagingService } from './src/services/staging-service';

async function testDirectInsertion() {
  console.log('Testing direct insertion to queue tables...\n');
  
  // Create test items that meet ACCELERATE criteria
  const testItems = [
    {
      title: 'TestCo - AI-Powered Developer Tools',
      description: 'TestCo is building AI-powered developer tools to make coding 10x faster. Founded in 2024 by former Google engineers, we help developers ship better code faster with intelligent code completion and automated testing. Our platform integrates seamlessly with VS Code and GitHub.',
      url: 'https://testco.example.com',
      source: 'Manual Test',
      type: 'project' as const,
      score: 85,
      metadata: {
        launch_date: '2024-03-15',
        funding_raised: 250000,
        team_size: 3,
        location: 'San Francisco, CA'
      },
      ai_summary: 'Early-stage startup building developer tools with AI'
    },
    {
      title: 'Y Combinator W25 Batch Applications Open',
      description: 'Y Combinator is now accepting applications for the Winter 2025 batch. We invest $500,000 in early-stage startups and provide 3 months of intensive mentorship. Apply by October 15th. We are particularly interested in AI, developer tools, and climate tech startups.',
      url: 'https://ycombinator.com/apply',
      source: 'Manual Test',
      type: 'funding' as const,
      score: 90,
      metadata: {
        max_amount: 500000,
        application_deadline: '2024-10-15',
        is_active: true,
        organization: 'Y Combinator'
      },
      ai_summary: 'Top accelerator program for early-stage startups'
    },
    {
      title: 'How We Built Our MVP in 2 Weeks',
      content: 'A detailed guide on how we built and launched our MVP in just 2 weeks using Next.js, Supabase, and Vercel. This article covers our tech stack choices, development process, and lessons learned from shipping fast.',
      url: 'https://blog.example.com/mvp-in-2-weeks',
      source: 'Manual Test',
      type: 'resource' as const,
      score: 75,
      metadata: {
        author: 'Jane Developer',
        published_date: '2024-09-01',
        category: 'Technical'
      },
      ai_summary: 'Practical guide for building MVPs quickly'
    }
  ];
  
  try {
    console.log(`Attempting to insert ${testItems.length} test items...`);
    
    const result = await stagingService.insertToStaging(testItems);
    
    console.log('\n📊 INSERTION RESULTS:');
    console.log('====================');
    console.log('Success:', result.success ? '✅' : '❌');
    console.log('Projects inserted:', result.inserted.projects);
    console.log('Funding inserted:', result.inserted.funding);
    console.log('Resources inserted:', result.inserted.resources);
    
    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach(err => console.log('  -', err));
    }
    
    const total = result.inserted.projects + result.inserted.funding + result.inserted.resources;
    if (total > 0) {
      console.log(`\n✅ SUCCESS! Inserted ${total} items to queue tables!`);
    } else {
      console.log('\n❌ FAILURE: No items were inserted');
    }
    
    // Check queue stats
    console.log('\n📈 Queue Stats After Insertion:');
    const stats = await stagingService.getQueueStats();
    console.log('Projects - Pending:', stats.projects.pending, 'Approved:', stats.projects.approved);
    console.log('Funding - Pending:', stats.funding.pending, 'Approved:', stats.funding.approved);
    console.log('Resources - Pending:', stats.resources.pending, 'Approved:', stats.resources.approved);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

testDirectInsertion();