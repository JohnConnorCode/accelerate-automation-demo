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

async function addToAdminUsers() {
  const userId = '90c9732b-e22d-41ca-9f65-662b7814d797';
  const email = 'jt.connor88@gmail.com';
  
  console.log(`\n🔍 Checking admin_users table for ${email}...`);
  
  try {
    // First check if already exists
    const { data: existing, error: checkError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId);
    
    if (existing && existing.length > 0) {
      console.log('✅ User already in admin_users table:', existing);
      return true;
    }
    
    console.log('⚠️ User not in admin_users table. Adding now...');
    
    // Add to admin_users table
    const { data: newAdmin, error: insertError } = await supabase
      .from('admin_users')
      .insert({
        user_id: userId,
        created_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      console.error('❌ Error adding to admin_users:', insertError);
      
      // If table doesn't exist, create it
      if (insertError.code === '42P01') {
        console.log('\n📦 admin_users table does not exist. Creating it...');
        
        // Create table via raw SQL (this might fail with anon key)
        const { error: createError } = await supabase.rpc('exec_sql', {
          query: `
            CREATE TABLE IF NOT EXISTS admin_users (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              UNIQUE(user_id)
            );
          `
        });
        
        if (createError) {
          console.error('❌ Cannot create table with anon key:', createError);
          console.log('\n📌 Alternative: Add is_admin column to profiles table');
          
          // Try to update profiles table structure
          const { data: profile, error: updateError } = await supabase
            .from('profiles')
            .update({ is_admin: true })
            .eq('id', userId)
            .select();
          
          if (updateError) {
            console.error('❌ Cannot update profile:', updateError);
          } else {
            console.log('✅ Updated profile with is_admin flag:', profile);
          }
        }
      }
      return false;
    }
    
    console.log('✅ Successfully added to admin_users:', newAdmin);
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Main execution
console.log('🚀 Admin Users Table Setup');
console.log('=' .repeat(50));

addToAdminUsers().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('✅ Admin setup complete!');
    console.log('\n📌 Next steps:');
    console.log('1. The code has been updated to check admin_users table');
    console.log('2. Sign out and sign back in');
    console.log('3. You should now have admin access');
  } else {
    console.log('⚠️ Manual database setup may be required');
  }
  process.exit(success ? 0 : 1);
});