#!/usr/bin/env npx tsx
/**
 * Test the EnrichmentOrchestrator service on real database entries
 */

import { config } from 'dotenv';
config();

import { EnrichmentOrchestrator } from './src/services/enrichment-orchestrator';

async function testEnrichment() {
  console.log('🔄 TESTING ENRICHMENT ORCHESTRATOR');
  console.log('=' .repeat(60));
  console.log('\nThis will enrich existing database entries with:');
  console.log('- Team size from GitHub contributors');
  console.log('- Funding amounts from AI extraction');
  console.log('- Social links from READMEs');
  console.log('- URL validation');
  console.log('- Development status inference\n');

  const orchestrator = new EnrichmentOrchestrator();
  
  console.log('📦 Starting enrichment of projects...\n');
  
  try {
    // Test with a small batch first
    const results = await orchestrator.enrichProjects(5);
    
    if (results.length === 0) {
      console.log('⚠️ No projects found needing enrichment');
      return;
    }
    
    console.log(`✅ Enriched ${results.length} projects\n`);
    
    // Display results
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.original_data.name || 'Unknown Project'}`);
      console.log(`   Status: ${result.validation_status}`);
      console.log(`   Sources Used: ${result.sources_used.join(', ')}`);
      
      if (Object.keys(result.enriched_fields).length > 0) {
        console.log('   Enriched Fields:');
        Object.entries(result.enriched_fields).forEach(([field, value]) => {
          const confidence = result.confidence_scores[field];
          console.log(`     - ${field}: ${JSON.stringify(value)} (confidence: ${confidence})`)
        });
      } else {
        console.log('   No new fields added');
      }
      
      if (result.discrepancies.length > 0) {
        console.log('   ⚠️ Discrepancies found:');
        result.discrepancies.forEach(d => {
          console.log(`     - ${d.field}: ${d.recommendation}`);
        });
      }
      
      console.log();
    });
    
    // Show stats
    const stats = orchestrator.getStats();
    console.log('📊 ENRICHMENT STATISTICS');
    console.log('=' .repeat(60));
    console.log(`Processed: ${stats.processed}`);
    console.log(`Successfully Enriched: ${stats.enriched}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Total Fields Added: ${stats.fields_added}`);
    
    // Test enriching funding and resources too
    console.log('\n💰 Testing funding program enrichment...');
    const fundingResults = await orchestrator.enrichFundingPrograms(3);
    console.log(`Enriched ${fundingResults.length} funding programs`);
    
    console.log('\n📚 Testing resource enrichment...');
    const resourceResults = await orchestrator.enrichResources(3);
    console.log(`Enriched ${resourceResults.length} resources`);
    
  } catch (error) {
    console.error('❌ Enrichment failed:', error);
  }
}

testEnrichment().catch(console.error);