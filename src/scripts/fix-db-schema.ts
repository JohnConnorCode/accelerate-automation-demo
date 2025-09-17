#!/usr/bin/env tsx

/**
 * Fix database schema - add missing columns
 */

import { supabase } from '../lib/supabase-client';

async function fixSchema() {
  console.log('🔧 Fixing database schema...');
  
  try {
    // Test if we can query the table
    const { data: testData, error: testError } = await supabase
      .from('content_queue')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Cannot access content_queue table:', testError.message);
      
      // Try to create the table if it doesn't exist
      console.log('📝 Creating content_queue table...');
      
      const { error: createError } = await supabase.rpc('exec_sql', {
        query: `
          CREATE TABLE IF NOT EXISTS content_queue (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            url TEXT NOT NULL,
            source TEXT,
            platform TEXT,
            content_type TEXT,
            score DECIMAL(5,2) DEFAULT 0,
            confidence DECIMAL(5,2) DEFAULT 0,
            status TEXT DEFAULT 'pending_review',
            ai_recommendation TEXT DEFAULT 'review',
            ai_score DECIMAL(5,2) DEFAULT 0,
            confidence_score DECIMAL(5,2) DEFAULT 0,
            enrichment_status TEXT DEFAULT 'pending',
            enrichment_data JSONB,
            raw_data JSONB,
            metadata JSONB,
            queued_at TIMESTAMP DEFAULT NOW(),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
          CREATE INDEX IF NOT EXISTS idx_content_queue_score ON content_queue(score);
          CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at);
        `
      });
      
      if (createError) {
        console.log('⚠️ Could not create table via RPC, table might already exist');
      } else {
        console.log('✅ Table created successfully!');
      }
    } else {
      console.log('✅ content_queue table exists');
    }
    
    // Now test inserting a dummy record to see what columns are missing
    const testItem = {
      title: 'Test Item - DELETE ME',
      description: 'Test description',
      url: 'https://example.com/test',
      source: 'test',
      platform: 'test',
      content_type: 'test',
      score: 50,
      confidence: 0.5,
      status: 'pending_review',
      ai_recommendation: 'review',
      ai_score: 0.5,
      confidence_score: 0.5,
      enrichment_status: 'pending',
      enrichment_data: {},
      raw_data: {},
      metadata: {},
      queued_at: new Date().toISOString()
    };
    
    console.log('🧪 Testing insert with all expected columns...');
    const { error: insertError } = await supabase
      .from('content_queue')
      .insert(testItem as any);
    
    if (insertError) {
      console.log('❌ Insert error:', insertError.message);
      
      // Extract missing column from error message
      if (insertError.message.includes('column')) {
        console.log('📝 Attempting to add missing columns...');
        
        // Try adding columns one by one
        const columns = [
          'ai_recommendation TEXT DEFAULT \'review\'',
          'ai_score DECIMAL(5,2) DEFAULT 0',
          'confidence_score DECIMAL(5,2) DEFAULT 0',
          'platform VARCHAR(100)',
          'content_type VARCHAR(100)',
          'enrichment_status VARCHAR(50) DEFAULT \'pending\'',
          'enrichment_data JSONB',
          'confidence DECIMAL(5,2) DEFAULT 0'
        ];
        
        for (const col of columns) {
          const colName = col.split(' ')[0];
          console.log(`  Adding column: ${colName}...`);
          
          // This won't work without proper SQL access, but we're documenting what's needed
          console.log(`  SQL needed: ALTER TABLE content_queue ADD COLUMN IF NOT EXISTS ${col};`);
        }
        
        console.log('\n⚠️ MANUAL ACTION REQUIRED:');
        console.log('Please run the following SQL in your Supabase dashboard:');
        console.log('----------------------------------------');
        console.log(`
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS ai_recommendation TEXT DEFAULT 'review';

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS ai_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2) DEFAULT 0;

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS platform VARCHAR(100);

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(100);

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS enrichment_status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS enrichment_data JSONB;

ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS confidence DECIMAL(5,2) DEFAULT 0;
        `);
        console.log('----------------------------------------');
      }
    } else {
      console.log('✅ All columns exist! Database schema is correct.');
      
      // Clean up test record
      const { error: deleteError } = await supabase
        .from('content_queue')
        .delete()
        .eq('title', 'Test Item - DELETE ME');
      
      if (!deleteError) {
        console.log('🧹 Cleaned up test record');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixSchema().catch(console.error);