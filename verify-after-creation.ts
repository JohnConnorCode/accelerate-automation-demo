import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTgyMTg3OCwiZXhwIjoyMDYxMzk3ODc4fQ.uLmGCIzOTtuBFxlksGm-bujwZikBd5ionkbUnayfZQQ';

async function verifyAfterCreation() {
  console.log('🎯 Verifying staging tables after manual SQL creation...');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Test data for each table
  const testSuites = [
    {
      table: 'queue_projects',
      data: {
        name: 'Verification Project',
        description: 'Testing project table functionality',
        url: 'https://verification-project.com',
        source: 'verification-test',
        score: 87,
        team_size: 4,
        funding_raised: 250000,
        github_url: 'https://github.com/test/verification'
      },
      requiredFields: ['name', 'description', 'url', 'source']
    },
    {
      table: 'queue_funding_programs',
      data: {
        name: 'Verification Grant',
        organization: 'Verification Ventures',
        description: 'Testing funding program table functionality',
        url: 'https://verification-grant.com',
        source: 'verification-test',
        score: 93,
        funding_type: 'grant',
        min_amount: 10000,
        max_amount: 50000
      },
      requiredFields: ['name', 'organization', 'description', 'url', 'source']
    },
    {
      table: 'queue_resources',
      data: {
        title: 'Verification Tool',
        description: 'Testing resource table functionality',
        url: 'https://verification-tool.com',
        source: 'verification-test',
        score: 81,
        resource_type: 'tool',
        category: 'development',
        price_type: 'free'
      },
      requiredFields: ['title', 'description', 'url', 'source']
    }
  ];

  let allTestsPassed = true;
  const results: any[] = [];

  for (const suite of testSuites) {
    console.log(`\n📋 Testing ${suite.table}:`);
    
    const result = {
      table: suite.table,
      exists: false,
      insertWorks: false,
      selectWorks: false,
      updateWorks: false,
      deleteWorks: false,
      error: null as string | null
    };

    try {
      // Test 1: Check table exists and get initial count
      const { count: initialCount, error: countError } = await supabase
        .from(suite.table)
        .select('*', { count: 'exact', head: true });

      if (countError) {
        result.error = `Table access error: ${countError.message}`;
        console.log(`❌ Cannot access table: ${countError.message}`);
      } else {
        result.exists = true;
        console.log(`✅ Table exists with ${initialCount || 0} rows`);
      }

      if (!result.exists) {
        results.push(result);
        allTestsPassed = false;
        continue;
      }

      // Test 2: Insert data
      console.log(`   🔄 Testing insert...`);
      const { data: insertedData, error: insertError } = await supabase
        .from(suite.table)
        .insert(suite.data)
        .select()
        .single();

      if (insertError) {
        result.error = `Insert error: ${insertError.message}`;
        console.log(`   ❌ Insert failed: ${insertError.message}`);
      } else if (insertedData) {
        result.insertWorks = true;
        console.log(`   ✅ Insert successful (ID: ${insertedData.id})`);

        // Test 3: Select the inserted data
        console.log(`   🔄 Testing select...`);
        const { data: selectedData, error: selectError } = await supabase
          .from(suite.table)
          .select('*')
          .eq('id', insertedData.id)
          .single();

        if (selectError) {
          console.log(`   ❌ Select failed: ${selectError.message}`);
        } else if (selectedData) {
          result.selectWorks = true;
          console.log(`   ✅ Select successful`);

          // Verify required fields are present
          const missingFields = suite.requiredFields.filter(field => !selectedData[field]);
          if (missingFields.length > 0) {
            console.log(`   ⚠️  Missing fields: ${missingFields.join(', ')}`);
          } else {
            console.log(`   ✅ All required fields present`);
          }
        }

        // Test 4: Update the data
        console.log(`   🔄 Testing update...`);
        const updateData = suite.table === 'queue_projects' 
          ? { name: 'Updated Project' }
          : suite.table === 'queue_funding_programs'
          ? { name: 'Updated Grant' }
          : { title: 'Updated Resource' };

        const { error: updateError } = await supabase
          .from(suite.table)
          .update(updateData)
          .eq('id', insertedData.id);

        if (updateError) {
          console.log(`   ❌ Update failed: ${updateError.message}`);
        } else {
          result.updateWorks = true;
          console.log(`   ✅ Update successful`);
        }

        // Test 5: Delete the test data
        console.log(`   🔄 Testing delete...`);
        const { error: deleteError } = await supabase
          .from(suite.table)
          .delete()
          .eq('id', insertedData.id);

        if (deleteError) {
          console.log(`   ❌ Delete failed: ${deleteError.message}`);
        } else {
          result.deleteWorks = true;
          console.log(`   ✅ Delete successful`);
        }
      }

      // Test 6: Verify final count is back to original
      const { count: finalCount, error: finalCountError } = await supabase
        .from(suite.table)
        .select('*', { count: 'exact', head: true });

      if (!finalCountError && finalCount === initialCount) {
        console.log(`   ✅ Final count matches initial count (${finalCount})`);
      } else if (!finalCountError) {
        console.log(`   ⚠️  Count mismatch: initial=${initialCount}, final=${finalCount}`);
      }

    } catch (err: any) {
      result.error = `Exception: ${err.message}`;
      console.log(`   💥 Exception: ${err.message}`);
    }

    // Determine if this table passed all tests
    const tableFullyFunctional = result.exists && result.insertWorks && 
                                 result.selectWorks && result.updateWorks && 
                                 result.deleteWorks;
    
    if (tableFullyFunctional) {
      console.log(`   🎉 ${suite.table} is FULLY FUNCTIONAL!`);
    } else {
      console.log(`   ❌ ${suite.table} has issues`);
      allTestsPassed = false;
    }

    results.push(result);
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL VERIFICATION SUMMARY');
  console.log('='.repeat(60));

  for (const result of results) {
    const status = result.exists && result.insertWorks && result.selectWorks && 
                   result.updateWorks && result.deleteWorks ? 
                   '🎉 FULLY FUNCTIONAL' : '❌ ISSUES DETECTED';
    
    console.log(`${result.table}: ${status}`);
    
    if (result.error) {
      console.log(`   └── Error: ${result.error}`);
    }
    
    const operations = [];
    if (result.insertWorks) operations.push('INSERT');
    if (result.selectWorks) operations.push('SELECT');
    if (result.updateWorks) operations.push('UPDATE');
    if (result.deleteWorks) operations.push('DELETE');
    
    if (operations.length > 0) {
      console.log(`   └── Working operations: ${operations.join(', ')}`);
    }
  }

  console.log('\n🚀 SYSTEM STATUS:');
  if (allTestsPassed) {
    console.log('🎉 ALL STAGING TABLES ARE FULLY OPERATIONAL!');
    console.log('✅ Complete CRUD functionality verified');
    console.log('✅ Ready for production data ingestion');
    console.log('✅ All three queues (projects, funding, resources) working');
    
    console.log('\n📊 What this means:');
    console.log('• Your content automation system can now queue items for review');
    console.log('• Manual approval workflow is ready');
    console.log('• Data will flow: Fetch → Queue → Review → Approve → Live');
    console.log('• No more database setup needed!');
  } else {
    console.log('❌ SOME TABLES HAVE ISSUES');
    console.log('❗ Review the errors above and fix any remaining problems');
    console.log('❗ You may need to run the SQL script again or check permissions');
  }

  return { success: allTestsPassed, results };
}

verifyAfterCreation().catch(console.error);