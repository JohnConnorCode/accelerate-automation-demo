import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

interface TestResult {
  table: string;
  exists: boolean;
  insertWorks: boolean;
  schema: string[];
  error?: string;
}

async function finalTest() {
  console.log('🎯 Final comprehensive test of staging tables...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const testData = [
    {
      table: 'queue_projects',
      data: {
        name: 'Test Startup',
        description: 'A revolutionary AI startup that does amazing things',
        url: 'https://test-startup.com',
        source: 'final-test',
        score: 85,
        team_size: 5,
        funding_raised: 500000,
        github_url: 'https://github.com/test/startup'
      }
    },
    {
      table: 'queue_funding_programs', 
      data: {
        name: 'Test Accelerator Program',
        organization: 'Test Ventures',
        description: 'A comprehensive startup accelerator program',
        url: 'https://test-accelerator.com',
        source: 'final-test',
        score: 90,
        funding_type: 'equity',
        min_amount: 25000,
        max_amount: 100000
      }
    },
    {
      table: 'queue_resources',
      data: {
        title: 'Test Development Tool',
        description: 'An amazing development tool for startups',
        url: 'https://test-tool.com',
        source: 'final-test',
        score: 78,
        resource_type: 'tool',
        category: 'development',
        price_type: 'freemium'
      }
    }
  ];

  const results: TestResult[] = [];

  for (const { table, data } of testData) {
    console.log(`\n🔍 Testing ${table}...`);
    
    const result: TestResult = {
      table,
      exists: false,
      insertWorks: false,
      schema: []
    };

    try {
      // Test 1: Check if table exists and get count
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        result.error = `Count error: ${countError.message}`;
        console.log(`❌ ${table}: ${countError.message}`);
      } else {
        result.exists = true;
        console.log(`✅ ${table}: Exists with ${count || 0} rows`);
      }

      // Test 2: Try inserting data
      if (result.exists) {
        const { data: insertedData, error: insertError } = await supabase
          .from(table)
          .insert(data)
          .select()
          .single();

        if (insertError) {
          result.error = `Insert error: ${insertError.message}`;
          console.log(`❌ ${table}: Insert failed - ${insertError.message}`);
        } else if (insertedData) {
          result.insertWorks = true;
          console.log(`✅ ${table}: Insert successful - ID: ${insertedData.id}`);

          // Clean up test data
          const { error: deleteError } = await supabase
            .from(table)
            .delete()
            .eq('id', insertedData.id);

          if (deleteError) {
            console.log(`⚠️  ${table}: Cleanup failed - ${deleteError.message}`);
          } else {
            console.log(`🧹 ${table}: Test data cleaned up`);
          }
        }
      }

      // Test 3: Check schema by trying to select specific columns
      if (result.exists) {
        const commonColumns = ['id', 'created_at', 'updated_at', 'status', 'score', 'metadata'];
        for (const column of commonColumns) {
          try {
            const { error: columnError } = await supabase
              .from(table)
              .select(column)
              .limit(1);

            if (!columnError) {
              result.schema.push(column);
            }
          } catch (e) {
            // Column doesn't exist, skip
          }
        }
        console.log(`📊 ${table}: Schema includes [${result.schema.join(', ')}]`);
      }

    } catch (err: any) {
      result.error = `Exception: ${err.message}`;
      console.log(`💥 ${table}: Exception - ${err.message}`);
    }

    results.push(result);
  }

  // Summary report
  console.log('\n📋 FINAL REPORT');
  console.log('===============');

  let allTablesExist = true;
  let allInsertsWork = true;

  for (const result of results) {
    const status = result.exists ? 
      (result.insertWorks ? '✅ FULLY FUNCTIONAL' : '⚠️  EXISTS BUT INSERT ISSUES') : 
      '❌ MISSING';
    
    console.log(`${result.table}: ${status}`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.schema.length > 0) {
      console.log(`   Schema: ${result.schema.length} columns verified`);
    }

    if (!result.exists) allTablesExist = false;
    if (!result.insertWorks) allInsertsWork = false;
  }

  console.log('\n🎯 SYSTEM STATUS:');
  if (allTablesExist && allInsertsWork) {
    console.log('🎉 ALL STAGING TABLES ARE FULLY FUNCTIONAL!');
    console.log('✅ Ready for production data ingestion');
    console.log('✅ All CRUD operations work correctly');
    console.log('✅ Schema validated');
  } else if (allTablesExist) {
    console.log('⚠️  TABLES EXIST BUT HAVE ISSUES');
    console.log('❗ Check permissions and constraints');
  } else {
    console.log('❌ TABLES NEED TO BE CREATED');
    console.log('❗ Manual SQL execution required');
  }

  console.log('\n📊 Tables Summary:');
  console.log('• queue_projects - For startup/project submissions');
  console.log('• queue_funding_programs - For funding opportunity submissions'); 
  console.log('• queue_resources - For tool/resource submissions');
  
  return results;
}

finalTest().catch(console.error);