// @ts-nocheck
// DISABLED: References non-existent database tables
/**
 * Development seed script
 * Automatically creates test admin users and sample data for development
 */


import * as dotenv from 'dotenv';
import * as path from 'path';
import { supabase } from '../src/lib/supabase-client';


// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}



// Development admin users
const DEV_ADMINS = [
  {
    email: 'admin@test.com',
    password: 'Admin123!',
    full_name: 'Test Admin',
    is_admin: true
  },
  {
    email: 'dev@test.com', 
    password: 'Dev123!',
    full_name: 'Dev User',
    is_admin: true
  }
];

// Production admin (with secure password)
const PROD_ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@accelerate.io',
  password: process.env.ADMIN_PASSWORD || generateSecurePassword(),
  full_name: 'System Administrator',
  is_admin: true
};

function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function createOrUpdateUser(userData: typeof DEV_ADMINS[0]) {
  try {
    console.log(`📝 Processing user: ${userData.email}`);
    
    // Try to sign up the user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          full_name: userData.full_name
        }
      }
    });
    
    if (signUpError?.message?.includes('already registered')) {
      console.log(`   ℹ️ User already exists, updating profile...`);
      
      // Get user profile
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', userData.email)
        .single();
      
      if (profiles) {
        // Update to admin
        await supabase
          .from('profiles')
          .update({ 
            is_admin: userData.is_admin,
            full_name: userData.full_name,
            updated_at: new Date().toISOString()
          })
          .eq('id', profiles.id);
        
        console.log(`   ✅ Profile updated`);
      }
    } else if (signUpError) {
      console.error(`   ❌ Error: ${signUpError.message}`);
      return false;
    } else if (authData?.user) {
      // Create/update profile
      await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          is_admin: userData.is_admin,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      console.log(`   ✅ User created successfully`);
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Unexpected error:`, error);
    return false;
  }
}

async function seedDatabase() {
  console.log('🌱 Seeding Database
');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', supabaseUrl);
  console.log('-----------------------------------
');
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    console.log('🔒 Production Mode - Creating secure admin
');
    
    const success = await createOrUpdateUser(PROD_ADMIN);
    
    if (success) {
      console.log('
🎉 Production admin created!');
      console.log('📧 Email:', PROD_ADMIN.email);
      
      // Only show password once in production
      if (!process.env.ADMIN_PASSWORD) {
        console.log('🔑 Password:', PROD_ADMIN.password);
        console.log('
⚠️  IMPORTANT: Save this password securely!');
        console.log('    It will not be shown again.
');
      }
    }
  } else {
    console.log('🚀 Development Mode - Creating test users
');
    
    for (const admin of DEV_ADMINS) {
      await createOrUpdateUser(admin);
    }
    
    console.log('
✅ Development seed complete!');
    console.log('
📝 Test Credentials:');
    console.log('-----------------------------------');
    for (const admin of DEV_ADMINS) {
      console.log(`Email: ${admin.email}`);
      console.log(`Password: ${admin.password}`);
      console.log('-----------------------------------');
    }
  }
  
  // Add sample content for development
  if (!isProduction) {
    console.log('
📦 Adding sample content...');
    
    // Sample content queue items
    const sampleContent = [
      {
        title: 'Getting Started with Web3 Development',
        description: 'A comprehensive guide for beginners',
        category: 'resource',
        status: 'pending',
        priority: 'high',
        metadata: { tags: ['web3', 'tutorial', 'beginner'] }
      },
      {
        title: 'DeFi Protocol Launch',
        description: 'New decentralized finance protocol goes live',
        category: 'project',
        status: 'approved',
        priority: 'medium',
        metadata: { tags: ['defi', 'launch', 'protocol'] }
      },
      {
        title: 'Accelerator Program Applications Open',
        description: 'Apply for the next cohort of our accelerator',
        category: 'funding',
        status: 'published',
        priority: 'high',
        metadata: { tags: ['funding', 'accelerator', 'opportunity'] }
      }
    ];
    
    for (const content of sampleContent) {
      const { error } = await supabase
        .from('content_queue')
        .upsert({
          ...content,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (!error) {
        console.log(`   ✅ Added: ${content.title}`);
      }
    }
  }
  
  console.log('
🎉 Seeding complete!
');
}

// Run the seed script
seedDatabase().catch(console.error);
