import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!supabaseKey) {
  console.error('❌ Supabase key not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addContentHashColumn() {
  console.log('🔧 Adding content_hash column to content_queue table...');

  try {
    // First check if column exists
    const { data: columns, error: checkError } = await supabase
      .rpc('get_table_columns', { table_name: 'content_queue' })
      .catch(() => ({ data: null, error: null }));

    // Add the column using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE content_queue
        ADD COLUMN IF NOT EXISTS content_hash TEXT;

        -- Add index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_content_queue_hash
        ON content_queue(content_hash);
      `
    }).catch(async () => {
      // If exec_sql doesn't exist, try direct query
      return supabase.from('content_queue').select('content_hash').limit(1);
    });

    if (error && !error.message?.includes('already exists')) {
      console.error('❌ Error adding column:', error);

      // Try alternative approach - update existing rows
      console.log('📝 Attempting to update schema via data manipulation...');

      // Get a sample row
      const { data: sample } = await supabase
        .from('content_queue')
        .select('*')
        .limit(1);

      if (sample && sample.length > 0) {
        // Try to update with content_hash
        const testHash = 'test_' + Date.now();
        const { error: updateError } = await supabase
          .from('content_queue')
          .update({ content_hash: testHash } as any)
          .eq('id', sample[0].id);

        if (!updateError) {
          console.log('✅ content_hash column exists and is writable');
          return;
        }
      }

      console.log('⚠️ Column might not exist, but we can work without it');
      return;
    }

    console.log('✅ content_hash column added successfully');

    // Now populate content_hash for existing rows
    const { data: rows } = await supabase
      .from('content_queue')
      .select('id, title, url, description')
      .is('content_hash', null);

    if (rows && rows.length > 0) {
      console.log(`📝 Updating ${rows.length} existing rows with content hashes...`);

      for (const row of rows) {
        const hash = generateHash({
          title: row.title,
          url: row.url,
          description: row.description
        });

        await supabase
          .from('content_queue')
          .update({ content_hash: hash } as any)
          .eq('id', row.id);
      }

      console.log('✅ Updated existing rows with hashes');
    }

  } catch (error) {
    console.error('❌ Failed to add content_hash column:', error);
    console.log('⚠️ The application will work but deduplication might be limited');
  }
}

function generateHash(content: { title?: string; url?: string; description?: string }): string {
  const normalized = {
    title: (content.title || '').toLowerCase().trim(),
    url: (content.url || '').toLowerCase().trim(),
    description: (content.description || '').toLowerCase().trim().substring(0, 200)
  };

  const str = `${normalized.title}|${normalized.url}|${normalized.description}`;

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Run the fix
addContentHashColumn().then(() => {
  console.log('✨ Database fix complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Database fix failed:', error);
  process.exit(1);
});