#!/usr/bin/env npx tsx

import { supabase } from './src/lib/supabase-client';

async function analyzeQueue() {
  console.log('🔍 ANALYZING CONTENT_QUEUE STRUCTURE\n');
  console.log('='.repeat(60));
  
  // Get a sample item from content_queue
  const { data: sample } = await supabase
    .from('content_queue')
    .select('*')
    .limit(1)
    .single();
  
  if (sample) {
    console.log('\n📊 CONTENT_QUEUE TABLE COLUMNS:\n');
    Object.keys(sample).forEach(key => {
      const value = sample[key];
      const type = typeof value;
      let preview = '';
      
      if (value === null) {
        preview = 'null';
      } else if (type === 'object') {
        preview = '(JSON data)';
      } else if (type === 'string' && value.length > 50) {
        preview = `"${value.substring(0, 47)}..."`;
      } else if (type === 'string') {
        preview = `"${value}"`;
      } else {
        preview = String(value);
      }
      
      console.log(`  ${key.padEnd(20)} ${type.padEnd(10)} ${preview}`);
    });
  }
  
  // Check what's stored in metadata field for different types
  console.log('\n' + '='.repeat(60));
  console.log('\n🗂️ METADATA ANALYSIS BY TYPE:\n');
  
  const types = ['project', 'funding', 'resource'];
  
  for (const type of types) {
    const { data: items } = await supabase
      .from('content_queue')
      .select('title, metadata, enrichment_data')
      .eq('type', type)
      .limit(3);
    
    if (items && items.length > 0) {
      console.log(`\n${type.toUpperCase()}S:\n`);
      
      items.forEach((item, idx) => {
        console.log(`  Sample ${idx + 1}: "${item.title?.substring(0, 30)}..."`);
        
        // Check metadata fields
        if (item.metadata && typeof item.metadata === 'object') {
          const metaKeys = Object.keys(item.metadata);
          console.log(`    Metadata fields: ${metaKeys.slice(0, 5).join(', ')}${metaKeys.length > 5 ? '...' : ''}`);
          
          // Show key fields for each type
          if (type === 'project') {
            console.log(`      team_size: ${item.metadata.team_size || 'missing'}`);
            console.log(`      funding_raised: ${item.metadata.funding_raised || 'missing'}`);
            console.log(`      launch_date: ${item.metadata.launch_date || 'missing'}`);
            console.log(`      project_needs: ${item.metadata.project_needs || 'missing'}`);
          } else if (type === 'funding') {
            console.log(`      min_amount: ${item.metadata.min_amount || 'missing'}`);
            console.log(`      max_amount: ${item.metadata.max_amount || 'missing'}`);
            console.log(`      deadline: ${item.metadata.deadline || 'missing'}`);
            console.log(`      equity_required: ${item.metadata.equity_required || 'missing'}`);
          } else if (type === 'resource') {
            console.log(`      price_type: ${item.metadata.price_type || 'missing'}`);
            console.log(`      provider: ${item.metadata.provider_name || 'missing'}`);
            console.log(`      category: ${item.metadata.category || 'missing'}`);
          }
        } else {
          console.log('    No metadata stored');
        }
        
        // Check enrichment_data fields
        if (item.enrichment_data && typeof item.enrichment_data === 'object' && Object.keys(item.enrichment_data).length > 0) {
          const enrichKeys = Object.keys(item.enrichment_data);
          console.log(`    Enrichment fields: ${enrichKeys.slice(0, 3).join(', ')}${enrichKeys.length > 3 ? '...' : ''}`);
        }
      });
    } else {
      console.log(`\n${type.toUpperCase()}S: No items found`);
    }
  }
  
  // Check how approval service transforms data
  console.log('\n' + '='.repeat(60));
  console.log('\n🔄 DATA FLOW ANALYSIS:\n');
  
  console.log('1. FETCHING → raw data with all fields');
  console.log('2. SCORING → adds score, confidence, ai_summary');
  console.log('3. QUEUE STORAGE:');
  console.log('   - Basic fields: title, description, url, type, source');
  console.log('   - Score fields: score, confidence, recommendation');
  console.log('   - Type-specific data: stored in metadata JSON field');
  console.log('   - Enriched data: stored in enrichment_data JSON field');
  console.log('4. APPROVAL → extracts from metadata based on type');
  console.log('5. PRODUCTION → proper typed tables with all fields');
  
  console.log('\n⚠️  CRITICAL ISSUE:');
  console.log('The metadata/enrichment_data fields are JSON blobs.');
  console.log('If fetchers don\'t populate these properly, we lose type-specific fields!');
  
  // Check if we're actually getting the fields
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ FIELD VERIFICATION:\n');
  
  const { data: recentProject } = await supabase
    .from('content_queue')
    .select('*')
    .eq('type', 'project')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentProject) {
    console.log('Recent Project Queue Item:');
    console.log(`  Has team_size? ${recentProject.metadata?.team_size ? '✅' : '❌'}`);
    console.log(`  Has funding_raised? ${recentProject.metadata?.funding_raised ? '✅' : '❌'}`);
    console.log(`  Has project_needs? ${recentProject.metadata?.project_needs ? '✅' : '❌'}`);
  }
  
  const { data: recentFunding } = await supabase
    .from('content_queue')
    .select('*')
    .eq('type', 'funding')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (recentFunding) {
    console.log('\nRecent Funding Queue Item:');
    console.log(`  Has min_amount? ${recentFunding.metadata?.min_amount ? '✅' : '❌'}`);
    console.log(`  Has max_amount? ${recentFunding.metadata?.max_amount ? '✅' : '❌'}`);
    console.log(`  Has deadline? ${recentFunding.metadata?.deadline ? '✅' : '❌'}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 CONCLUSION:\n');
  console.log('The single content_queue table works by:');
  console.log('1. Storing common fields as columns (title, url, type, etc.)');
  console.log('2. Storing type-specific fields in metadata JSON');
  console.log('3. Relying on fetchers to populate metadata correctly');
  console.log('4. Approval service extracts from metadata when moving to production');
  console.log('\nRISK: If fetchers don\'t populate metadata, we lose critical fields!');
}

analyzeQueue().catch(console.error);