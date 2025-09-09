#!/usr/bin/env npx tsx

import { projectExtractor } from './src/extractors/project-extractor';
import { fundingExtractor } from './src/extractors/funding-extractor';
import { supabase } from './src/lib/supabase-client';

async function testPipelineIntegration() {
  console.log('🔄 TESTING FULL PIPELINE INTEGRATION\n');
  console.log('='.repeat(60));
  
  // Step 1: Test if queue tables exist
  console.log('\n📊 STEP 1: Checking Queue Tables\n');
  
  const queueTables = [
    'queue_projects',
    'queue_funding_programs',
    'queue_resources'
  ];
  
  let tablesExist = true;
  
  for (const table of queueTables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);
    
    if (error?.code === '42P01') {
      console.log(`❌ ${table}: Does not exist`);
      tablesExist = false;
    } else if (error) {
      console.log(`⚠️  ${table}: ${error.message}`);
      tablesExist = false;
    } else {
      console.log(`✅ ${table}: Exists and accessible`);
    }
  }
  
  if (!tablesExist) {
    console.log('\n⚠️  Queue tables don\'t exist!');
    console.log('📝 Run this SQL in Supabase Dashboard:');
    console.log('   File: create-robust-queue-tables.sql');
    console.log('   URL: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  }
  
  // Step 2: Test data extraction
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 STEP 2: Testing Data Extraction\n');
  
  const sampleProject = {
    name: 'test-web3-project',
    description: 'A test project for pipeline validation',
    html_url: 'https://github.com/test/project',
    stargazers_count: 50,
    created_at: '2024-01-01T00:00:00Z',
    language: 'TypeScript',
    topics: ['web3', 'defi'],
    contributors: [
      { login: 'alice', name: 'Alice Developer' },
      { login: 'bob', name: 'Bob Builder' }
    ]
  };
  
  const extracted = projectExtractor.extract(sampleProject, 'github');
  
  if (extracted) {
    console.log('✅ Project extraction successful');
    
    // Validate all required fields for queue_projects
    const requiredFields = [
      'name', 'description', 'team_size', 'founder_names',
      'funding_raised', 'launch_date', 'technical_stack',
      'project_needs', 'problem_statement', 'solution_description'
    ];
    
    let allFieldsPresent = true;
    for (const field of requiredFields) {
      const value = (extracted as any)[field];
      const isValid = value !== undefined && value !== null && 
                     (Array.isArray(value) ? value.length > 0 : true);
      
      if (!isValid) {
        console.log(`  ❌ Missing required field: ${field}`);
        allFieldsPresent = false;
      }
    }
    
    if (allFieldsPresent) {
      console.log('  ✅ All required fields present');
    }
    
    // Check field constraints
    console.log('\n📋 Field Constraint Validation:');
    
    const constraints = [
      { field: 'team_size', check: extracted.team_size > 0 && extracted.team_size <= 10, msg: 'team_size in range 1-10' },
      { field: 'funding_raised', check: extracted.funding_raised >= 0 && extracted.funding_raised < 500000, msg: 'funding < $500k' },
      { field: 'launch_date', check: new Date(extracted.launch_date) >= new Date('2024-01-01'), msg: 'launch >= 2024' },
      { field: 'description', check: extracted.description.length >= 100, msg: 'description >= 100 chars' },
      { field: 'problem_statement', check: extracted.problem_statement.length >= 100, msg: 'problem >= 100 chars' }
    ];
    
    for (const constraint of constraints) {
      console.log(`  ${constraint.check ? '✅' : '❌'} ${constraint.msg}`);
    }
  } else {
    console.log('❌ Project extraction failed');
  }
  
  // Step 3: Test funding extraction
  console.log('\n' + '='.repeat(60));
  console.log('\n💰 STEP 3: Testing Funding Extraction\n');
  
  const sampleFunding = {
    name: 'Test Grant Program',
    description: 'Supporting Web3 builders',
    min_amount: '25K',
    max_amount: '250,000',
    deadline: '2024-12-31',
    requirements: ['Open source', 'Web3 focus', 'Team of 2+']
  };
  
  const fundingExtracted = fundingExtractor.extract(sampleFunding, 'grants');
  
  if (fundingExtracted) {
    console.log('✅ Funding extraction successful');
    
    // Validate required fields for queue_funding_programs
    const fundingRequiredFields = [
      'name', 'organization', 'description', 'min_amount', 'max_amount',
      'application_url', 'application_process_description', 
      'eligibility_criteria', 'stage_preferences', 'sector_focus',
      'benefits', 'last_investment_date', 'recent_investments'
    ];
    
    let allFundingFieldsPresent = true;
    for (const field of fundingRequiredFields) {
      const value = (fundingExtracted as any)[field];
      const isValid = value !== undefined && value !== null &&
                     (Array.isArray(value) ? value.length > 0 : true);
      
      if (!isValid) {
        console.log(`  ❌ Missing required field: ${field}`);
        allFundingFieldsPresent = false;
      }
    }
    
    if (allFundingFieldsPresent) {
      console.log('  ✅ All required fields present');
    }
    
    // Check funding constraints
    console.log('\n📋 Funding Constraint Validation:');
    
    const fundingConstraints = [
      { check: fundingExtracted.min_amount > 0, msg: 'min_amount > 0' },
      { check: fundingExtracted.max_amount >= fundingExtracted.min_amount, msg: 'max >= min' },
      { check: fundingExtracted.description.length >= 100, msg: 'description >= 100 chars' },
      { check: new Date(fundingExtracted.last_investment_date) >= new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), msg: 'active within 6 months' }
    ];
    
    for (const constraint of fundingConstraints) {
      console.log(`  ${constraint.check ? '✅' : '❌'} ${constraint.msg}`);
    }
  } else {
    console.log('❌ Funding extraction failed');
  }
  
  // Step 4: Test database insertion (if tables exist)
  if (tablesExist) {
    console.log('\n' + '='.repeat(60));
    console.log('\n💾 STEP 4: Testing Database Insertion\n');
    
    // Try to insert extracted project
    if (extracted) {
      const projectToInsert = {
        ...extracted,
        id: 'test-' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        source: 'test',
        status: 'pending',
        unique_value_proposition: extracted.unique_value_proposition || 'Test UVP'
      };
      
      const { error: insertError } = await supabase
        .from('queue_projects')
        .insert(projectToInsert);
      
      if (insertError) {
        console.log('❌ Project insertion failed:', insertError.message);
        console.log('   This likely means the table structure doesn\'t match');
      } else {
        console.log('✅ Project inserted successfully');
        
        // Clean up test data
        await supabase
          .from('queue_projects')
          .delete()
          .eq('id', projectToInsert.id);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 PIPELINE INTEGRATION SUMMARY:\n');
  
  const issues = [];
  
  if (!tablesExist) {
    issues.push('Queue tables need to be created in Supabase');
  }
  
  if (!extracted || !fundingExtracted) {
    issues.push('Extractors are not working properly');
  }
  
  if (extracted && extracted.data_completeness_score < 0.5) {
    issues.push('Data completeness scores are too low');
  }
  
  if (issues.length === 0) {
    console.log('✅ Pipeline is READY for production!');
    console.log('\nNext steps:');
    console.log('1. Create queue tables in Supabase (if not done)');
    console.log('2. Run full fetch cycle to populate queues');
    console.log('3. Review and approve items in admin UI');
  } else {
    console.log('⚠️  Pipeline has issues to resolve:\n');
    issues.forEach(issue => console.log(`  • ${issue}`));
    console.log('\n📝 CRITICAL NEXT STEP:');
    console.log('   Execute create-robust-queue-tables.sql in Supabase SQL editor');
    console.log('   URL: https://supabase.com/dashboard/project/eqpfvmwmdtsgddpsodsr/sql/new');
  }
  
  // Show extraction quality metrics
  console.log('\n📈 EXTRACTION QUALITY METRICS:\n');
  if (extracted) {
    console.log(`Project completeness: ${(extracted.data_completeness_score * 100).toFixed(0)}%`);
  }
  if (fundingExtracted) {
    console.log(`Funding completeness: ${(fundingExtracted.data_completeness_score * 100).toFixed(0)}%`);
  }
}

testPipelineIntegration().catch(console.error);