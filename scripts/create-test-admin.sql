-- Create a test admin user
-- First, create the auth user manually in Supabase Dashboard
-- Then run this SQL to make them an admin

-- Update this email to match the user you created
UPDATE profiles 
SET is_admin = true 
WHERE email = 'admin@test.com';

-- Verify the admin status
SELECT id, email, name, is_admin 
FROM profiles 
WHERE email = 'admin@test.com';