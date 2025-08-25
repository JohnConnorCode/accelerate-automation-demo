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

async function setUserAsAdmin(email) {
  console.log(`\n🔧 Setting ${email} as admin...`);
  
  try {
    // First, find the user by email
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();
    
    if (userError) {
      // If profile doesn't exist by email, try to find by auth user
      console.log('Profile not found by email, checking auth users...');
      
      // Get all profiles and check if any match
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');
      
      if (profilesError) {
        console.error('❌ Error fetching profiles:', profilesError);
        return false;
      }
      
      console.log(`Found ${profiles?.length || 0} profiles`);
      
      // Try to find profile with matching email pattern
      const profile = profiles?.find(p => 
        p.email === email || 
        p.full_name?.toLowerCase().includes(email.split('@')[0].toLowerCase())
      );
      
      if (!profile) {
        console.log('❌ No profile found for this email');
        console.log('\nCreating new admin profile...');
        
        // Create a new profile with admin rights
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            email: email,
            full_name: 'Admin User',
            is_admin: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          console.error('❌ Error creating profile:', createError);
          return false;
        }
        
        console.log('✅ Created new admin profile:', newProfile);
        return true;
      }
      
      // Update existing profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_admin: true,
          email: email, // Ensure email is set
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Error updating profile:', updateError);
        return false;
      }
      
      console.log('✅ Updated profile to admin:', updatedProfile);
      return true;
    }
    
    // Update the found profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_admin: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userData.id)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return false;
    }
    
    console.log('✅ Successfully set as admin:', updatedProfile);
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Check if user exists in auth.users first
async function checkAndCreateAdminUser(email) {
  console.log(`\n🔍 Checking if user ${email} exists in auth system...`);
  
  // First, let's check what profiles exist
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (!profilesError) {
    console.log('\n📋 Existing profiles:');
    profiles?.forEach(p => {
      console.log(`  - ID: ${p.id}, Email: ${p.email || 'N/A'}, Name: ${p.full_name || 'N/A'}, Admin: ${p.is_admin}`);
    });
  }
  
  // Now set the admin
  await setUserAsAdmin(email);
}

// Main execution
const adminEmail = 'jt.connor88@gmail.com';
console.log('🚀 Admin Setup Script');
console.log('=' .repeat(50));
console.log(`Setting up admin access for: ${adminEmail}`);

checkAndCreateAdminUser(adminEmail).then(success => {
  console.log('\n' + '='.repeat(50));
  if (success !== false) {
    console.log('✅ Admin setup completed!');
    console.log(`\n📌 Next steps:`);
    console.log(`1. Sign in with ${adminEmail}`);
    console.log(`2. You should now have admin access`);
    console.log(`3. Check the Admin panel in the navigation menu`);
  } else {
    console.log('⚠️ Admin setup may have issues. Please check the output above.');
  }
  process.exit(0);
}).catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});