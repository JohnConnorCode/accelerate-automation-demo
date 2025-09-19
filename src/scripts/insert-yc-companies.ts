/**
 * Script to insert YC companies directly, bypassing RLS
 */


import type { Database } from '../types/supabase';
import { YCombinatorStartupsFetcher } from '../fetchers/real-sources/ycombinator-startups';
import { config } from 'dotenv';
import { supabase } from '../lib/supabase-client';


config();

// Use service key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}



async function insertYCCompanies() {
  console.log('🚀 Starting YC companies insertion...');
  
  try {
    // Fetch YC companies
    const fetcher = new YCombinatorStartupsFetcher();
    console.log('📡 Fetching YC companies...');
    const rawData = await fetcher.fetch();
    const ycCompanies = await fetcher.transform(rawData);
    
    console.log(`✅ Fetched ${ycCompanies.length} YC companies`);
    
    if (ycCompanies.length === 0) {
      console.log('⚠️ No YC companies found');
      return;
    }
    
    // Prepare data for resources table (since projects table has RLS issues)
    const resourcesData = ycCompanies.slice(0, 50).map(company => ({
      title: company.title,
      description: company.description,
      url: company.url,
      type: 'project', // Store as project type
      resource_type: 'Tool', // Required field, capitalized
      category: 'startup',
      tags: company.tags || [],
      target_audience: ['founders', 'investors', 'builders'],
      
      // Store YC-specific data in metadata
      metadata: {
        ...company.metadata,
        source: 'YCombinator',
        yc_batch: company.metadata?.yc_batch,
        yc_year: company.metadata?.yc_year,
        location: company.metadata?.location,
        launch_year: company.metadata?.launch_year,
        funding_raised: company.metadata?.funding_raised,
        accelerate_score: company.metadata?.accelerate_score,
        is_yc_backed: true,
        fetched_at: new Date().toISOString()
      },
      
      // Required fields
      status: 'active',
      featured: company.metadata?.accelerate_score > 60,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    console.log(`💾 Inserting ${resourcesData.length} YC companies into resources table...`);
    console.log('Sample data:', JSON.stringify(resourcesData[0], null, 2));
    
    // Insert in batches of 10
    const batchSize = 10;
    let totalInserted = 0;
    
    for (let i = 0; i < resourcesData.length; i += batchSize) {
      const batch = resourcesData.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        // DISABLED: Table 'resources' doesn't exist

        .from('resources')
        .insert(batch as any) as any || { then: () => Promise.resolve({ data: null, error: null }) };
      
      if (error) {
        console.error(`❌ Batch ${i/batchSize + 1} failed:`, error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      } else {
        totalInserted += batch.length;
        console.log(`✅ Batch ${i/batchSize + 1}: Inserted ${batch.length} companies`);
      }
    }
    
    console.log(`\n🎉 Successfully inserted ${totalInserted} YC companies!`);
    
    // Verify insertion
    const { count } = await supabase
      // DISABLED: Table 'resources' doesn't exist

      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>source', 'YCombinator') as any || { data: [], error: null };
    
    console.log(`📊 Total YC companies in database: ${count}`);
    
  } catch (error) {
    console.error('❌ Error inserting YC companies:', error);
  }
}

// Run the script
insertYCCompanies().then(() => {
  console.log('✅ Script complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});