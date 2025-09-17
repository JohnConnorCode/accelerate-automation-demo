// @ts-nocheck
// DISABLED: References non-existent database tables
/**
 * Script to create a test admin user for the Accelerate Content Automation system
 * Usage: npm run admin:create-user
 */


import type { Database } from '../src/types/supabase';
import * as readline from 'readline';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { supabase } from '../src/lib/supabase-client';


// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
  console.error('   URL:', supabaseUrl ? '✓' : '✗');
  console.error('   Key:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

// Create Supabase client with service key for admin operations


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (prompt: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
};

async function createAdminUser() {
  console.log('🚀 Create Admin User for Accelerate Content Automation
');
  
  try {
    // Get user details
    const email = await question('Email (default: admin@accelerate.dev): ') || 'admin@accelerate.dev';
    const password = await question('Password (default: Admin123!@#): ') || 'Admin123!@#';
    const fullName = await question('Full Name (default: Admin User): ') || 'Admin User';
    
    console.log('
📝 Creating user with:');
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${fullName}`);
    console.log(`   Admin: Yes
`);
    
    // Step 1: Sign up the user
    console.log('1️⃣ Creating user account...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });
    
    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('   ⚠️ User already exists, updating profile...');
        
        // Try to get existing user ID
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single();
          
        if (existingProfile) {
          // Update existing profile to admin
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              is_admin: true,
              full_name: fullName,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProfile.id);
            
          if (updateError) {
            console.error('❌ Error updating profile:', updateError.message);
            process.exit(1);
          }
          
          console.log('✅ Existing user updated to admin successfully!');
          console.log(`
🔑 Login credentials:`);
          console.log(`   Email: ${email}`);
          console.log(`   Password: ${password}`);
          rl.close();
          return;
        }
      } else {
        console.error('❌ Error creating user:', authError.message);
        process.exit(1);
      }
    }
    
    const userId = authData?.user?.id;
    if (!userId) {
      console.error('❌ No user ID returned');
      process.exit(1);
    }
    
    console.log('   ✅ User account created');
    
    // Step 2: Create or update profile with admin privileges
    console.log('2️⃣ Setting admin privileges...');
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName,
        is_admin: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message);
      // Try to update if insert failed
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          is_admin: true,
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) {
        console.error('❌ Error updating profile:', updateError.message);
        process.exit(1);
      }
    }
    
    console.log('   ✅ Admin privileges granted');
    
    // Step 3: Verify the setup
    console.log('3️⃣ Verifying setup...');
    const { data: profile, error: verifyError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (verifyError || !profile) {
      console.error('❌ Error verifying profile:', verifyError?.message);
      process.exit(1);
    }
    
    if (!profile.is_admin) {
      console.error('❌ Admin flag not set correctly');
      process.exit(1);
    }
    
    console.log('   ✅ Admin user verified');
    
    console.log('
🎉 Admin user created successfully!');
    console.log('
🔑 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('
📱 You can now login at:');
    console.log('   Local: http://localhost:3001/login');
    console.log('   Production: https://accelerate-content-automation.vercel.app/login');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createAdminUser();
