/**
 * Shared Supabase admin utilities for database management scripts
 */

export const PROJECT_REF = 'eqpfvmwmdtsgddpsodsr';

// Get access token from environment or use the one provided during emergency fix
// This should be moved to environment variable in production
export function getSupabaseAccessToken(): string {
  return process.env.SUPABASE_ACCESS_TOKEN || '';
}

/**
 * Execute SQL via Supabase Management API
 */
export async function executeSQL(query: string, description: string): Promise<boolean> {
  const accessToken = getSupabaseAccessToken();
  
  if (!accessToken) {
    console.error('❌ Missing SUPABASE_ACCESS_TOKEN');
    console.error('Set it with: export SUPABASE_ACCESS_TOKEN="your-token"');
    return false;
  }
  
  console.log(`\n📝 ${description}...`);
  
  const apiUrl = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
    
    const result = await response.text();
    
    if (!response.ok) {
      console.log(`   ⚠️  ${result}`);
      return false;
    }
    
    console.log(`   ✅ Success`);
    return true;
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
    return false;
  }
}

/**
 * Batch execute multiple SQL statements
 */
export async function executeSQLBatch(queries: Array<{query: string, description: string}>): Promise<boolean> {
  let allSuccess = true;
  
  for (const {query, description} of queries) {
    const success = await executeSQL(query, description);
    if (!success) {
      allSuccess = false;
    }
  }
  
  return allSuccess;
}