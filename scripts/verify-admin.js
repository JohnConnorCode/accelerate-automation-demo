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

async function verifyAdmin() {
  const email = 'jt.connor88@gmail.com';
  
  console.log(`\n🔍 Checking admin status for ${email}...`);
  
  try {
    // Check by email
    const { data: profileByEmail, error: emailError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email);
    
    console.log('\n📋 Profiles with this email:', profileByEmail?.length || 0);
    if (profileByEmail && profileByEmail.length > 0) {
      profileByEmail.forEach(p => {
        console.log(`  - ID: ${p.id}`);
        console.log(`    Email: ${p.email}`);
        console.log(`    Admin: ${p.is_admin}`);
        console.log(`    Updated: ${p.updated_at}`);
      });
    }
    
    // Check by specific ID
    const profileId = '90c9732b-e22d-41ca-9f65-662b7814d797';
    const { data: profileById, error: idError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();
    
    if (profileById) {
      console.log('\n✅ Profile found by ID:');
      console.log(`  - ID: ${profileById.id}`);
      console.log(`  - Email: ${profileById.email}`);
      console.log(`  - Admin: ${profileById.is_admin}`);
      console.log(`  - Updated: ${profileById.updated_at}`);
      
      if (!profileById.is_admin) {
        console.log('\n⚠️ Profile is NOT admin! Updating now...');
        
        // Force update
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({ 
            is_admin: true,
            email: email, // Ensure email is set
            updated_at: new Date().toISOString()
          })
          .eq('id', profileId)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ Update failed:', updateError);
        } else {
          console.log('✅ Update successful:', updated);
        }
      }
    } else {
      console.log('\n❌ Profile not found by ID:', idError);
    }
    
    // Check auth user
    console.log('\n🔐 Checking auth user...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.log('⚠️ Cannot access auth.users (requires service role key)');
    } else {
      const authUser = users?.find(u => u.email === email);
      if (authUser) {
        console.log('✅ Auth user found:', authUser.id);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Main execution
console.log('🚀 Admin Verification');
console.log('=' .repeat(50));

verifyAdmin().then(() => {
  console.log('\n' + '='.repeat(50));
  console.log('✅ Verification complete');
  console.log('\n📌 Next steps:');
  console.log('1. Clear your browser cache/cookies');
  console.log('2. Sign out and sign back in');
  console.log('3. The admin status should now work');
  process.exit(0);
});