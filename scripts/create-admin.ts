// @ts-nocheck
// DISABLED: References non-existent database tables
/**
 * Script to create an admin user for the content automation system
 * Run with: npx tsx scripts/create-admin.ts
 */


import type { Database } from '../src/types/supabase';
import readline from 'readline';
import { supabase } from '../src/lib/supabase-client';


const SUPABASE_URL = 'https://eqpfvmwmdtsgddpsodsr.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  console.log('Get your service key from: https://app.supabase.com/project/eqpfvmwmdtsgddpsodsr/settings/api');
  process.exit(1);
}



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

async function createAdmin() {
  console.log('🔐 Create Admin User for Content Automation System
');
  
  const email = await question('Email: ');
  const password = await question('Password (min 6 chars): ');
  const fullName = await question('Full Name: ');
  
  console.log('
⏳ Creating admin user...');
  
  try {
    // Create the user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });
    
    if (authError) {
      throw authError;
    }
    
    if (!authData.user) {
      throw new Error('User creation failed');
    }
    
    // Update the profile to set is_admin = true
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        is_admin: true,
        name: fullName,
        email: email
      } as any)
      .eq('id', authData.user.id);
    
    if (profileError) {
      console.error('⚠️ User created but failed to set admin flag:', profileError);
      console.log('You can manually update the profiles table to set is_admin = true');
    } else {
      console.log('✅ Admin user created successfully!');
      console.log('
You can now login at: http://localhost:3002/login');
      console.log(`Email: ${email}`);
    }
    
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    
    if (error.message.includes('already registered')) {
      console.log('
💡 User already exists. To make them an admin, run this SQL in Supabase:');
      console.log(`UPDATE profiles SET is_admin = true WHERE email = '${email}';`);
    }
  } finally {
    rl.close();
  }
}

createAdmin();
