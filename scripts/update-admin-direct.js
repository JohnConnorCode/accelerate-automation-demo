#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAdminById() {
  const profileId = '90c9732b-e22d-41ca-9f65-662b7814d797'; // Your profile ID
  const email = 'jt.connor88@gmail.com';
  
  console.log(`\n🔧 Updating profile ${profileId} to admin...`);
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_admin: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)
      .select();
    
    if (error) {
      console.error('❌ Error updating profile:', error);
      return false;
    }
    
    console.log('✅ Successfully updated to admin:', data);
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Main execution
console.log('🚀 Direct Admin Update');
console.log('=' .repeat(50));

updateAdminById().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ Admin privileges granted!');
    console.log(`\n📌 You can now:`);
    console.log(`1. Sign in with jt.connor88@gmail.com`);
    console.log(`2. Access the Admin panel`);
    console.log(`3. Manage all admin features`);
  } else {
    console.log('⚠️ Failed to update admin status');
  }
  process.exit(success ? 0 : 1);
});