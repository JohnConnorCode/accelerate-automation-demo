import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { deduplicationService } from './src/services/deduplication';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function test() {
  // Insert a test item
  const { data, error } = await supabase
    .from('queue_projects')
    .insert({
      company_name: 'DupeTest Inc ' + Date.now(),
      description: 'This is a test company for deduplication testing. It provides innovative solutions for duplicate detection in content management systems.',
      website: 'https://dupetest.com',
      founded_year: 2024,
      accelerate_fit: true,
      accelerate_reason: 'Testing deduplication',
      accelerate_score: 7.5,
      confidence_score: 8.0,
      team_size: 3,
      source: 'Manual Test',
      source_url: 'https://dupetest.com',
      batch_id: 'test_' + Date.now()
    })
    .select();

  if (error) {
    console.log('Insert error:', error.message);
  } else {
    console.log('✅ Inserted test item:', data[0].company_name);
  }

  // Now test if duplicate detection works
  const testItem = {
    title: 'Another DupeTest',
    url: 'https://dupetest.com', // Same URL
    type: 'project' as const
  };

  const isDupe = await deduplicationService.isDuplicate(testItem);
  console.log('Is duplicate?', isDupe ? '✅ YES (correct!)' : '❌ NO (wrong!)');
  
  // Clean up
  if (data && data[0]) {
    await supabase.from('queue_projects').delete().eq('id', data[0].id);
    console.log('🧹 Cleaned up test data');
  }
}

test();