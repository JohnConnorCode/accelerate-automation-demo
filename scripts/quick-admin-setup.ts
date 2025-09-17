// @ts-nocheck
// DISABLED: References non-existent database tables
import type { Database } from '../src/types/supabase';
import { supabase } from '../src/lib/supabase-client';
/**
 * Quick script to create an admin user
 * Run with: npx tsx scripts/quick-admin-setup.ts
 */



const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxcGZ2bXdtZHRzZ2RkcHNvZHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4MjE4NzgsImV4cCI6MjA2MTM5Nzg3OH0.HAyBibHx0dqzXEAAr2MYxv1sfs13PLANLXLXM2NIWKI';



async function createAdminUser() {
  console.log('🔐 Creating Admin User for Content Automation System
');
  
  // Admin credentials
  const email = 'admin@accelerate.com';
  const password = 'admin123456';  // Change this in production!
  const fullName = 'System Admin';
  
  try {
    // Try to sign up
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    
    if (signUpError && signUpError.message.includes('already registered')) {
      console.log('⚠️  User already exists, trying to sign in...');
      
      // Try to sign in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (signInError) {
        console.error('❌ Could not sign in:', signInError.message);
        console.log('
💡 You may need to reset the password or create a new user');
        return;
      }
      
      console.log('✅ Signed in successfully');
    } else if (signUpError) {
      console.error('❌ Error creating user:', signUpError.message);
      return;
    } else {
      console.log('✅ User created successfully');
    }
    
    // Get the user ID
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Could not get user info');
      return;
    }
    
    // Update profile to set admin
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: email,
        name: fullName,
        is_admin: true
      });
    
    if (profileError) {
      console.error('⚠️  Could not update profile:', profileError.message);
      console.log('
You can manually update the profile with this SQL:');
      console.log(`UPDATE profiles SET is_admin = true WHERE id = '${user.id}';`);
    } else {
      console.log('✅ Admin privileges granted!
');
    }
    
    console.log('📋 Admin Account Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`User ID:  ${user.id}`);
    console.log('
🌐 Login at: http://localhost:3002/login');
    console.log('
⚠️  IMPORTANT: Change the password in production!');
    
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
  }
}

createAdminUser();
