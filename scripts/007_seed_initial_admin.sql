-- Create an initial admin user for testing
-- This user can then create other users through the admin dashboard

-- First, you'll need to create this user in Supabase Auth
-- The profile will be created automatically via the trigger

-- Instructions:
-- 1. Go to your Supabase project
-- 2. Navigate to Authentication > Users
-- 3. Click "Add user" and create a user with:
--    Email: admin@example.com
--    Password: Admin123!
-- 4. Copy the user's UUID
-- 5. Run this script, replacing 'YOUR_USER_UUID_HERE' with the actual UUID

-- Update the profile to be an admin
-- UPDATE profiles 
-- SET role = 'admin', full_name = 'Admin User'
-- WHERE id = 'YOUR_USER_UUID_HERE';

-- For now, let's create a function to help with this
CREATE OR REPLACE FUNCTION create_admin_profile(user_id uuid, user_email text)
RETURNS void AS $$
BEGIN
  INSERT INTO profiles (id, email, role, full_name, is_active)
  VALUES (user_id, user_email, 'admin', 'Admin User', true)
  ON CONFLICT (id) DO UPDATE
  SET role = 'admin', is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
