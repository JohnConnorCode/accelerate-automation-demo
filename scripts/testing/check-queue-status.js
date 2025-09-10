require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const [projects, investors, news] = await Promise.all([
    supabase.from('queue_projects').select('id, company_name, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
    supabase.from('queue_investors').select('id, name, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
    supabase.from('queue_news').select('id, title, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5)
  ]);
  
  console.log('Queue Tables Status:');
  console.log('==================');
  console.log('Projects:', projects.count || 0, 'total');
  if (projects.data?.length) {
    console.log('  Latest:', projects.data[0].company_name, '(' + new Date(projects.data[0].created_at).toLocaleString() + ')');
  }
  console.log('Investors:', investors.count || 0, 'total');
  if (investors.data?.length) {
    console.log('  Latest:', investors.data[0].name, '(' + new Date(investors.data[0].created_at).toLocaleString() + ')');
  }
  console.log('News:', news.count || 0, 'total');
  if (news.data?.length) {
    console.log('  Latest:', news.data[0].title, '(' + new Date(news.data[0].created_at).toLocaleString() + ')');
  }
  
  const total = (projects.count || 0) + (investors.count || 0) + (news.count || 0);
  console.log('\nTotal items in queue:', total);
  
  // Check recent inserts
  const recentMinutes = 5;
  const since = new Date(Date.now() - recentMinutes * 60 * 1000).toISOString();
  
  const [recentProjects, recentInvestors, recentNews] = await Promise.all([
    supabase.from('queue_projects').select('id', { count: 'exact' }).gte('created_at', since),
    supabase.from('queue_investors').select('id', { count: 'exact' }).gte('created_at', since),
    supabase.from('queue_news').select('id', { count: 'exact' }).gte('created_at', since)
  ]);
  
  const recentTotal = (recentProjects.count || 0) + (recentInvestors.count || 0) + (recentNews.count || 0);
  console.log('\nItems inserted in last', recentMinutes, 'minutes:', recentTotal);
  if (recentTotal > 0) {
    console.log('  Projects:', recentProjects.count || 0);
    console.log('  Investors:', recentInvestors.count || 0);
    console.log('  News:', recentNews.count || 0);
    console.log('\n✅ SUCCESS! Items are being inserted into queue tables!');
  } else {
    console.log('\n❌ FAILURE: No items inserted in the last', recentMinutes, 'minutes');
  }
}

check().catch(console.error);